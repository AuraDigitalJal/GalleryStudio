#!/usr/bin/env python3
"""Monitoreo de solo lectura de Cloudflare para Aura Digital."""
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

API = "https://api.cloudflare.com/client/v4/graphql"
BUCKET = "aura-galerias"
WORKER = "aura-gallery-r2-upload"
OUT = Path(__file__).resolve().parent / "reportes"
CLASS_A = set("ListBuckets PutBucket ListObjects PutObject CopyObject CompleteMultipartUpload CreateMultipartUpload ListMultipartUploads UploadPart UploadPartCopy ListParts PutBucketEncryption PutBucketCors PutBucketLifecycleConfiguration".split())
CLASS_B = set("HeadBucket HeadObject GetObject UsageSummary GetBucketEncryption GetBucketLocation GetBucketCors GetBucketLifecycleConfiguration".split())
FREE = set("DeleteObject DeleteBucket AbortMultipartUpload".split())
LIMIT_A, LIMIT_B, LIMIT_GB = 1_000_000, 10_000_000, 10

STORAGE = """query($id:string!,$start:Time!,$end:Time!,$bucket:string!){
 viewer{accounts(filter:{accountTag:$id}){
  r2StorageAdaptiveGroups(limit:100,orderBy:[datetime_DESC],filter:{
    datetime_geq:$start,datetime_leq:$end,bucketName:$bucket}){
   dimensions{datetime}
   max{objectCount payloadSize metadataSize}
  }
 }}
}"""
OPERATIONS = """query($id:string!,$start:Time!,$end:Time!,$bucket:string!){
 viewer{accounts(filter:{accountTag:$id}){
  r2OperationsAdaptiveGroups(limit:1000,filter:{
    datetime_geq:$start,datetime_leq:$end,bucketName:$bucket}){
   dimensions{actionType} sum{requests}
  }
 }}
}"""
BANDWIDTH = """query($id:string!,$start:Time!,$end:Time!,$bucket:string!){
 viewer{accounts(filter:{accountTag:$id}){
  r2BandwidthUsageAdaptiveGroups(limit:1000,filter:{
    datetime_geq:$start,datetime_lt:$end,bucketName:$bucket}){
   sum{bytesUpload bytesDownload}
  }
 }}
}"""
WORKERS = """query($id:string!,$start:Time!,$end:Time!,$script:string!){
 viewer{accounts(filter:{accountTag:$id}){
  workersInvocationsAdaptive(limit:1,filter:{
    datetime_geq:$start,datetime_leq:$end,scriptName:$script}){
   sum{requests errors}
  }
 }}
}"""

def api(query, variables, field):
    body = json.dumps({"query": query, "variables": variables}).encode()
    req = Request(API, data=body, headers={
        "Authorization": "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"],
        "Content-Type": "application/json",
        "Accept": "application/json",
    })
    try:
        with urlopen(req, timeout=30) as response:
            result = json.load(response)
    except HTTPError as e:
        raise RuntimeError(f"{field}: HTTP {e.code} (comprueba permisos Analytics Read)") from None
    except (URLError, TimeoutError):
        raise RuntimeError(f"{field}: no se pudo conectar a Cloudflare") from None
    except (ValueError, UnicodeDecodeError):
        raise RuntimeError(f"{field}: respuesta no válida") from None
    if result.get("errors"):
        raise RuntimeError(f"{field}: Cloudflare rechazó la consulta (revisar token, Account ID y permisos)") from None
    try:
        accounts = result["data"]["viewer"]["accounts"]
        if len(accounts) != 1:
            raise ValueError("Cuenta no encontrada")
        return accounts[0][field]
    except (KeyError, TypeError, ValueError, IndexError):
        raise RuntimeError(f"{field}: cuenta o métricas no disponibles") from None

def classify(rows):
    counts = defaultdict(int)
    actions = {}
    for row in rows:
        action = str((row.get("dimensions") or {}).get("actionType") or "desconocida")
        n = int((row.get("sum") or {}).get("requests") or 0)
        group = "A" if action in CLASS_A else "B" if action in CLASS_B else "gratuitas" if action in FREE else "sin_clasificar"
        counts[group] += n
        actions[action] = actions.get(action, 0) + n
    return {**{k: counts[k] for k in ("A","B","gratuitas","sin_clasificar")}, "por_tipo": actions}

def report():
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not account or not token:
        raise RuntimeError("Faltan CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_API_TOKEN en GitHub Actions")
    now = datetime.now(timezone.utc)
    month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    iso = lambda d: d.strftime("%Y-%m-%dT%H:%M:%SZ")
    base = {"id":account,"start":iso(month),"end":iso(now),"bucket":BUCKET}
    storage = api(STORAGE,{**base,"start":iso(now-timedelta(hours=48))},"r2StorageAdaptiveGroups")
    if not storage:
        raise RuntimeError("R2: sin muestra de almacenamiento en las últimas 48 horas")
    sample = storage[0]
    values = sample.get("max") or {}
    payload = int(values.get("payloadSize") or 0)
    metadata = int(values.get("metadataSize") or 0)
    used = payload + metadata
    ops = classify(api(OPERATIONS,base,"r2OperationsAdaptiveGroups"))
    bw_rows = api(BANDWIDTH,base,"r2BandwidthUsageAdaptiveGroups")
    bandwidth = {k:sum(int((r.get("sum") or {}).get(k) or 0) for r in bw_rows) for k in ("bytesUpload","bytesDownload")}
    warnings = []
    try:
        workers = api(WORKERS,{"id":account,"start":iso(month),"end":iso(now),"script":WORKER},"workersInvocationsAdaptive")
        worker_data = {k:sum(int((r.get("sum") or {}).get(k) or 0) for r in workers) for k in ("requests","errors")}
    except RuntimeError:
        warnings.append("No se pudieron consultar las métricas del Worker; R2 sí se consultó.")
        worker_data = {"requests":None,"errors":None}
    checks = {
        "Almacenamiento actual (referencia, NO GB-mes facturados)": used/(LIMIT_GB*1_000_000_000)*100,
        "Operaciones A del bucket (mes UTC)": ops["A"]/LIMIT_A*100,
        "Operaciones B del bucket (mes UTC)": ops["B"]/LIMIT_B*100,
    }
    alerts = [{"indicador":k,"porcentaje":round(v,2),"nivel":next(n for n in (95,85,70) if v>=n)}
              for k,v in checks.items() if v>=70]
    if ops["sin_clasificar"]:
        warnings.append("Hay operaciones R2 sin clasificar: comprobar la lista de tipos antes de interpretar el porcentaje.")
    return {
        "consultado_utc":iso(now),
        "mes_desde_utc":iso(month),
        "bucket":BUCKET,
        "almacenamiento":{"muestra_utc":sample.get("dimensions",{}).get("datetime"),
            "objetos":int(values.get("objectCount") or 0),
            "bytes":used,"megabytes":round(used/1_000_000,2)},
        "operaciones_mes_bucket":ops,
        "transferencia_mes_bucket":bandwidth,
        "worker":{"nombre":WORKER,**worker_data},
        "alertas_orientativas":alerts,
        "advertencias":warnings+[
            "Los límites de R2 son por cuenta, no por bucket. No representan facturación exacta.",
            "El almacenamiento instantáneo no equivale a GB-mes facturados.",
            "La transferencia R2 omite transferencias de menos de 100 KiB.",
            "Solicitudes no equivalen a visitantes únicos.",
        ],
    }

def markdown(data):
    s, op, bw, w = (data["almacenamiento"],data["operaciones_mes_bucket"],
                     data["transferencia_mes_bucket"],data["worker"])
    fmt = lambda n: "No disponible" if n is None else f"{n:,}"
    lines = [
        "# Aura Digital · Informe diario de Cloudflare","",
        f"Actualizado: **{data['consultado_utc']}** (UTC)","",
        "| Indicador | Valor |","|---|---:|",
        f"| Almacenamiento actual R2 | {s['megabytes']:.2f} MB |",
        f"| Objetos almacenados | {fmt(s['objetos'])} |",
        f"| Operaciones A (mes, bucket) | {fmt(op['A'])} |",
        f"| Operaciones B (mes, bucket) | {fmt(op['B'])} |",
        f"| Operaciones desconocidas | {fmt(op['sin_clasificar'])} |",
        f"| Descarga R2 contabilizada (mes) | {bw['bytesDownload']/1_000_000:.2f} MB |",
        f"| Subida R2 contabilizada (mes) | {bw['bytesUpload']/1_000_000:.2f} MB |",
        f"| Worker: solicitudes (mes) | {fmt(w['requests'])} |",
        f"| Worker: errores (mes) | {fmt(w['errors'])} |","",
        "## Alertas orientativas","",
    ]
    if data["alertas_orientativas"]:
        for a in data["alertas_orientativas"]:
            lines.append(f"- **{a['nivel']}% o más**: {a['indicador']} ({a['porcentaje']}%).")
    else:
        lines.append("Sin umbrales del 70%, 85% o 95% superados en las métricas medidas.")
    lines += ["","## Consideraciones",""] + ["- "+n for n in data["advertencias"]]
    return "\n".join(lines)+"\n"

def main():
    data = report()
    OUT.mkdir(exist_ok=True)
    (OUT/"ultimo.json").write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    (OUT/"RESUMEN.md").write_text(markdown(data),encoding="utf-8")
    print("Monitoreo terminado. Se crearon archivos de reporte sin guardar credenciales.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Error: "+str(e),file=sys.stderr)
        sys.exit(1)
