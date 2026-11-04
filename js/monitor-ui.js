/* Aura Digital · panel de monitoreo Cloudflare.
 * Solo lectura, sin credenciales y separado del motor de publicación.
 * Lee un resumen agregado publicado por Actions en monitor-estado.
 */
(function () {
  'use strict';

  const repo = 'AuraDigitalJal/GalleryStudio';
  const api = 'https://api.github.com/repos/' + repo;
  const reportPath = '/contents/cloudflare-monitor/estado/ultimo.json?ref=monitor-estado';
  const $ = (id) => document.getElementById(id);
  const overlay = $('monitorOverlay');
  const trigger = $('openMonitor');
  const close = $('monitorClose');
  const refresh = $('monitorRefresh');
  if (!overlay || !trigger || !close || !refresh) return;

  const formatNumber = (n) => Number.isFinite(Number(n))
    ? new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Number(n)) : '—';
  const formatMB = (bytes) => Number.isFinite(Number(bytes))
    ? (Number(bytes) / 1e6).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MB' : '—';
  const formatDate = (s) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? 'Sin fecha' : d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }) + ' (hora del centro)';
  };
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  let previousFocus = null;
  let loading = false;

  async function githubRead(url) {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) throw new Error(
      response.status === 404 ? 'El reporte todavía no está publicado.' :
      response.status === 403 ? 'GitHub limitó temporalmente las consultas. Intenta más tarde.' :
      'No se pudo consultar GitHub (HTTP ' + response.status + ').'
    );
    return response.json();
  }

  function displayReport(data) {
    if (!data || !data.consultado_utc || !data.almacenamiento || !data.operaciones_mes_bucket)
      throw new Error('El archivo de monitoreo está incompleto.');
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
    setText('monitorState', age > 48 * 3600 * 1000
      ? 'Datos anteriores a 48 horas · consultar ejecución de GitHub'
      : 'Lectura disponible · actualización diaria');
    $('monitorState').classList.toggle('warning', age > 48 * 3600 * 1000);
  }

  async function loadWorkflowStatus() {
    try {
      const result = await githubRead(api + '/actions/runs?per_page=30');
      const latest = (result.workflow_runs || []).find(r => r.path === '.github/workflows/aura-cloudflare-monitor.yml');
      if (!latest) { setText('monitorWorkflow', 'Sin ejecuciones visibles'); return; }
      let label = latest.status === 'completed'
        ? (latest.conclusion === 'success' ? 'Completada correctamente' : 'Revisar ejecución: ' + latest.conclusion)
        : 'En proceso';
      setText('monitorWorkflow', label + ' · ' + formatDate(latest.created_at));
      const link = $('monitorRunLink');
      if (link && typeof latest.html_url === 'string' && /^https:\/\/github\.com\/AuraDigitalJal\/GalleryStudio\/actions\/runs\/\d+$/.test(latest.html_url)) link.href = latest.html_url;
    } catch (_) {
      setText('monitorWorkflow', 'Estado de ejecución no disponible');
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
      const file = await githubRead(api + reportPath);
      if (file.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('Formato de archivo no compatible.');
      const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), ch => ch.charCodeAt(0));
      displayReport(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (error) {
      setText('monitorState', 'No disponible: ' + (error.message || 'Error inesperado'));
      $('monitorState').classList.add('warning');
    } finally {
      loading = false;
      refresh.disabled = false;
      refresh.textContent = 'Actualizar datos';
    }
    await loadWorkflowStatus();
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
  refresh.addEventListener('click', loadMonitor);
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
