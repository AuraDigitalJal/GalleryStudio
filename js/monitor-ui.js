/* Aura Digital · panel de monitoreo Cloudflare.
 * Solo lectura, sin credenciales y separado del motor de publicación.
 * Lee un resumen agregado publicado por Actions en monitor-estado.
 */
(function () {
  'use strict';

  const repo = 'AuraDigitalJal/GalleryStudio';
  const api = 'https://api.github.com/repos/' + repo;
  const reportPath = '/contents/cloudflare-monitor/estado/ultimo.json?ref=monitor-estado';
  const rawReportUrl = 'https://raw.githubusercontent.com/' + repo + '/monitor-estado/cloudflare-monitor/estado/ultimo.json';
  const $ = (id) => document.getElementById(id);
  const overlay = $('monitorOverlay');
  const trigger = $('openMonitor');
  const close = $('monitorClose');
  const refresh = $('monitorRefresh');
  if (!overlay || !trigger || !close || !refresh) return;

  const formatNumber = (n) => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n))
    ? new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Number(n)) : '—';
  const formatMB = (bytes) => bytes !== null && bytes !== undefined && bytes !== '' && Number.isFinite(Number(bytes))
    ? (Number(bytes) / 1e6).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MB' : '—';
  const formatDate = (s) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? 'Sin fecha' : d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }) + ' (hora del centro)';
  };
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  let previousFocus = null;
  let loading = false;
  let measuring = false;

  async function githubRead(url, token = '') {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers
    });
    if (!response.ok) throw new Error(
      response.status === 404 ? 'El reporte todavía no está publicado.' :
      response.status === 403 ? 'GitHub limitó temporalmente las consultas. Intenta más tarde.' :
      'No se pudo consultar GitHub (HTTP ' + response.status + ').'
    );
    return response.json();
  }


  // Comparativas orientativas. R2 usa solo datos del bucket; no es el saldo real
  // de una cuenta que pueda tener otros buckets. Workers se mide por día UTC.
  const quotaLimits = Object.freeze({ storage: 10000, operationsA: 1000000, operationsB: 10000000, workerDay: 100000 });
  const pct = (n) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  function paintQuota(key, value, description) {
    const node = document.querySelector('.aura-monitor-meter[data-meter-key="' + key + '"]');
    if (!node) return null;
    const bar = node.querySelector('.aura-monitor-meter-progress');
    const fill = node.querySelector('.aura-monitor-meter-fill');
    const used = node.querySelector('[data-meter-used]');
    const free = node.querySelector('[data-meter-free]');
    const note = node.querySelector('[data-meter-note]');
    const limit = quotaLimits[key];
    if (value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) < 0) {
      node.dataset.level = 'unknown';
      fill.style.width = '0%';
      bar.removeAttribute('aria-valuenow');
      bar.setAttribute('aria-valuetext', 'Métrica no disponible');
      used.textContent = 'Sin dato diario comparable';
      free.textContent = '—';
      note.textContent = description;
      return null;
    }
    const consumed = Number(value);
    const percentUsed = consumed / limit * 100;
    const percentFree = Math.max(0, 100 - percentUsed);
    const remaining = Math.max(0, limit - consumed);
    const level = percentUsed >= 100 ? 'critical' : percentUsed >= 95 ? 'critical' : percentUsed >= 85 ? 'high' : percentUsed >= 70 ? 'caution' : 'ok';
    node.dataset.level = level;
    fill.style.width = Math.min(100, percentUsed) + '%';
    bar.setAttribute('aria-valuenow', String(Math.min(100, Math.max(0, percentUsed))));
    bar.setAttribute('aria-valuetext', pct(percentUsed) + ' usado, ' + pct(percentFree) + ' restante');
    used.textContent = pct(percentUsed) + ' utilizado' + (key === 'storage' ? ' (referencia)' : '');
    free.textContent = percentUsed > 100
      ? 'Exceso: ' + pct(percentUsed - 100)
      : pct(percentFree) + ' restante';
    const unit = key === 'storage' ? ' MB aprox.' : ' solicitudes/operaciones';
    note.textContent = description + ' · Margen teórico: ' +
      (key === 'storage' ? remaining.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : formatNumber(remaining)) + unit;
    return { level, percentUsed };
  }

  function displayQuotas(data) {
    const checks = [
      paintQuota('storage', data.almacenamiento?.megabytes, 'Almacenamiento actual; no es el promedio GB-mes de la cuenta'),
      paintQuota('operationsA', data.operaciones_mes_bucket?.A, 'Mes UTC · únicamente bucket de galerías'),
      paintQuota('operationsB', data.operaciones_mes_bucket?.B, 'Mes UTC · únicamente bucket de galerías')
    ];
    const day = data.worker_dia_cuenta;
    const measuredAt = new Date(data.consultado_utc);
    const measuredDay = Number.isNaN(measuredAt.getTime()) ? '' : measuredAt.toISOString().slice(0, 10);
    // La cuota de Workers se reinicia a medianoche UTC; jamás reutilizar
    // un conteo diario del día anterior como si fuese el de hoy.
    const isCurrentUtcDay = day && typeof day.desde_utc === 'string' &&
      day.desde_utc.slice(0, 10) === measuredDay &&
      measuredDay === new Date().toISOString().slice(0, 10);
    checks.push(paintQuota('workerDay', isCurrentUtcDay ? day.requests : null,
      day ? 'Dato diario anterior o incompleto; espera la siguiente medición del día UTC' :
      'Disponible a partir de la siguiente ejecución del monitor; el acumulado mensual no se compara con el tope diario'));
    const valid = checks.filter(Boolean);
    const worst = valid.reduce((acc, c) => Math.max(acc, c.percentUsed), 0);
    setText('monitorQuotaSummary', worst >= 95 ? 'Atención: 95% o más' :
      worst >= 85 ? 'Precaución: 85% o más' :
      worst >= 70 ? 'Vigilancia: 70% o más' :
      'Bajo 70% en referencias comparadas');
    $('monitorQuotaSummary').classList.toggle('warning', worst >= 70);
  }

  function displayReport(data) {
    if (!data || !data.consultado_utc || !data.almacenamiento || !data.operaciones_mes_bucket)
      throw new Error('El archivo de monitoreo está incompleto.');
    displayQuotas(data);
    setText('monitorUpdated', formatDate(data.consultado_utc));
    setText('monitorStorage', Number(data.almacenamiento.megabytes).toLocaleString('es-MX', { maximumFractionDigits: 2 }) + ' MB');
    setText('monitorObjects', formatNumber(data.almacenamiento.objetos));
    setText('monitorOpsA', formatNumber(data.operaciones_mes_bucket.A));
    setText('monitorOpsB', formatNumber(data.operaciones_mes_bucket.B));
    setText('monitorUploads', formatMB(data.transferencia_mes_bucket && data.transferencia_mes_bucket.bytesUpload));
    setText('monitorDownloads', formatMB(data.transferencia_mes_bucket && data.transferencia_mes_bucket.bytesDownload));
    setText('monitorRequests', formatNumber(data.worker && data.worker.requests));
    setText('monitorErrors', formatNumber(data.worker && data.worker.errors));
    setText('monitorPeriod', new Date(data.mes_desde_utc).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
    const unknown = Number(data.operaciones_mes_bucket.sin_clasificar) || 0;
    const alerts = Array.isArray(data.alertas_orientativas) ? data.alertas_orientativas : [];
    const warning = $('monitorWarning');
    warning.textContent = alerts.length
      ? alerts.map(a => (a.indicador || 'Indicador') + ': ' + formatNumber(a.porcentaje) + '% (umbral ' + a.nivel + '%)').join(' · ')
      : 'Sin umbrales de alerta alcanzados en las métricas disponibles.';
    warning.classList.toggle('warning', alerts.length > 0);
    const notes = $('monitorNotes');
    notes.textContent = (unknown ? formatNumber(unknown) + ' operaciones sin clasificar. ' : '') +
      'Datos mensuales en UTC y almacenamiento de la última muestra. Los límites gratuitos aplican a toda la cuenta, no solo a este bucket. Las solicitudes no son visitantes únicos.';
    const age = Date.now() - new Date(data.consultado_utc).getTime();
    const stale = !Number.isFinite(age) || age < 0 || age > 30 * 3600 * 1000;
    setText('monitorState', stale
      ? 'Reporte desactualizado · la medición automática requiere revisión'
      : 'Último reporte disponible · actualización diaria, no en tiempo real');
    $('monitorState').classList.toggle('warning', stale);
  }

  async function loadWorkflowStatus() {
    try {
      const result = await githubRead(api + '/actions/runs?per_page=30');
      const latest = (result.workflow_runs || []).find(r => r.path === '.github/workflows/aura-cloudflare-monitor.yml');
      const pages = (result.workflow_runs || []).find(r => r.path === 'dynamic/pages/pages-build-deployment');
      if (pages) {
        const pagesStatus = pages.status === 'completed'
          ? (pages.conclusion === 'success' ? 'Correcto' : 'Revisar: ' + pages.conclusion)
          : 'En proceso';
        setText('monitorPages', pagesStatus + ' · ' + formatDate(pages.created_at));
      } else setText('monitorPages', 'Sin despliegues visibles');
      if (!latest) { setText('monitorWorkflow', 'Sin ejecuciones visibles'); return; }
      let label = latest.status === 'completed'
        ? (latest.conclusion === 'success' ? 'Completada correctamente' : 'Revisar ejecución: ' + latest.conclusion)
        : 'En proceso';
      setText('monitorWorkflow', label + ' · ' + formatDate(latest.created_at));
      const link = $('monitorRunLink');
      if (link && typeof latest.html_url === 'string' && /^https:\/\/github\.com\/AuraDigitalJal\/GalleryStudio\/actions\/runs\/\d+$/.test(latest.html_url)) link.href = latest.html_url;
    } catch (_) {
      setText('monitorWorkflow', 'Estado de ejecución no disponible');
      setText('monitorPages', 'Despliegue no disponible');
    }
  }

  // La API pública de GitHub puede limitar peticiones sin autenticar.
  // Si ocurre, recuperamos el mismo JSON agregado desde raw.githubusercontent.com.
  async function readLatestReport() {
    try {
      const file = await githubRead(api + reportPath);
      if (file.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('Formato de reporte no compatible.');
      const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), ch => ch.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (firstError) {
      const response = await fetch(rawReportUrl + '?v=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw firstError;
      return response.json();
    }
  }

  async function loadMonitor() {
    if (loading) return;
    loading = true;
    refresh.disabled = true;
    refresh.textContent = 'Consultando…';
    setText('monitorState', 'Consultando último reporte…');
    $('monitorState').classList.remove('warning');
    try {
      displayReport(await readLatestReport());
    } catch (error) {
      setText('monitorState', 'No disponible: ' + (error.message || 'Error inesperado'));
      $('monitorState').classList.add('warning');
    } finally {
      loading = false;
      refresh.disabled = measuring;
      refresh.textContent = measuring ? 'Midiendo…' : 'Actualizar datos';
    }
    await loadWorkflowStatus();
  }

  // La lectura normal solo consulta el último JSON. Este comando provoca
  // una medición nueva mediante repository_dispatch, con el mismo permiso
  // Contents: write que usa el editor para publicar en GitHub.
  async function startMeasurement() {
    if (measuring || loading) return;
    const token = ($('githubToken')?.value || '').trim();
    if (!token) {
      setText('monitorState', 'Para medir ahora necesitas el token de GitHub en 06 · Publicar. Escríbelo allí y vuelve a pulsar Actualizar datos.');
      $('monitorState').classList.add('warning');
      return;
    }

    measuring = true;
    refresh.disabled = true;
    refresh.textContent = 'Midiendo…';
    $('monitorState').classList.remove('warning');
    const prior = await readLatestReport().catch(() => null);
    const priorStamp = prior?.consultado_utc || null;
    const requestId = 'manual-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const requestedAt = Date.now();
    let runUrl = null;
    try {
      setText('monitorState', 'Solicitando nueva medición a GitHub…');
      const response = await fetch(api + '/dispatches', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          event_type: 'aura-monitor-refresh',
          client_payload: { request_id: requestId }
        })
      });
      if (response.status !== 204) {
        if (response.status === 401) throw new Error('GitHub rechazó el token. Vuelve a conectarlo en 06 · Publicar.');
        if (response.status === 403) throw new Error('El token necesita permiso Contents (lectura y escritura) para GalleryStudio.');
        if (response.status === 404) throw new Error('El token no tiene acceso a AuraDigitalJal/GalleryStudio o el repositorio no está disponible.');
        if (response.status === 422) throw new Error('GitHub limitó las solicitudes. Inténtalo más tarde.');
        throw new Error('GitHub no pudo iniciar la medición (HTTP ' + response.status + ').');
      }

      setText('monitorState', 'Solicitud aceptada. GitHub está preparando la medición…');
      let runSucceeded = false;
      // No contamos una lectura de JSON como medición nueva: esperamos a que
      // GitHub termine el proceso específico de esta solicitud.
      for (let attempt = 0; attempt < 45; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 6000));
        let runs;
        try {
          runs = await githubRead(api + '/actions/runs?event=repository_dispatch&per_page=30', token);
        } catch (_) {
          continue;
        }
        const run = (runs.workflow_runs || []).find(item =>
          item.path === '.github/workflows/aura-cloudflare-monitor.yml' &&
          item.display_title === 'Aura R2 · ' + requestId
        );
        if (!run) {
          setText('monitorState', 'Solicitud enviada. Esperando a que GitHub inicie la medición…');
          continue;
        }
        if (typeof run.html_url === 'string' &&
            /^https:\/\/github\.com\/AuraDigitalJal\/GalleryStudio\/actions\/runs\/\d+$/.test(run.html_url)) {
          runUrl = run.html_url;
          $('monitorRunLink').href = runUrl;
        }
        if (run.status !== 'completed') {
          setText('monitorState', run.status === 'queued'
            ? 'GitHub tiene la medición en cola…'
            : 'Consultando métricas de Cloudflare…');
          setText('monitorWorkflow', run.status === 'queued' ? 'Nueva medición en cola' : 'Nueva medición en proceso');
          continue;
        }
        if (run.conclusion !== 'success') {
          throw new Error('La medición terminó con error en GitHub (' + (run.conclusion || 'sin resultado') + '). Consulta Ver historial.');
        }
        runSucceeded = true;
        break;
      }

      if (!runSucceeded) {
        setText('monitorState', 'GitHub recibió la solicitud, pero aún no confirma el resultado. Consulta Ver historial.');
        $('monitorState').classList.add('warning');
        return;
      }

      // La ejecución es exitosa solo si produjo el reporte. Puede haber una
      // demora breve de caché antes de que el archivo público lo refleje.
      for (let attempt = 0; attempt < 7; attempt++) {
        try {
          const fresh = await readLatestReport();
          if (!priorStamp || fresh.consultado_utc !== priorStamp) {
            displayReport(fresh);
            setText('monitorState', 'Nueva medición completada · ' + formatDate(fresh.consultado_utc));
            $('monitorState').classList.remove('warning');
            setText('monitorWorkflow', 'Nueva medición completada correctamente');
            return;
          }
        } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      setText('monitorState', 'GitHub terminó la medición, pero el reporte público aún no refleja los cambios. Revisa Ver historial.');
      $('monitorState').classList.add('warning');
    } catch (error) {
      setText('monitorState', 'No se actualizó: ' + (error.message || 'Error de conexión'));
      $('monitorState').classList.add('warning');
      if (runUrl) $('monitorRunLink').href = runUrl;
    } finally {
      measuring = false;
      refresh.disabled = false;
      refresh.textContent = 'Actualizar datos';
    }
  }

  function openMonitor() {
    previousFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('aura-monitor-open');
    close.focus();
    loadMonitor();
  }
  function closeMonitor() {
    overlay.hidden = true;
    document.body.classList.remove('aura-monitor-open');
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }
  trigger.addEventListener('click', openMonitor);
  close.addEventListener('click', closeMonitor);
  refresh.addEventListener('click', startMeasurement);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) closeMonitor(); });
  document.addEventListener('keydown', (event) => {
    if (!overlay.hidden && event.key === 'Escape') { event.preventDefault(); closeMonitor(); }
    if (!overlay.hidden && event.key === 'Tab') {
      const focusables = Array.from(overlay.querySelectorAll('button:not([disabled]), a[href]'));
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
})();
