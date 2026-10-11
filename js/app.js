(() => {
  'use strict';

  const VERSION = '1.4.30';
  const $ = id => document.getElementById(id);
  const SECTION_DEFS = [
    ['getting-ready', 'Getting Ready', 'Los Preparativos'],
    ['misa', 'Misa', 'La Ceremonia'],
    ['recepcion', 'Recepción', 'La Recepción'],
    ['vals', 'Vals', 'Nuestro Vals'],
    ['fiesta', 'Fiesta', 'La Fiesta']
  ];

  const state = {
    style: 'organic',
    coverStyle: 'classic',
    mobileCoverMode: 'mixed',
    coverBoxOpacity: 91,
    revealStyle: 'soft',
    studioName: 'Nuestra Historia',
    brandMode: 'text',
    studioLogo: null,
    accentColor: '#a58d63',
    backgroundColor: '#f5f2ec',
    textColor: '#2f2c28',
    title: 'Mariana + Luis',
    date: '2026-10-12',
    heroEyebrow: 'NUESTRA HISTORIA',
    subtitle: 'Un día para siempre.',
    description: 'Gracias por ser parte de esta historia.',
    heroX: 50,
    heroY: 50,
    hero: null,
    shareTitle: '',
    shareDescription: '',
    shareImageSource: 'hero',
    sharePublicUrl: '',
    sectionOrder: [...SECTION_DEFS.map(([id]) => id), 'videos'],
    sections: Object.fromEntries(SECTION_DEFS.map(([id, label, title]) => [id, {
      id, label, title, enabled: true, x: 50, y: 50, banner: null, highlightsEnabled: false, highlightsCount: 6, galleryDisplay: 'manual',
      layout: id === 'vals' ? 'carousel' : (id === 'getting-ready' || id === 'misa' ? 'editorial' : 'masonry')
    }])),
    photos: [],
    videosEnabled: true,
    videosEyebrow: 'PELÍCULA',
    videosTitle: 'Videos del evento',
    video1: '',
    video1Label: 'Video 1',
    video2: '',
    video2Label: 'Video 2',
    music: null,
    musicAutostart: false,
    musicLoop: true,
    musicPlayerVisible: true,
    musicTitle: '',
    musicArtist: '',
    downloadEnabled: false,
    downloadUrl: '',
    batchSize: 15,
    imageProfile: 500
  };

  let photoSeq = 0;
  let detachedPreviewWindow = null;
  let previewTimer = null;
  let githubUser = null;
  let exportBusy = false;
  const optimizationCache = new Map();
  const hashCache = new WeakMap();
  const previewUrls = new Set();

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const escapeAttr = escapeHtml;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, Number(n) || 0));
  const formatBytes = n => {
    n = Number(n) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 100 * 1024 ? 1 : 0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  };
  const fileExt = name => {
    const m = String(name || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
    return m ? m[1] : '';
  };
  const sanitizeFilePart = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'galeria';
  const fileFingerprint = f => `${f?.name || ''}|${f?.size || 0}|${f?.lastModified || 0}|${f?.type || ''}`;

  function formatEventDate(iso) {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(d).toUpperCase();
  }

  function sectionDef(id) {
    return SECTION_DEFS.find(([sid]) => sid === id) || [id, id, id];
  }

  function orderedContentIds() {
    const valid = [...SECTION_DEFS.map(([id]) => id), 'videos'];
    const ordered = (state.sectionOrder || []).filter(id => valid.includes(id));
    valid.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });
    return ordered;
  }

  function orderedSectionIds() {
    return orderedContentIds().filter(id => id !== 'videos');
  }

  function sectionOptions(selected) {
    return orderedSectionIds().map(id => {
      const label = state.sections[id]?.label || sectionDef(id)[1];
      return `<option value="${id}"${id === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  function layoutOptions(selected) {
    const option = (value, label) => `<option value="${value}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    return `<optgroup label="Favoritos">${[
      ['masonry', 'Orgánico adaptativo'],
      ['editorial', 'Editorial · portada y dípticos'],
      ['editorial-pro', 'Editorial Pro'],
      ['organized', 'Organizado'],
      ['carousel', 'Carrusel'],
      ['story', 'Álbum · foto completa']
    ].map(x => option(...x)).join('')}</optgroup><optgroup label="Narrativos">${[
      ['narrative', 'Narrativa editorial'],
      ['collage', 'Collage dinámico'],
      ['scattered', 'Scattered · aire editorial'],
      ['filmstrip', 'Secuencia deslizable']
    ].map(x => option(...x)).join('')}</optgroup><optgroup label="Por orientación">${[
      ['sorted', 'Sorted · por orientación'],
      ['vertical', 'Vertical'],
      ['horizontal', 'Horizontal'],
      ['rectangular', 'Horizontales 4:3'],
      ['square', 'Cuadrícula 1:1'],
      ['polaroid_pro', 'Polaroid editorial']
    ].map(x => option(...x)).join('')}</optgroup>`;
  }

  function buildSectionEditor() {
    const order = orderedContentIds();
    $('sectionEditor').innerHTML = order.map((id, index) => {
      if (id === 'videos') {
        return `<section class="section-editor-card section-editor-video" data-section-card="videos">
          <div class="section-card-head">
            <div class="section-title-tools"><strong>Video</strong><span class="order-badge">${String(index + 1).padStart(2,'0')}</span></div>
            <div class="section-head-actions"><button type="button" class="order-btn" data-sec-up="videos" aria-label="Subir Video" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="order-btn" data-sec-down="videos" aria-label="Bajar Video" ${index === order.length - 1 ? 'disabled' : ''}>↓</button></div>
          </div>
          <p class="hint">Se edita en <b>Multimedia</b>. Puedes colocarlo después de la portada, entre capítulos o hasta el final.</p>
        </section>`;
      }
      const [, fallbackLabel] = sectionDef(id);
      const s = state.sections[id];
      const label = s.label || fallbackLabel;
      return `<section class="section-editor-card" data-section-card="${id}">
        <div class="section-card-head">
          <div class="section-title-tools"><strong data-sec-card-name="${id}">${escapeHtml(label)}</strong><span class="order-badge">${String(index + 1).padStart(2,'0')}</span></div>
          <div class="section-head-actions"><button type="button" class="order-btn" data-sec-up="${id}" aria-label="Subir ${escapeAttr(label)}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="order-btn" data-sec-down="${id}" aria-label="Bajar ${escapeAttr(label)}" ${index === order.length - 1 ? 'disabled' : ''}>↓</button><label class="switch"><input type="checkbox" data-sec-enabled="${id}" ${s.enabled ? 'checked' : ''}> Visible</label></div>
        </div>
        <div class="field-grid two section-layout-row">
          <label>Nombre del capítulo<input type="text" data-sec-label="${id}" value="${escapeAttr(label)}" placeholder="Ej. Ceremonia"></label>
          <label>Título del banner<input type="text" data-sec-title="${id}" value="${escapeAttr(s.title)}"></label>
          <label>Acomodo de fotos<select data-sec-layout="${id}">${layoutOptions(s.layout || 'masonry')}</select><small>Elige la composición de las fotografías de este capítulo.</small></label>
          <label class="gallery-display-control">Cómo mostrar la galería
            <select data-sec-gallery-display="${id}" aria-label="Cómo mostrar la galería de ${escapeAttr(label)}">
              <option value="manual" ${s.galleryDisplay !== 'expanded' ? 'selected' : ''}>Con apertura manual (si hay destacados)</option>
              <option value="expanded" ${s.galleryDisplay === 'expanded' ? 'selected' : ''}>Siempre desplegada · sin botones</option>
            </select>
            <small><b>Con apertura manual:</b> si hay destacados, se muestra un enlace discreto para abrir las fotos; sin destacados, se conserva la galería habitual. <b>Siempre desplegada:</b> todas las fotos son visibles desde el inicio, sin botones de apertura ni de «ver más».</small>
          </label>
        </div>
        <div class="highlight-settings">
          <label class="switch"><input type="checkbox" data-sec-highlights="${id}" ${s.highlightsEnabled ? 'checked' : ''}> Destacados dinámicos bajo la portada</label>
          <small>Seis fotografías verticales (3 × 2) que cambian suavemente cuando hay más imágenes en este capítulo.</small>
        </div>
        <div class="banner-file-row">
          <label class="file-field">Imagen del banner
            <input type="file" accept="image/*" data-sec-file="${id}">
            <span data-sec-filename="${id}">${s.banner?.file?.name ? escapeHtml(s.banner.file.name) : 'Selecciona una fotografía horizontal'}</span>
          </label>
          <div class="banner-preview" data-sec-thumb="${id}" style="${s.banner?.previewUrl ? `background-image:url('${escapeAttr(s.banner.previewUrl)}')` : ''}"></div>
        </div>
        <div class="field-grid two">
          <label>Encuadre X <output data-sec-x-out="${id}">${s.x}%</output><input type="range" min="0" max="100" value="${s.x}" data-sec-x="${id}"></label>
          <label>Encuadre Y <output data-sec-y-out="${id}">${s.y}%</output><input type="range" min="0" max="100" value="${s.y}" data-sec-y="${id}"></label>
        </div>
      </section>`;
    }).join('');

    document.querySelectorAll('[data-sec-up]').forEach(el => el.addEventListener('click', () => moveSection(el.dataset.secUp, -1)));
    document.querySelectorAll('[data-sec-down]').forEach(el => el.addEventListener('click', () => moveSection(el.dataset.secDown, 1)));
    document.querySelectorAll('[data-sec-enabled]').forEach(el => el.addEventListener('change', () => {
      state.sections[el.dataset.secEnabled].enabled = el.checked;
      schedulePreview();
    }));
    document.querySelectorAll('[data-sec-label]').forEach(el => el.addEventListener('input', () => {
      const id = el.dataset.secLabel;
      state.sections[id].label = el.value;
      const name = document.querySelector(`[data-sec-card-name="${id}"]`);
      if (name) name.textContent = el.value || sectionDef(id)[1];
      buildTargetOptions();
      schedulePreview();
    }));
    document.querySelectorAll('[data-sec-title]').forEach(el => el.addEventListener('input', () => {
      state.sections[el.dataset.secTitle].title = el.value;
      schedulePreview();
    }));
    document.querySelectorAll('[data-sec-layout]').forEach(el => el.addEventListener('change', () => {
      state.sections[el.dataset.secLayout].layout = el.value;
      schedulePreview(el.dataset.secLayout, true);
    }));
    document.querySelectorAll('[data-sec-highlights]').forEach(el => el.addEventListener('change', () => {
      const id = el.dataset.secHighlights;
      state.sections[id].highlightsEnabled = el.checked;
      schedulePreview(id, true);
    }));
    document.querySelectorAll('[data-sec-gallery-display]').forEach(el => el.addEventListener('change', () => {
      const id = el.dataset.secGalleryDisplay;
      state.sections[id].galleryDisplay = el.value === 'expanded' ? 'expanded' : 'manual';
      schedulePreview(id, true);
    }));
    document.querySelectorAll('[data-sec-highlight-count]').forEach(el => el.addEventListener('change', () => {
      const id = el.dataset.secHighlightCount;
      state.sections[id].highlightsCount = +el.value || 9;
      schedulePreview(id, true);
    }));
    document.querySelectorAll('[data-sec-x]').forEach(el => el.addEventListener('input', () => {
      const id = el.dataset.secX;
      state.sections[id].x = +el.value;
      document.querySelector(`[data-sec-x-out="${id}"]`).value = `${el.value}%`;
      schedulePreview(id);
    }));
    document.querySelectorAll('[data-sec-y]').forEach(el => el.addEventListener('input', () => {
      const id = el.dataset.secY;
      state.sections[id].y = +el.value;
      document.querySelector(`[data-sec-y-out="${id}"]`).value = `${el.value}%`;
      schedulePreview(id);
    }));
    document.querySelectorAll('[data-sec-file]').forEach(el => el.addEventListener('change', async () => {
      const file = el.files?.[0];
      if (!file) return;
      const id = el.dataset.secFile;
      replaceMedia(state.sections[id], 'banner', await createMediaRecord(file, 1900));
      const fn = document.querySelector(`[data-sec-filename="${id}"]`);
      const thumb = document.querySelector(`[data-sec-thumb="${id}"]`);
      if (fn) fn.textContent = file.name;
      if (thumb) thumb.style.backgroundImage = `url('${state.sections[id].banner.previewUrl}')`;
      schedulePreview(id, true);
    }));
  }

  function moveSection(id, delta) {
    const order = orderedContentIds();
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    state.sectionOrder = order;
    const selectedTarget = $('photoTargetSection')?.value || '';
    buildSectionEditor();
    buildTargetOptions();
    if (selectedTarget && state.sections[selectedTarget]) $('photoTargetSection').value = selectedTarget;
    schedulePreview('', true);
  }

  function buildTargetOptions() {
    $('photoTargetSection').innerHTML = sectionOptions($('photoTargetSection').value || 'getting-ready');
  }

  function bindBaseForm() {
    const bindings = [
      ['galleryStyle', 'style'], ['coverStyle', 'coverStyle'], ['mobileCoverMode', 'mobileCoverMode'], ['revealStyle', 'revealStyle'], ['studioName', 'studioName'], ['accentColor', 'accentColor'], ['backgroundColor', 'backgroundColor'], ['textColor', 'textColor'],
      ['heroEyebrow', 'heroEyebrow'], ['eventTitle', 'title'], ['eventDate', 'date'], ['eventSubtitle', 'subtitle'], ['eventDescription', 'description'],
      ['videosEyebrow', 'videosEyebrow'], ['videosTitle', 'videosTitle'], ['video1', 'video1'], ['video1Label', 'video1Label'], ['video2', 'video2'], ['video2Label', 'video2Label'],
      ['downloadUrl', 'downloadUrl'], ['shareTitle','shareTitle'], ['shareDescription','shareDescription'], ['sharePublicUrl','sharePublicUrl']
    ];
    bindings.forEach(([id, key]) => $(id).addEventListener('input', e => { state[key] = e.target.value; schedulePreview(); }));
    $('brandMode').addEventListener('change', e => { state.brandMode = e.target.value === 'logo' ? 'logo' : 'text'; updateBrandEditor(); schedulePreview(); });
    $('studioLogoFile').addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (String(file.type).toLowerCase() !== 'image/png' && !/\.png$/i.test(file.name || '')) {
        alert('El logo debe ser un archivo PNG.'); e.target.value=''; return;
      }
      replaceStateLogo(await createLogoMediaRecord(file, 1400));
      state.brandMode = 'logo'; $('brandMode').value = 'logo'; updateBrandEditor();
      schedulePreview('', true);
    });
    $('musicFile').addEventListener('change', e => {
      const file = e.target.files?.[0]; if (!file) return;
      replaceStateMusic(file); const guessed=guessTrackInfo(file.name); state.musicTitle=guessed.title; state.musicArtist=guessed.artist; $('musicTitle').value=state.musicTitle; $('musicArtist').value=state.musicArtist; $('musicFileName').textContent = file.name; schedulePreview('', true); void updateTrackFromTags(file);
    });
    $('musicLoop').addEventListener('change', e => { state.musicLoop = e.target.checked; schedulePreview(); });
    $('musicPlayerVisible').addEventListener('change', e => { state.musicPlayerVisible = e.target.checked; schedulePreview('',true); });
    $('musicTitle').addEventListener('input', e => { state.musicTitle = e.target.value; schedulePreview(); });
    $('musicArtist').addEventListener('input', e => { state.musicArtist = e.target.value; schedulePreview(); });
    $('downloadEnabled').addEventListener('change', e => { state.downloadEnabled = e.target.checked; schedulePreview(); });
    $('videosEnabled').addEventListener('change', e => { state.videosEnabled = e.target.checked; schedulePreview(); });
    $('heroX').addEventListener('input', e => { state.heroX = +e.target.value; $('heroXOut').value = `${e.target.value}%`; refreshSharePreview(); schedulePreview('presentacion'); });
    $('heroY').addEventListener('input', e => { state.heroY = +e.target.value; $('heroYOut').value = `${e.target.value}%`; refreshSharePreview(); schedulePreview('presentacion'); });
    $('coverBoxOpacity').addEventListener('input', e => { state.coverBoxOpacity = clamp(+e.target.value, 0, 100); $('coverBoxOpacityOut').value = `${state.coverBoxOpacity}%`; schedulePreview('presentacion'); });
    $('shareImageSource').addEventListener('change', e => { state.shareImageSource=e.target.value; refreshSharePreview(); });
    $('heroFile').addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      replaceStateHero(await createMediaRecord(file, 2000));
      $('heroFileName').textContent = file.name;
      refreshSharePreview();
      schedulePreview('presentacion', true);
    });
    document.querySelectorAll('input[name="imageProfile"]').forEach(r => r.addEventListener('change', e => {
      if (e.target.checked) state.imageProfile = +e.target.value;
    }));
  }

  function replaceMedia(parent, key, media) {
    const old = parent[key];
    if (old?.previewUrl && previewUrls.has(old.previewUrl)) {
      URL.revokeObjectURL(old.previewUrl); previewUrls.delete(old.previewUrl);
    }
    parent[key] = media;
  }
  function replaceStateHero(media) {
    if (state.hero?.previewUrl && previewUrls.has(state.hero.previewUrl)) {
      URL.revokeObjectURL(state.hero.previewUrl); previewUrls.delete(state.hero.previewUrl);
    }
    state.hero = media;
  }
  function replaceStateLogo(media) {
    if (state.studioLogo?.previewUrl && previewUrls.has(state.studioLogo.previewUrl)) {
      URL.revokeObjectURL(state.studioLogo.previewUrl); previewUrls.delete(state.studioLogo.previewUrl);
    }
    state.studioLogo = media;
    updateBrandEditor();
  }

  function guessTrackInfo(filename) {
    const stem = String(filename || '').replace(/\.(mp3|m4a|aac|ogg)$/i, '').replace(/^\s*\d{1,3}[.\s_-]+/, '').replace(/[_]+/g, ' ').trim();
    const bits = stem.split(/\s+[-–—]\s+/).map(x => x.trim()).filter(Boolean);
    return bits.length > 1 ? { title:bits.slice(1).join(' — '), artist:bits[0] } : { title:stem || 'Nuestra música', artist:'Música de la galería' };
  }

  // Lee etiquetas ID3v2 del propio MP3: TIT2 (título), TPE1 (artista).
  // Si no existen, se utiliza el nombre del archivo sin inventar metadatos.
  async function readTrackTags(file) {
    if (!file || !/\.mp3$/i.test(file.name || '')) return {};
    const bytes = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
    if (bytes.length < 14 || String.fromCharCode(...bytes.slice(0, 3)) !== 'ID3') return {};
    const major = bytes[3];
    if (![2, 3, 4].includes(major)) return {};
    const syncSize = at => ((bytes[at] & 127) << 21) | ((bytes[at+1] & 127) << 14) | ((bytes[at+2] & 127) << 7) | (bytes[at+3] & 127);
    const dataEnd = Math.min(bytes.length, 10 + syncSize(6));
    let pos = 10;
    if ((bytes[5] & 0x40) && major === 3 && pos + 4 < dataEnd) pos += 4 + ((bytes[pos] << 24) >>> 0) + (bytes[pos+1] << 16) + (bytes[pos+2] << 8) + bytes[pos+3];
    if ((bytes[5] & 0x40) && major === 4 && pos + 4 < dataEnd) pos += syncSize(pos);
    const readText = b => {
      if (!b.length) return '';
      const encoding = b[0]; let payload = b.slice(1);
      try {
        let decoded = '';
        if (encoding === 1 || encoding === 2) {
          const big = encoding === 2 || (payload[0] === 0xfe && payload[1] === 0xff);
          if (payload[0] === 0xff && payload[1] === 0xfe || payload[0] === 0xfe && payload[1] === 0xff) payload = payload.slice(2);
          decoded = new TextDecoder(big ? 'utf-16be' : 'utf-16le').decode(payload);
        } else decoded = new TextDecoder(encoding === 3 ? 'utf-8' : 'iso-8859-1').decode(payload);
        return decoded.split('\0')[0].trim();
      } catch (_) { return ''; }
    };
    const tags = {};
    while (pos + (major === 2 ? 6 : 10) <= dataEnd) {
      const code = String.fromCharCode(...bytes.slice(pos, pos+(major === 2 ? 3 : 4)));
      if (!/^[A-Z0-9]{3,4}$/.test(code)) break;
      let size, header;
      if (major === 2) { size = (bytes[pos+3] << 16) + (bytes[pos+4] << 8) + bytes[pos+5]; header = 6; }
      else { size = major === 4 ? syncSize(pos+4) : ((bytes[pos+4] << 24) >>> 0) + (bytes[pos+5] << 16) + (bytes[pos+6] << 8) + bytes[pos+7]; header = 10; }
      if (!size || pos + header + size > dataEnd) break;
      if (code === 'TIT2' || code === 'TT2') tags.title = readText(bytes.slice(pos+header, pos+header+size));
      if (code === 'TPE1' || code === 'TP1') tags.artist = readText(bytes.slice(pos+header, pos+header+size));
      if (tags.title && tags.artist) break;
      pos += header + size;
    }
    return tags;
  }

  async function updateTrackFromTags(file, onlyMissing = false) {
    try {
      const tags = await readTrackTags(file);
      if (state.music?.file !== file) return;
      if (tags.title && (!onlyMissing || !state.musicTitle)) state.musicTitle = tags.title;
      if (tags.artist && (!onlyMissing || !state.musicArtist)) state.musicArtist = tags.artist;
      $('musicTitle').value = state.musicTitle;
      $('musicArtist').value = state.musicArtist;
      schedulePreview('', true);
    } catch (err) { console.warn('No se pudieron leer etiquetas del audio:', err); }
  }

  function replaceStateMusic(file) {
    if (state.music?.previewUrl && previewUrls.has(state.music.previewUrl)) {
      URL.revokeObjectURL(state.music.previewUrl); previewUrls.delete(state.music.previewUrl);
    }
    const previewUrl = URL.createObjectURL(file); previewUrls.add(previewUrl);
    const record = { file, previewUrl, backupBlob:null, backupPromise:null };
    state.music = record;
    record.backupPromise = file.arrayBuffer().then(bytes => {
      record.backupBlob = new Blob([bytes], { type:file.type || 'audio/mpeg' });
      return record.backupBlob;
    }).catch(err => {
      console.warn('Gallery Studio: no se pudo respaldar el archivo de música', err);
      return null;
    });
  }
  function updateBrandEditor() {
    const logoMode = state.brandMode === 'logo';
    const controls = $('studioLogoControls');
    if (controls) controls.hidden = !logoMode;
    const nameHint = $('studioNameHint');
    if (nameHint) nameHint.textContent = logoMode ? 'Se usa como nombre accesible y título del sitio.' : 'Se mostrará en la cabecera de la galería.';
    const fn = $('studioLogoFileName');
    if (fn) fn.textContent = state.studioLogo?.file?.name || 'Selecciona un PNG con fondo transparente';
    const img = $('studioLogoPreview');
    if (img) {
      if (state.studioLogo?.previewUrl) { img.src = state.studioLogo.previewUrl; img.hidden = false; }
      else { img.removeAttribute('src'); img.hidden = true; }
    }
  }

  async function decodeForPreview(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
      } catch (_) {}
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => { const el = new Image(); el.onload = () => resolve(el); el.onerror = reject; el.src = url; });
      return { source: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, close: () => URL.revokeObjectURL(url) };
    } catch (e) { URL.revokeObjectURL(url); throw e; }
  }

  async function createLogoMediaRecord(file, maxSide = 1400) {
    // Logos PNG: conservar canal alfa. La vista previa general usa JPEG y fondo blanco,
    // pero eso destruye la transparencia; los logos necesitan una ruta separada.
    let decoded;
    try {
      decoded = await decodeForPreview(file);
      let w = decoded.width, h = decoded.height;
      const max = Math.max(w, h);
      if (max > maxSide) { const s = maxSide / max; w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s)); }
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(decoded.source, 0, 0, w, h);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo crear preview PNG')), 'image/png'));
      canvas.width = 1; canvas.height = 1;
      const previewUrl = URL.createObjectURL(blob); previewUrls.add(previewUrl);
      return { file, previewUrl, previewBlob:blob, width: decoded.width, height: decoded.height, hasAlpha: true };
    } finally { decoded?.close?.(); }
  }

  async function createMediaRecord(file, maxSide = 1700) {
    if (String(file.type).toLowerCase() === 'image/gif') {
      const previewUrl = URL.createObjectURL(file); previewUrls.add(previewUrl);
      return { file, previewUrl, previewBlob:null, width: 0, height: 0 };
    }
    let decoded;
    try {
      decoded = await decodeForPreview(file);
      let w = decoded.width, h = decoded.height;
      const max = Math.max(w, h);
      if (max > maxSide) { const s = maxSide / max; w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s)); }
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(decoded.source, 0, 0, w, h);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo crear preview')), 'image/jpeg', .9));
      canvas.width = 1; canvas.height = 1;
      const previewUrl = URL.createObjectURL(blob); previewUrls.add(previewUrl);
      return { file, previewUrl, previewBlob:blob, width: decoded.width, height: decoded.height };
    } finally { decoded?.close?.(); }
  }

  async function mapLimit(items, limit, worker) {
    const out = new Array(items.length); let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) { const i = next++; if (i >= items.length) break; out[i] = await worker(items[i], i); }
    });
    await Promise.all(runners); return out;
  }

  async function addPhotos(files) {
    const valid = Array.from(files || []).filter(f => String(f.type || '').startsWith('image/'));
    if (!valid.length) return;
    const target = $('photoTargetSection').value || 'getting-ready';
    const box = $('prepStatus'); box.hidden = false; $('prepProgress').max = valid.length; $('prepProgress').value = 0;
    let done = 0;
    const created = await mapLimit(valid, 2, async file => {
      const media = await createMediaRecord(file, 1600);
      done++; $('prepProgress').value = done; $('prepLabel').textContent = `${done} / ${valid.length}`;
      return { id: `p${Date.now().toString(36)}${(++photoSeq).toString(36)}`, file, previewUrl: media.previewUrl, previewBlob:media.previewBlob, width: media.width, height: media.height, section: target, focusX:50, focusY:50, fit:'cover' };
    });
    state.photos.push(...created);
    if ($('photoOrderMode').value === 'name') state.photos.sort((a,b) => a.file.name.localeCompare(b.file.name, 'es', {numeric:true}));
    renderPhotoList();
    refreshSharePreview();
    box.hidden = true;
    schedulePreview(target, true);
  }

  function renderPhotoList() {
    $('photoList').innerHTML = state.photos.map((p, idx) => `<div class="photo-row" data-photo-id="${p.id}">
      <img src="${escapeAttr(p.previewUrl)}" alt="" style="object-position:${clamp(p.focusX ?? 50,0,100)}% ${clamp(p.focusY ?? 50,0,100)}%;object-fit:${p.fit==='contain'?'contain':'cover'}">
      <div class="photo-meta"><strong title="${escapeAttr(p.file.name)}">${escapeHtml(p.file.name)}</strong><select data-photo-section="${p.id}">${sectionOptions(p.section)}</select>
        <details class="photo-frame"><summary>Encuadre</summary><div class="photo-frame-grid">
          <label>Modo<select data-photo-fit="${p.id}"><option value="cover"${p.fit!=='contain'?' selected':''}>Llenar espacio</option><option value="contain"${p.fit==='contain'?' selected':''}>Foto completa</option></select></label>
          <label>X <output data-photo-x-out="${p.id}">${Math.round(p.focusX ?? 50)}%</output><input data-photo-x="${p.id}" type="range" min="0" max="100" value="${clamp(p.focusX ?? 50,0,100)}"></label>
          <label>Y <output data-photo-y-out="${p.id}">${Math.round(p.focusY ?? 50)}%</output><input data-photo-y="${p.id}" type="range" min="0" max="100" value="${clamp(p.focusY ?? 50,0,100)}"></label>
        </div></details>
      </div>
      <div class="photo-actions"><button type="button" class="icon-btn" data-photo-up="${p.id}" ${idx===0?'disabled':''}>↑</button><button type="button" class="icon-btn" data-photo-down="${p.id}" ${idx===state.photos.length-1?'disabled':''}>↓</button><button type="button" class="icon-btn" data-photo-remove="${p.id}">×</button></div>
    </div>`).join('');
    document.querySelectorAll('[data-photo-section]').forEach(el => el.addEventListener('change', () => { const p = state.photos.find(x => x.id === el.dataset.photoSection); if (p) { p.section = el.value; schedulePreview(el.value); } }));
    document.querySelectorAll('[data-photo-fit]').forEach(el => el.addEventListener('change', () => { const p=state.photos.find(x=>x.id===el.dataset.photoFit); if(p){p.fit=el.value; renderPhotoList(); schedulePreview(p.section,true);} }));
    document.querySelectorAll('[data-photo-x]').forEach(el => el.addEventListener('input', () => { const p=state.photos.find(x=>x.id===el.dataset.photoX); if(p){p.focusX=+el.value; const out=document.querySelector(`[data-photo-x-out="${p.id}"]`); if(out)out.value=`${el.value}%`; const thumb=document.querySelector(`[data-photo-id="${p.id}"]>img`); if(thumb)thumb.style.objectPosition=`${p.focusX}% ${p.focusY ?? 50}%`; refreshSharePreview(); schedulePreview(p.section);} }));
    document.querySelectorAll('[data-photo-y]').forEach(el => el.addEventListener('input', () => { const p=state.photos.find(x=>x.id===el.dataset.photoY); if(p){p.focusY=+el.value; const out=document.querySelector(`[data-photo-y-out="${p.id}"]`); if(out)out.value=`${el.value}%`; const thumb=document.querySelector(`[data-photo-id="${p.id}"]>img`); if(thumb)thumb.style.objectPosition=`${p.focusX ?? 50}% ${p.focusY}%`; refreshSharePreview(); schedulePreview(p.section);} }));
    document.querySelectorAll('[data-photo-remove]').forEach(el => el.addEventListener('click', () => removePhoto(el.dataset.photoRemove)));
    document.querySelectorAll('[data-photo-up]').forEach(el => el.addEventListener('click', () => movePhoto(el.dataset.photoUp, -1)));
    document.querySelectorAll('[data-photo-down]').forEach(el => el.addEventListener('click', () => movePhoto(el.dataset.photoDown, 1)));
  }

  function removePhoto(id) {
    const i = state.photos.findIndex(p => p.id === id); if (i < 0) return;
    const [p] = state.photos.splice(i, 1);
    if (p.previewUrl && previewUrls.has(p.previewUrl)) { URL.revokeObjectURL(p.previewUrl); previewUrls.delete(p.previewUrl); }
    renderPhotoList(); refreshSharePreview(); schedulePreview();
  }
  function movePhoto(id, delta) {
    const i = state.photos.findIndex(p => p.id === id), j = i + delta;
    if (i < 0 || j < 0 || j >= state.photos.length) return;
    [state.photos[i], state.photos[j]] = [state.photos[j], state.photos[i]];
    renderPhotoList(); schedulePreview(state.photos[j]?.section);
  }

  function setupDropzone() {
    $('photoFiles').addEventListener('change', e => addPhotos(e.target.files));
    const dz = $('dropzone');
    ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragging'); }));
    ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragging'); }));
    dz.addEventListener('drop', e => addPhotos(e.dataTransfer?.files));
  }

  function currentModel(assetRefs = null) {
    return {
      style: state.style,
      coverStyle: state.coverStyle,
      mobileCoverMode: state.mobileCoverMode,
      coverBoxOpacity: state.coverBoxOpacity,
      revealStyle: state.revealStyle,
      studioName: state.studioName,
      brandMode: state.brandMode,
      studioLogoSrc: assetRefs ? (assetRefs.logo || '') : (state.studioLogo?.previewUrl || ''),
      accentColor: state.accentColor,
      backgroundColor: state.backgroundColor,
      textColor: state.textColor,
      title: state.title,
      shareTitle: state.shareTitle,
      shareDescription: state.shareDescription,
      sharePublicUrl: state.sharePublicUrl,
      heroEyebrow: state.heroEyebrow,
      dateText: formatEventDate(state.date),
      date: state.date,
      subtitle: state.subtitle,
      description: state.description,
      heroSrc: assetRefs ? (assetRefs.hero || '') : (state.hero?.previewUrl || ''),
      heroX: state.heroX, heroY: state.heroY,
      contentOrder: orderedContentIds(),
      sections: orderedSectionIds().map(id => {
        const [, fallbackLabel] = sectionDef(id);
        const s = state.sections[id];
        const label = s.label || fallbackLabel;
        return { id, label, title: s.title, enabled: s.enabled, x: s.x, y: s.y, layout: s.layout || 'masonry', highlightsEnabled: !!s.highlightsEnabled, highlightsCount: 6, galleryDisplay: s.galleryDisplay === 'expanded' ? 'expanded' : 'manual',
          bannerSrc: assetRefs ? (assetRefs.banners[id] || '') : (s.banner?.previewUrl || ''),
          photos: state.photos.filter(p => p.section === id).map(p => ({ id:p.id, name:p.file.name, src: assetRefs ? (assetRefs.photos[p.id] || '') : p.previewUrl, width:p.width || 0, height:p.height || 0, focusX:p.focusX ?? 50, focusY:p.focusY ?? 50, fit:p.fit === 'contain' ? 'contain' : 'cover' }))
        };
      }),
      videosEnabled: state.videosEnabled,
      videosEyebrow: state.videosEyebrow,
      videosTitle: state.videosTitle,
      videos: [
        { url: state.video1, label: state.video1Label || 'Video 1' },
        { url: state.video2, label: state.video2Label || 'Video 2' }
      ].filter(v => v.url),
      musicEnabled: !!state.music,
      musicSrc: assetRefs ? (assetRefs.music || '') : (state.music?.previewUrl || ''),
      musicAutostart: false,
      musicLoop: state.musicLoop !== false,
      musicPlayerVisible: state.musicPlayerVisible !== false,
      musicTitle: state.musicTitle || guessTrackInfo(state.music?.file?.name).title,
      musicArtist: state.musicArtist || guessTrackInfo(state.music?.file?.name).artist,
      downloadEnabled: !!state.downloadEnabled,
      downloadUrl: state.downloadUrl || '',
      batchSize: 15
    };
  }

  function selectedShareImage() {
    if (state.shareImageSource?.startsWith('photo:')) {
      const p=state.photos.find(x=>x.id===state.shareImageSource.slice(6));
      if(p) return { previewUrl:p.previewUrl, blob:p.previewBlob||p.file, x:p.focusX??50, y:p.focusY??50, name:p.file?.name||'Fotografía' };
    }
    if(state.hero) return {previewUrl:state.hero.previewUrl, blob:state.hero.previewBlob||state.hero.file, x:state.heroX, y:state.heroY, name:'Portada principal'};
    const p=state.photos[0];
    return p ? {previewUrl:p.previewUrl,blob:p.previewBlob||p.file,x:p.focusX??50,y:p.focusY??50,name:p.file?.name||'Fotografía'} : null;
  }

  function refreshSharePreview() {
    const sel=$('shareImageSource');
    if(!sel)return;
    const choice=state.shareImageSource||'hero';
    sel.innerHTML='<option value="hero">Portada principal (automático)</option>'+state.photos.map((p,i)=>`<option value="photo:${escapeAttr(p.id)}">Foto ${i+1} · ${escapeHtml(p.file?.name||'Sin nombre')}</option>`).join('');
    if(!Array.from(sel.options).some(o=>o.value===choice)) state.shareImageSource='hero';
    sel.value=state.shareImageSource;
    const record=selectedShareImage(), img=$('sharePreviewImg'), empty=$('sharePreviewPlaceholder');
    img.hidden=!record?.previewUrl;
    if(record?.previewUrl){img.src=record.previewUrl;img.style.objectPosition=`${clamp(record.x,0,100)}% ${clamp(record.y,0,100)}%`;}else{img.removeAttribute('src');}
    empty.hidden=!!record?.previewUrl;
  }

  function absoluteGalleryBase(input) {
    const url=safeExternalUrl(input);
    if(!url)return '';
    const u=new URL(url);u.protocol='https:';u.search='';u.hash='';
    if(!u.pathname.endsWith('/'))u.pathname+='/';
    return u.href;
  }

  function suggestedPagesUrl(owner, repoName) {
    const who=String(owner||'').trim(),repo=String(repoName||'').trim();
    if(!who||!repo)return '';
    return repo.toLowerCase()===`${who.toLowerCase()}.github.io`?`https://${who}.github.io/`:`https://${who}.github.io/${encodeURIComponent(repo)}/`;
  }

  // Usar el dominio y protocolo canónicos de Aura Digital, como PlataformaPro.
  function resolvedGalleryPublicUrl(owner, repoName, candidate='') {
    const who=String(owner||'').trim(),repo=String(repoName||'').trim();
    if(who.toLowerCase()==='auradigitaljal' && repo){
      const isRoot=repo.toLowerCase()===`${who.toLowerCase()}.github.io`;
      return isRoot?'https://auradigitaljal.com/':`https://auradigitaljal.com/${encodeURIComponent(repo)}/`;
    }
    return absoluteGalleryBase(candidate)||suggestedPagesUrl(who,repo);
  }

  async function createSocialImage() {
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Este navegador no permitió crear la miniatura para compartir.');
    const chosen=selectedShareImage();
    let decoded=null;
    try {
      if(chosen?.blob){
        decoded=await decodeForPreview(chosen.blob);
        const iw=decoded.width,ih=decoded.height, ratio=1200/630;
        const cropW=Math.min(iw,ih*ratio),cropH=Math.min(ih,iw/ratio);
        const fx=clamp(chosen.x,0,100)/100,fy=clamp(chosen.y,0,100)/100;
        const sx=(iw-cropW)*fx,sy=(ih-cropH)*fy;
        ctx.drawImage(decoded.source,sx,sy,cropW,cropH,0,0,1200,630);
      }else{
        // Sin portada: imagen neutra y legible en vez de una miniatura rota.
        ctx.fillStyle=state.backgroundColor||'#f5f2ec';ctx.fillRect(0,0,1200,630);
        ctx.fillStyle=state.textColor||'#2f2c28';ctx.textAlign='center';
        ctx.font='56px Georgia,serif';ctx.fillText(String(state.shareTitle||state.title||'Galería fotográfica').slice(0,40),600,332,1050);
      }
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo comprimir la miniatura social.')),'image/jpeg',.82));
      return blob;
    }finally{decoded?.close?.();canvas.width=1;canvas.height=1;}
  }

  function youtubeEmbedUrl(url) {
    const s = String(url || '').trim(); if (!s) return '';
    try {
      const u = new URL(s);
      let id = '';
      if (u.hostname.includes('youtu.be')) id = u.pathname.split('/').filter(Boolean)[0] || '';
      else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || '';
      else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] || '';
      else id = u.searchParams.get('v') || '';
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` : '';
    } catch (_) { return ''; }
  }

  function safeExternalUrl(url) {
    const s = String(url || '').trim();
    if (!s) return '';
    try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; }
  }

  function buildGalleryHtml(m) {
    const sectionById = new Map(m.sections.map(s => [s.id, s]));
    const contentOrder = Array.isArray(m.contentOrder) && m.contentOrder.length ? m.contentOrder : [...m.sections.map(s => s.id), 'videos'];
    const hasVideoBlock = m.videosEnabled && m.videos.some(v => youtubeEmbedUrl(v.url));
    const menuItems = [];
    contentOrder.forEach(id => {
      if (id === 'videos') { if (hasVideoBlock) menuItems.push(`<a href="#videos" data-menu-link><b>${escapeHtml(m.videosTitle || 'Video')}</b></a>`); return; }
      const sec = sectionById.get(id); if (sec?.enabled) menuItems.push(`<a href="#${sec.id}" data-menu-link><b>${escapeHtml(sec.label)}</b></a>`);
    });
    const downloadHref = m.downloadEnabled ? safeExternalUrl(m.downloadUrl) : '';
    if (downloadHref) menuItems.push(`<a class="chapter-download" href="${escapeAttr(downloadHref)}" target="_blank" rel="noopener noreferrer" aria-label="Descargar fotografías"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 17.5v1.25A1.25 1.25 0 0 0 6.25 20h11.5A1.25 1.25 0 0 0 19 18.75V17.5"/></svg><b>Descargar</b></a>`);
    const drawerNav = menuItems.join('');
    const musicTop = m.musicEnabled && m.musicSrc && !m.musicPlayerVisible ? `<button class="top-icon top-music" type="button" data-music-control aria-label="Reproducir música" title="Reproducir música"><span class="audio-note" aria-hidden="true">♪</span><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i></span><b class="sr-only">Reproducir música</b></button>` : '';
    const musicPlayer = m.musicEnabled && m.musicSrc && m.musicPlayerVisible ? `<div class="gallery-player nav-player" role="group" aria-label="Reproductor de música">
      <div class="gallery-player-art" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="gallery-player-main"><div class="gallery-player-heading"><div class="gallery-player-song"><strong title="${escapeAttr(m.musicTitle || 'Nuestra música')}">${escapeHtml(m.musicTitle || 'Nuestra música')}</strong><span title="${escapeAttr(m.musicArtist || 'Música de la galería')}">${escapeHtml(m.musicArtist || 'Música de la galería')}</span></div><button class="gallery-player-mute" type="button" data-music-mute aria-label="Silenciar música" title="Silenciar música"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg></button></div>
      <div class="gallery-player-timeline"><span id="galleryTrackNow">0:00</span><input class="gallery-player-seek" id="galleryTrackSeek" type="range" min="0" max="1000" value="0" aria-label="Avanzar o retroceder canción" style="--progress:0%"><span id="galleryTrackDuration">0:00</span></div></div>
      <button class="gallery-player-play" type="button" data-music-control aria-label="Reproducir música" title="Reproducir música"><svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 10 7-10 7z"/></svg><svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg><b class="sr-only">Reproducir música</b></button>
    </div>` : '';
    const chapters = m.sections.filter(s => s.enabled).map(s => {
      const batchLimit = 15;
      const basePhotos = s.photos.slice();
      const orientationOf = p => p.width && p.height ? (p.width > p.height * 1.15 ? 'landscape' : (p.height > p.width * 1.15 ? 'portrait' : 'squareish')) : 'unknown';
      const orientationRank = { landscape:0, portrait:1, squareish:2, unknown:3 };
      const layoutPhotos = s.layout === 'sorted'
        ? basePhotos.map((p,i)=>({p,i,o:orientationOf(p)})).sort((a,b)=>(orientationRank[a.o] ?? 4)-(orientationRank[b.o] ?? 4) || a.i-b.i).map(x=>x.p)
        : basePhotos;
      // Cada capítulo elige: galería completa visible o apertura manual debajo de destacados.
      const highlightCount = 6;
      const useHighlights = !!s.highlightsEnabled && layoutPhotos.length >= highlightCount;
      const hideGallery = useHighlights && s.galleryDisplay !== 'expanded';
      const showAllPhotos = s.galleryDisplay === 'expanded';
      const extraCount = Math.max(0, layoutPhotos.length - batchLimit);
      const images = layoutPhotos.map((p, i) => {
        const orientation = orientationOf(p);
        const batchExtra = extraCount > 0 && i >= batchLimit && !showAllPhotos ? ' batch-extra batch-hidden' : '';
        return `<button class="photo-tile photo-${orientation}${batchExtra} reveal-target" type="button" data-photo-id="${escapeAttr(p.id)}" data-batch-order="${i}" data-lightbox-src="${escapeAttr(p.src)}" data-lightbox-alt="${escapeAttr(p.name)}" data-photo-index="${i}" data-chapter="${String(i+1).padStart(2,'0')}" style="--fx:${clamp(p.focusX ?? 50,0,100)}%;--fy:${clamp(p.focusY ?? 50,0,100)}%;--fit:${p.fit==='contain'?'contain':'cover'};--ri:${i%6}"><img src="${escapeAttr(p.src)}" alt="${escapeAttr(p.name)}" loading="lazy" decoding="async"></button>`;
      }).join('');
      const landscapes=layoutPhotos.filter(p=>p.width>p.height*1.15).length, portraits=layoutPhotos.filter(p=>p.height>p.width*1.15).length;
      const dominant=landscapes>portraits?'landscape':(portraits>landscapes?'portrait':'mixed');
      const moreControl = extraCount > 0 && !showAllPhotos ? `<button class="gallery-more" type="button" data-gallery-more="grid-${s.id}" data-batch-size="15" data-visible="15" data-total="${layoutPhotos.length}" aria-expanded="false"><span>Ver ${Math.min(15, extraCount)} fotos más</span><i aria-hidden="true"></i></button>` : '';
      // Destacados dinámicos: seis fotografías iniciales debajo de la portada del capítulo.
      // Las demás del MISMO capítulo son la fuente de rotación; la galería completa no cambia.
      const highlightPhotos = useHighlights ? layoutPhotos.slice(0, highlightCount) : [];
      const highlights = useHighlights ? `<div class="highlights-block"><div class="highlights-head"><span>Momentos destacados</span></div><div class="highlights-grid" data-dynamic-highlights data-rotation-enabled="${layoutPhotos.length > highlightCount ? 'true' : 'false'}">${highlightPhotos.map((p,i)=>`<button class="highlight-tile" type="button" data-highlight-photo="${escapeAttr(p.id)}" aria-label="Ver foto destacada ${i+1}" style="--fx:${clamp(p.focusX ?? 50,0,100)}%;--fy:${clamp(p.focusY ?? 50,0,100)}%"><img src="${escapeAttr(p.src)}" alt="${escapeAttr(p.name)}" style="object-position:${clamp(p.focusX ?? 50,0,100)}% ${clamp(p.focusY ?? 50,0,100)}%" loading="lazy" decoding="async"></button>`).join('')}</div>${hideGallery ? `<button class="highlights-open" type="button" data-highlights-open="gallery-wrap-${s.id}" aria-expanded="false"><span>Presiona aquí para ver la galería completa</span><i aria-hidden="true"></i></button>` : ''}</div>` : '';
      const galleryClass = hideGallery ? ' gallery-collapsed' : '';
      return `<section class="chapter" id="${s.id}" data-gallery-layout="${escapeAttr(s.layout || 'masonry')}">
        <div class="chapter-banner reveal-target" style="--x:${clamp(s.x,0,100)}%;--y:${clamp(s.y,0,100)}%">
          ${s.bannerSrc ? `<img src="${escapeAttr(s.bannerSrc)}" alt="" loading="lazy" decoding="async">` : '<div class="banner-placeholder"></div>'}
          <div class="banner-shade"></div><div class="chapter-copy"><small>${escapeHtml(s.label)}</small><h2>${escapeHtml(s.title)}</h2></div>
        </div>
        ${images ? `${highlights}<div id="gallery-wrap-${s.id}" class="gallery-wrap${galleryClass}"><div class="gallery-head"><div><span>Galería de fotos</span><small>${layoutPhotos.length} ${layoutPhotos.length===1?'foto':'fotos'}</small></div></div><div id="grid-${s.id}" class="photo-grid layout-${escapeAttr(s.layout || 'masonry')}${extraCount > 0 && !showAllPhotos ? ' batch-paged' : ''}" data-count="${layoutPhotos.length}" data-dominant="${dominant}">${images}</div>${moreControl}</div>` : '<p class="empty-gallery">Esta sección aún no tiene fotografías.</p>'}
      </section>`;
    }).join('');
    const videoEmbeds = m.videos.map(v => ({ url: youtubeEmbedUrl(v.url), label: v.label })).filter(v => v.url);
    const videos = m.videosEnabled && videoEmbeds.length ? `<section class="videos" id="videos"><div class="section-title"><small>${escapeHtml(m.videosEyebrow || '')}</small><h2>${escapeHtml(m.videosTitle || 'Videos del evento')}</h2></div><div class="video-grid">${videoEmbeds.map((v,i)=>`<div class="video-card"><iframe src="${escapeAttr(v.url)}" title="${escapeAttr(v.label || `Video ${i+1}`)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><span>${escapeHtml(v.label || `Video ${i+1}`)}</span></div>`).join('')}</div></section>` : '';
    const music = m.musicEnabled && m.musicSrc ? `<audio id="bgMusic" src="${escapeAttr(m.musicSrc)}" preload="metadata"${m.musicLoop ? ' loop' : ''}></audio>` : '';
    const heroMedia = m.heroSrc ? `<img src="${escapeAttr(m.heroSrc)}" alt="" decoding="async">` : '<div class="hero-placeholder"></div>';
    const brandHtml = m.brandMode === 'logo' && m.studioLogoSrc
      ? `<div class="sitebrand sitebrand-image"><img class="sitebrand-logo" src="${escapeAttr(m.studioLogoSrc)}" alt="${escapeAttr(m.studioName || 'Estudio')}"></div>`
      : (String(m.studioName || '').trim() ? `<div class="sitebrand sitebrand-text">${escapeHtml(m.studioName)}</div>` : '<div class="sitebrand" aria-hidden="true"></div>');
    const heroEyebrow = String(m.heroEyebrow || '').trim() ? `<small>${escapeHtml(m.heroEyebrow)}</small>` : '';
    const pageTitle = [m.title, m.studioName].filter(Boolean).join(' · ');
    const coverBoxOpacity = clamp(m.coverBoxOpacity ?? 91, 0, 100);
    const coverBoxBorder = clamp(Math.round(coverBoxOpacity * 0.14), 0, 14);
    const coverBoxBlur = (10 * coverBoxOpacity / 91).toFixed(1);
    const supportStrong = (0.58 * (coverBoxOpacity / 100)).toFixed(3);
    const supportMid = (0.20 * (coverBoxOpacity / 100)).toFixed(3);
    const socialTitle=String(m.shareTitle||m.title||'Galería fotográfica').trim();
    const socialDescription=String(m.shareDescription||[m.subtitle,m.description].filter(Boolean).join(' · ')||'Galería fotográfica').trim();
    const socialUrl=absoluteGalleryBase(m.sharePublicUrl);
    const socialImageUrl=socialUrl?new URL('og-preview.jpg',socialUrl).href:'';
    const socialTags=`<meta name="description" content="${escapeAttr(socialDescription)}"><meta property="og:type" content="website"><meta property="og:locale" content="es_MX"><meta property="og:site_name" content="${escapeAttr(m.studioName||'Gallery Studio')}"><meta property="og:title" content="${escapeAttr(socialTitle)}"><meta property="og:description" content="${escapeAttr(socialDescription)}">${socialUrl?`<link rel="canonical" href="${escapeAttr(socialUrl)}"><meta property="og:url" content="${escapeAttr(socialUrl)}"><meta property="og:image" content="${escapeAttr(socialImageUrl)}"><meta property="og:image:secure_url" content="${escapeAttr(socialImageUrl)}"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`:''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeAttr(socialTitle)}"><meta name="twitter:description" content="${escapeAttr(socialDescription)}">${socialImageUrl?`<meta name="twitter:image" content="${escapeAttr(socialImageUrl)}">`:''}`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="${escapeAttr(m.backgroundColor)}"><title>${escapeHtml(pageTitle)}</title>${socialTags}<style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{--accent:${escapeAttr(m.accentColor)};--bg:${escapeAttr(m.backgroundColor)};--ink:${escapeAttr(m.textColor)};margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button{font:inherit}.sitebar{position:sticky;top:0;z-index:70;max-width:none;margin:0;height:62px;padding:0 max(18px,3.2vw);display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:22px;background:var(--bg);transition:background .28s ease,border-color .28s ease,box-shadow .28s ease,backdrop-filter .28s ease;border-bottom:1px solid transparent}.sitebar.is-scrolled{background:color-mix(in srgb,var(--bg) 88%,transparent);border-color:color-mix(in srgb,var(--ink) 10%,transparent);box-shadow:0 8px 28px rgba(20,18,15,.035);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.sitebrand{min-width:0;flex:0 1 auto}.sitebrand-text{font:500 12px Georgia,serif;letter-spacing:.18em;text-transform:uppercase;white-space:nowrap}.sitebrand-image{display:flex;align-items:center;height:100%}.sitebrand-logo{display:block;width:auto;height:auto;max-width:min(220px,28vw);max-height:38px;object-fit:contain;object-position:left center}.site-status{min-width:0;display:flex;align-items:center;justify-content:center;gap:13px;opacity:0;transform:translateY(-3px);transition:opacity .24s ease,transform .24s ease;pointer-events:none}.sitebar.is-scrolled .site-status{opacity:1;transform:none}.current-chapter{font:500 9px/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}.site-progress{display:block;width:76px;height:1px;background:color-mix(in srgb,var(--ink) 14%,transparent);overflow:hidden}.site-progress i{display:block;width:100%;height:100%;background:currentColor;transform:scaleX(0);transform-origin:left center;transition:transform .08s linear}.site-actions{justify-self:end;display:flex;align-items:center;gap:5px}.top-icon{width:42px;height:42px;border:0;border-radius:999px;background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer;opacity:.72;transition:opacity .2s ease,background .2s ease,transform .2s ease}.top-icon:hover{opacity:1;background:color-mix(in srgb,var(--ink) 5%,transparent)}.top-icon:active{transform:scale(.94)}.top-music .audio-note{font:400 17px/1 Georgia,serif}.top-music .audio-bars{display:none;align-items:end;justify-content:center;gap:2px;width:16px;height:16px}.top-music .audio-bars i{width:2px;height:6px;border-radius:2px;background:currentColor;animation:nav-audio .72s ease-in-out infinite alternate}.top-music .audio-bars i:nth-child(2){height:12px;animation-delay:.13s}.top-music .audio-bars i:nth-child(3){height:8px;animation-delay:.26s}.top-music.playing .audio-note{display:none}.top-music.playing .audio-bars{display:flex}@keyframes nav-audio{to{height:14px}}.menu-glyph{width:16px;height:16px;display:grid;grid-template-columns:repeat(2,3px);grid-template-rows:repeat(2,3px);gap:4px;place-content:center}.menu-glyph i{display:block;width:3px;height:3px;border-radius:50%;background:currentColor;transition:transform .22s ease,opacity .22s ease}.menu-toggle[aria-expanded="true"] .menu-glyph i:nth-child(1){transform:translate(1px,1px)}.menu-toggle[aria-expanded="true"] .menu-glyph i:nth-child(2){transform:translate(-1px,1px)}.menu-toggle[aria-expanded="true"] .menu-glyph i:nth-child(3){transform:translate(1px,-1px)}.menu-toggle[aria-expanded="true"] .menu-glyph i:nth-child(4){transform:translate(-1px,-1px)}.chapter-menu{position:fixed;z-index:80;top:54px;right:max(12px,3.2vw);width:min(220px,calc(100vw - 28px));max-height:min(360px,calc(100dvh - 76px));overflow:hidden;background:color-mix(in srgb,var(--bg) 76%,transparent);color:var(--ink);padding:5px;border:1px solid color-mix(in srgb,var(--ink) 8%,transparent);border-radius:14px;box-shadow:0 14px 36px rgba(20,18,15,.075);backdrop-filter:blur(16px) saturate(115%);-webkit-backdrop-filter:blur(16px) saturate(115%);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-5px) scale(.99);transform-origin:top right;transition:opacity .16s ease,transform .16s ease,visibility .16s ease}.chapter-menu::before{content:"CAPÍTULOS";display:block;padding:7px 9px 6px;font:600 6px/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.18em;opacity:.28}.chapter-menu.is-open{opacity:1;visibility:visible;pointer-events:auto;transform:none}.chapter-menu-nav{display:flex;flex-direction:column;overflow:auto;max-height:min(314px,calc(100dvh - 112px));scrollbar-width:none}.chapter-menu-nav::-webkit-scrollbar{display:none}.chapter-menu-nav a{position:relative;display:flex;align-items:center;min-height:34px;padding:6px 9px;color:inherit;text-decoration:none;border-radius:9px;transition:background .16s ease,opacity .16s ease}.chapter-menu-nav a:hover{background:color-mix(in srgb,var(--ink) 5%,transparent)}.chapter-menu-nav a b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 11px/1.15 Inter,ui-sans-serif,sans-serif;letter-spacing:.01em}.chapter-menu-nav a.active{background:color-mix(in srgb,var(--ink) 5%,transparent)}.chapter-menu-nav a.active::after{content:"";position:absolute;right:9px;width:3px;height:3px;border-radius:50%;background:var(--accent)}.chapter-menu-nav a.active b{padding-right:13px}.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.page{width:min(100% - 28px,1450px);margin:0 auto 60px}.hero{position:relative;aspect-ratio:16/7;overflow:hidden;background:#d8d0c4}.hero>img,.chapter-banner>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${clamp(m.heroX,0,100)}% ${clamp(m.heroY,0,100)}%;display:block}.hero-placeholder,.banner-placeholder{position:absolute;inset:0;background:linear-gradient(135deg,#b8ad9d,#e7e0d6)}.hero-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.38),rgba(0,0,0,.05) 60%,rgba(0,0,0,.12))}.hero-copy{position:absolute;z-index:2;left:5.5%;bottom:14%;color:white;max-width:560px}.hero-copy small,.chapter-copy small,.section-title small{display:block;font-size:9px;letter-spacing:.25em;text-transform:uppercase}.hero-copy h1{font:500 clamp(38px,5.5vw,82px)/.95 Georgia,serif;letter-spacing:-.035em;margin:9px 0 10px}.hero-copy .date{font-size:9px;letter-spacing:.21em}.hero-copy p{font:italic 15px/1.55 Georgia,serif;max-width:34ch;margin:20px 0 0}.subnav{display:flex;justify-content:center;gap:26px;overflow:auto;padding:18px 12px 17px;border-bottom:1px solid color-mix(in srgb,var(--ink) 11%,transparent);scrollbar-width:none}.subnav::-webkit-scrollbar{display:none}.subnav a,.subnav .nav-music{text-decoration:none;color:inherit;font:500 10px/1 sans-serif;white-space:nowrap}.chapter{padding-top:18px;scroll-margin-top:20px}.chapter-banner{position:relative;aspect-ratio:16/5;overflow:hidden;background:#d9d0c4}.chapter-banner>img{object-position:var(--x) var(--y)}.banner-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.34),rgba(0,0,0,.03) 72%)}.chapter-copy{position:absolute;z-index:2;left:4.5%;bottom:20%;color:white}.chapter-copy h2{font:500 clamp(28px,4vw,52px)/1 Georgia,serif;margin:7px 0 0}.gallery-head{display:flex;align-items:center;justify-content:space-between;padding:18px 2px 12px}.gallery-head>div{display:flex;align-items:baseline;gap:12px}.gallery-head span{font:500 16px Georgia,serif}.gallery-head small{color:color-mix(in srgb,var(--ink) 50%,transparent);font-size:9px}.photo-grid{gap:5px}.photo-tile{border:0;background:transparent;padding:0;cursor:zoom-in;overflow:hidden}.photo-tile img{width:100%;display:block}.empty-gallery{text-align:center;color:color-mix(in srgb,var(--ink) 50%,transparent);padding:30px;font-size:11px}.videos{padding:48px 0 10px}.section-title{text-align:center;margin-bottom:20px}.section-title h2{font:500 38px/1 Georgia,serif;margin:7px 0}.video-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.video-card{background:color-mix(in srgb,var(--ink) 4%,transparent);padding:8px}.video-card iframe{width:100%;aspect-ratio:16/9;border:0;display:block}.video-card span{display:block;font-size:9px;margin-top:7px}.music-toggle{position:fixed;z-index:40;right:max(16px,env(safe-area-inset-right));bottom:max(16px,calc(env(safe-area-inset-bottom) + 8px));width:44px;height:44px;border:1px solid color-mix(in srgb,var(--ink) 9%,transparent);border-radius:50%;background:color-mix(in srgb,var(--bg) 56%,transparent);color:var(--ink);display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 5px 18px rgba(0,0,0,.045);opacity:.64;transition:transform .2s ease,background .2s ease,opacity .2s ease}.music-toggle.playing{opacity:.78}.music-toggle:hover{opacity:.9}.music-toggle:active{transform:scale(.94);opacity:.88}.music-note{font:400 18px/1 Georgia,serif}.music-bars{display:none;align-items:end;gap:2px;height:14px}.music-bars i{display:block;width:2px;height:5px;background:currentColor;border-radius:2px;animation:music-pulse .8s ease-in-out infinite alternate}.music-bars i:nth-child(2){height:11px;animation-delay:.15s}.music-bars i:nth-child(3){height:8px;animation-delay:.3s}.music-toggle.playing .music-note{display:none}.music-toggle.playing .music-bars{display:flex}@keyframes music-pulse{to{height:13px}}.lightbox{position:fixed;inset:0;z-index:99;background:rgba(14,13,12,.96);display:none;place-items:center;padding:0;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}.lightbox.open{display:grid}.lb-stage{position:absolute;inset:0;display:grid;place-items:center;padding:36px 18px}.lightbox img{max-width:min(96vw,1800px);max-height:92vh;object-fit:contain;will-change:transform,opacity;transform:translate3d(0,0,0);touch-action:none;-webkit-user-drag:none}.lb-close{position:fixed;z-index:3;top:max(16px,env(safe-area-inset-top));right:16px;border:0;background:rgba(255,255,255,.10);color:white;border-radius:50%;width:42px;height:42px;cursor:pointer;font-size:20px;backdrop-filter:blur(10px)}.lb-hint{position:fixed;z-index:2;left:50%;bottom:max(22px,calc(env(safe-area-inset-bottom) + 10px));display:flex;flex-direction:column;align-items:center;gap:8px;transform:translate(-50%,8px);opacity:0;color:rgba(255,255,255,.72);pointer-events:none;transition:opacity .35s ease,transform .35s ease}.lb-hint small{font:500 8px/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.28em;text-transform:uppercase}.lb-hint-line{position:relative;width:58px;height:1px;background:rgba(255,255,255,.20);overflow:hidden}.lb-hint-line::after{content:"";position:absolute;inset:0 auto 0 0;width:18px;background:rgba(255,255,255,.9);transform:translateX(-20px)}.lightbox.hinting .lb-hint{opacity:1;transform:translate(-50%,0)}.lightbox.hinting .lb-hint-line::after{animation:lb-glide 1.15s cubic-bezier(.45,0,.2,1) 2}@keyframes lb-glide{0%{transform:translateX(-20px)}50%{transform:translateX(60px)}100%{transform:translateX(-20px)}}.gallery-more{display:none}
body[data-style="framed"] .page{background:#fff;padding:10px 10px 30px}body[data-style="framed"] .hero{border-radius:26px;border:4px solid white;outline:1px solid rgba(255,255,255,.72);outline-offset:-16px}body[data-style="framed"] .hero-copy{left:50%;bottom:14%;transform:translateX(-50%);text-align:center;width:84%;max-width:none}body[data-style="framed"] .hero-copy h1{font-family:Arial,sans-serif;font-size:clamp(28px,4vw,58px);letter-spacing:.03em;text-transform:uppercase}body[data-style="framed"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,.42),rgba(0,0,0,.06) 62%)}body[data-style="framed"] .chapter-banner{border-radius:18px}
/* Diseños generales adicionales · inspirados en las estructuras editoriales estables de Aura */
body[data-style="minimal"] .page{width:min(100% - 40px,1220px)}body[data-style="minimal"] .hero{margin-top:16px;border:1px solid color-mix(in srgb,var(--ink) 14%,transparent)}body[data-style="minimal"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,.25),rgba(0,0,0,.02) 62%)}body[data-style="minimal"] .hero-copy{left:50%;bottom:7%;transform:translateX(-50%);width:min(64%,650px);max-width:none;padding:18px 24px;background:color-mix(in srgb,var(--bg) ${coverBoxOpacity}%,transparent);color:var(--ink);text-align:center;border:1px solid color-mix(in srgb,var(--ink) ${coverBoxBorder}%,transparent);backdrop-filter:blur(${coverBoxBlur}px);-webkit-backdrop-filter:blur(${coverBoxBlur}px)}body[data-style="minimal"] .hero-copy h1{font-size:clamp(30px,4.8vw,68px)}body[data-style="minimal"] .chapter-banner{border:1px solid color-mix(in srgb,var(--ink) 12%,transparent)}body[data-style="minimal"] .chapter-copy{padding:12px 16px;background:color-mix(in srgb,var(--bg) 82%,transparent);color:var(--ink);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}body[data-style="minimal"] .banner-shade{background:linear-gradient(90deg,rgba(0,0,0,.08),transparent 65%)}
body[data-style="layers"] .page{width:min(100% - 44px,1320px)}body[data-style="layers"] .hero{margin:26px 18px 34px;overflow:visible;box-shadow:0 24px 70px color-mix(in srgb,var(--ink) 14%,transparent);transform:rotate(.45deg)}body[data-style="layers"] .hero::before{content:"";position:absolute;z-index:-1;inset:-16px 7% 14px -14px;background:color-mix(in srgb,var(--accent) 13%,var(--bg));border:1px solid color-mix(in srgb,var(--accent) 24%,transparent);transform:rotate(-2.2deg)}body[data-style="layers"] .hero-copy{left:5%;bottom:8%;max-width:520px;padding:18px 20px;background:color-mix(in srgb,var(--bg) ${coverBoxOpacity}%,transparent);color:var(--ink);border:1px solid color-mix(in srgb,var(--ink) ${coverBoxBorder}%,transparent);transform:rotate(-.45deg);backdrop-filter:blur(${coverBoxBlur}px);-webkit-backdrop-filter:blur(${coverBoxBlur}px)}body[data-style="layers"] .hero-shade{background:linear-gradient(90deg,rgba(0,0,0,.18),transparent 68%)}body[data-style="layers"] .chapter-banner{width:96%;margin:18px 2%;transform:rotate(-.25deg);box-shadow:0 18px 45px color-mix(in srgb,var(--ink) 10%,transparent)}body[data-style="layers"] .chapter:nth-of-type(even) .chapter-banner{transform:rotate(.25deg)}
body[data-style="split"] .hero{background:color-mix(in srgb,var(--bg) 88%,var(--accent));border:1px solid color-mix(in srgb,var(--ink) 10%,transparent)}body[data-style="split"] .hero>img,body[data-style="split"] .hero>.hero-placeholder{width:58%;right:auto}body[data-style="split"] .hero-shade{width:58%;right:auto;background:linear-gradient(90deg,rgba(0,0,0,.28),rgba(0,0,0,.03))}body[data-style="split"] .hero-copy{left:64%;right:5%;bottom:50%;transform:translateY(50%);color:var(--ink);max-width:none}body[data-style="split"] .hero-copy h1{font-size:clamp(32px,4.8vw,70px)}body[data-style="split"] .chapter-banner{display:grid;grid-template-columns:58% 42%;background:color-mix(in srgb,var(--bg) 90%,var(--accent))}body[data-style="split"] .chapter-banner>img,body[data-style="split"] .chapter-banner>.banner-placeholder{width:58%;right:auto}body[data-style="split"] .chapter-banner .banner-shade{width:58%;right:auto}body[data-style="split"] .chapter-copy{left:63%;right:4%;bottom:50%;transform:translateY(50%);color:var(--ink)}body[data-style="split"] .chapter-copy h2{font-size:clamp(24px,3.5vw,46px)}
body[data-style="cinematic"]{background:color-mix(in srgb,var(--ink) 94%,#000);color:color-mix(in srgb,var(--bg) 93%,#fff)}body[data-style="cinematic"] .sitebar{max-width:none;background:color-mix(in srgb,var(--ink) 94%,#000);color:color-mix(in srgb,var(--bg) 93%,#fff);border-bottom:1px solid rgba(255,255,255,.08)}body[data-style="cinematic"] .page{width:min(100% - 24px,1580px)}body[data-style="cinematic"] .subnav{border-color:rgba(255,255,255,.10)}body[data-style="cinematic"] .hero-shade{background:linear-gradient(90deg,rgba(0,0,0,.12),rgba(0,0,0,.10) 45%,rgba(0,0,0,.72))}body[data-style="cinematic"] .hero-copy{left:auto;right:5%;text-align:right;max-width:620px}body[data-style="cinematic"] .hero-copy h1{font-size:clamp(42px,6vw,92px)}body[data-style="cinematic"] .chapter{padding-top:28px}body[data-style="cinematic"] .chapter-banner{border-radius:2px}body[data-style="cinematic"] .banner-shade{background:linear-gradient(90deg,rgba(0,0,0,.12),rgba(0,0,0,.68))}body[data-style="cinematic"] .chapter-copy{left:auto;right:4.5%;text-align:right}body[data-style="cinematic"] .gallery-head small{color:rgba(255,255,255,.55)}body[data-style="cinematic"] .video-card{background:rgba(255,255,255,.05)}
body[data-style="fineart"] .page{width:min(100% - 56px,1280px)}body[data-style="fineart"] .sitebar{max-width:1280px}body[data-style="fineart"] .hero{margin-top:24px}body[data-style="fineart"] .subnav{margin:0 7%;padding-top:22px;padding-bottom:22px}body[data-style="fineart"] .chapter{padding-top:34px}body[data-style="fineart"] .chapter-banner{width:90%;margin-inline:auto}body[data-style="fineart"] .gallery-head{padding:25px 5% 15px}body[data-style="fineart"] .photo-grid{margin-inline:5%}body[data-style="fineart"] .gallery-more{margin-inline:5%;width:90%}body[data-style="fineart"] .highlights-block{padding-left:5%;padding-right:5%}
body[data-style="magazine"] .page{width:min(100% - 28px,1380px)}body[data-style="magazine"] .sitebar{border-bottom:2px solid color-mix(in srgb,var(--ink) 78%,transparent)}body[data-style="magazine"] .hero-copy h1{font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;font-weight:800;letter-spacing:-.065em;line-height:.86}body[data-style="magazine"] .chapter{padding-top:30px}body[data-style="magazine"] .chapter-copy h2{font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;font-weight:800;letter-spacing:-.045em}body[data-style="magazine"] .gallery-head{border-bottom:1px solid color-mix(in srgb,var(--ink) 18%,transparent);margin-bottom:10px}body[data-style="magazine"] .gallery-head span{font-family:Arial,sans-serif;text-transform:uppercase;font-weight:800;letter-spacing:-.02em}
body[data-style="dark"]{background:#11110f;color:#f1eee8}body[data-style="dark"] .sitebar{max-width:none;background:#11110f;color:#f1eee8;border-bottom:1px solid rgba(255,255,255,.10)}body[data-style="dark"] .page{width:min(100% - 28px,1450px)}body[data-style="dark"] .subnav{border-color:rgba(255,255,255,.10)}body[data-style="dark"] .gallery-head small{color:rgba(255,255,255,.52)}body[data-style="dark"] .highlights-open{color:#f1eee8}body[data-style="dark"] .video-card{background:rgba(255,255,255,.055)}body[data-style="dark"] .empty-gallery{color:rgba(255,255,255,.48)}
/* Acomodos por sección · basados en Aura Digital v5.6.4 */
.photo-grid{min-width:0}.photo-tile{min-height:0;position:relative}.photo-tile img{width:100%;height:100%;display:block;object-position:var(--fx,50%) var(--fy,50%);object-fit:var(--fit,cover)}
/* Orgánico: misma fotografía completa del mosaico, pero el número de columnas se adapta al total para no dejar media página vacía. */
.photo-grid.layout-masonry{display:block!important;columns:4 240px;column-gap:5px}.photo-grid.layout-masonry .photo-tile{display:inline-block!important;width:100%!important;height:auto!important;aspect-ratio:auto!important;margin:0 0 5px!important;break-inside:avoid}.photo-grid.layout-masonry .photo-tile img{height:auto!important;object-fit:contain!important}
.photo-grid.layout-masonry[data-count="1"]{columns:1;max-width:980px;margin-inline:auto}.photo-grid.layout-masonry[data-count="2"]{columns:2;max-width:1180px;margin-inline:auto}.photo-grid.layout-masonry[data-count="3"]{columns:3;max-width:1320px;margin-inline:auto}
/* Editorial Aura exacto: portada + dípticos; Aura resuelve el huérfano final haciéndolo horizontal a ancho completo. */
.photo-grid.layout-editorial{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:auto!important;gap:10px!important}.photo-grid.layout-editorial .photo-tile{grid-column:auto;grid-row:auto;aspect-ratio:3/4!important;overflow:hidden}.photo-grid.layout-editorial .photo-tile:nth-child(3n+1){grid-column:1/-1;aspect-ratio:4/5!important}.photo-grid.layout-editorial .photo-tile:last-child:nth-child(3n+2){grid-column:1/-1;aspect-ratio:4/3!important}
/* Carrusel Aura: todos los marcos mantienen la misma caja; no hay huecos por mezclar horizontales y verticales. */
.photo-grid.layout-carousel{display:flex!important;gap:12px!important;overflow-x:auto!important;scroll-snap-type:x mandatory!important;scroll-padding:0!important;scrollbar-width:none!important;padding:0 0 12px!important;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}.photo-grid.layout-carousel::-webkit-scrollbar{display:none}.photo-grid.layout-carousel .photo-tile{flex:0 0 86%!important;aspect-ratio:3/4!important;scroll-snap-align:start!important;overflow:hidden}.photo-grid.layout-carousel[data-dominant="landscape"] .photo-tile{aspect-ratio:4/3!important}
/* Álbum Aura: fotografía completa, una por una, sin recorte. */
.photo-grid.layout-story{display:grid!important;grid-template-columns:1fr!important;gap:22px!important}.photo-grid.layout-story .photo-tile{overflow:visible!important;aspect-ratio:auto!important}.photo-grid.layout-story .photo-tile img{height:auto!important;object-fit:contain!important}
/* Más acomodos · portados del repertorio visual de Aura */
.photo-grid.layout-square{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.photo-grid.layout-square .photo-tile{aspect-ratio:1/1!important}
.photo-grid.layout-rectangular{display:grid!important;grid-template-columns:1fr!important;gap:14px!important}.photo-grid.layout-rectangular .photo-tile{aspect-ratio:4/3!important}
.photo-grid.layout-collage{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:220px!important;gap:9px!important}.photo-grid.layout-collage .photo-tile{height:100%!important;aspect-ratio:auto!important}.photo-grid.layout-collage .photo-tile:nth-child(1){grid-column:1/-1!important;grid-row:span 2!important}.photo-grid.layout-collage .photo-tile:nth-child(4n+2){grid-row:span 2!important}.photo-grid.layout-collage .photo-tile:nth-child(5n){grid-column:1/-1!important}
.photo-grid.layout-filmstrip{display:flex!important;gap:10px!important;overflow-x:auto!important;scroll-snap-type:x mandatory!important;scrollbar-width:none!important;padding:0 0 14px!important;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}.photo-grid.layout-filmstrip::-webkit-scrollbar{display:none}.photo-grid.layout-filmstrip .photo-tile{flex:0 0 72%!important;aspect-ratio:3/4!important;scroll-snap-align:start!important}.photo-grid.layout-filmstrip[data-dominant="landscape"] .photo-tile{aspect-ratio:4/3!important;flex-basis:76%!important}
.photo-grid.layout-narrative{display:flex!important;flex-direction:column!important;gap:30px!important}.photo-grid.layout-narrative .photo-tile{width:88%!important;align-self:flex-start!important;aspect-ratio:auto!important;overflow:visible!important;text-align:left!important}.photo-grid.layout-narrative .photo-tile:nth-child(even){align-self:flex-end!important}.photo-grid.layout-narrative .photo-tile:nth-child(3n+1){width:100%!important}.photo-grid.layout-narrative .photo-tile img{height:auto!important;object-fit:contain!important}.photo-grid.layout-narrative .photo-tile::after{content:"CAPÍTULO " attr(data-chapter);display:flex;align-items:center;gap:10px;margin-top:8px;color:color-mix(in srgb,var(--ink) 56%,transparent);font:500 8px/1.4 Inter,ui-sans-serif,sans-serif;letter-spacing:.18em;text-transform:uppercase}.photo-grid.layout-narrative .photo-tile::before{content:"";position:absolute;left:0;bottom:-13px;width:26px;height:1px;background:var(--accent);opacity:.65}
.photo-grid.layout-polaroid_pro{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px!important;padding:10px!important}.photo-grid.layout-polaroid_pro .photo-tile{aspect-ratio:auto!important;padding:9px 9px 32px!important;background:color-mix(in srgb,var(--bg) 94%,white);border:1px solid color-mix(in srgb,var(--ink) 12%,transparent)!important;box-shadow:0 14px 34px color-mix(in srgb,var(--ink) 10%,transparent)!important;border-radius:2px!important}.photo-grid.layout-polaroid_pro .photo-tile:nth-child(odd){transform:rotate(-1.2deg)!important}.photo-grid.layout-polaroid_pro .photo-tile:nth-child(even){transform:rotate(1.2deg)!important}.photo-grid.layout-polaroid_pro .photo-tile img{aspect-ratio:3/4!important;height:auto!important;object-fit:var(--fit,cover)!important}
/* Nuevos acomodos inspirados en el ritmo editorial de galerías profesionales */
.photo-grid.layout-editorial-pro{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;grid-auto-rows:78px!important;grid-auto-flow:dense;gap:10px!important}.photo-grid.layout-editorial-pro .photo-tile{height:100%!important;aspect-ratio:auto!important}.photo-grid.layout-editorial-pro .photo-tile:nth-child(6n+1){grid-column:1/-1;grid-row:span 7}.photo-grid.layout-editorial-pro .photo-tile:nth-child(6n+2){grid-column:span 6;grid-row:span 8}.photo-grid.layout-editorial-pro .photo-tile:nth-child(6n+3){grid-column:span 6;grid-row:span 8}.photo-grid.layout-editorial-pro .photo-tile:nth-child(6n+4){grid-column:1/-1;grid-row:span 5}.photo-grid.layout-editorial-pro .photo-tile:nth-child(6n+5){grid-column:span 5;grid-row:span 7}.photo-grid.layout-editorial-pro .photo-tile:nth-child(6n){grid-column:span 7;grid-row:span 7}
.photo-grid.layout-organized{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;grid-auto-rows:78px!important;grid-auto-flow:dense;gap:7px!important}.photo-grid.layout-organized .photo-tile{height:100%!important;aspect-ratio:auto!important}.photo-grid.layout-organized .photo-landscape{grid-column:span 6;grid-row:span 4}.photo-grid.layout-organized .photo-portrait{grid-column:span 4;grid-row:span 6}.photo-grid.layout-organized .photo-squareish,.photo-grid.layout-organized .photo-unknown{grid-column:span 4;grid-row:span 4}
.photo-grid.layout-sorted{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;grid-auto-flow:dense;gap:8px!important}.photo-grid.layout-sorted .photo-landscape{grid-column:span 6;aspect-ratio:4/3}.photo-grid.layout-sorted .photo-portrait{grid-column:span 4;aspect-ratio:3/4}.photo-grid.layout-sorted .photo-squareish,.photo-grid.layout-sorted .photo-unknown{grid-column:span 4;aspect-ratio:1/1}
.photo-grid.layout-vertical{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-auto-flow:dense;gap:8px!important}.photo-grid.layout-vertical .photo-tile{aspect-ratio:3/4}.photo-grid.layout-vertical .photo-landscape{grid-column:span 2;aspect-ratio:4/3}.photo-grid.layout-vertical .photo-squareish{aspect-ratio:1/1}
.photo-grid.layout-horizontal{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}.photo-grid.layout-horizontal .photo-tile{aspect-ratio:4/3!important}.photo-grid.layout-horizontal .photo-landscape:nth-child(5n+1){grid-column:1/-1;aspect-ratio:16/9!important}
.photo-grid.layout-scattered{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))!important;grid-auto-rows:64px!important;grid-auto-flow:dense;gap:12px 14px!important;padding:16px 2.5%!important}.photo-grid.layout-scattered .photo-tile{height:100%!important;aspect-ratio:auto!important}.photo-grid.layout-scattered .photo-tile:nth-child(6n+1){grid-column:1/span 7;grid-row:span 8}.photo-grid.layout-scattered .photo-tile:nth-child(6n+2){grid-column:9/span 4;grid-row:span 6;margin-top:28px}.photo-grid.layout-scattered .photo-tile:nth-child(6n+3){grid-column:2/span 4;grid-row:span 6}.photo-grid.layout-scattered .photo-tile:nth-child(6n+4){grid-column:7/span 6;grid-row:span 7;margin-top:18px}.photo-grid.layout-scattered .photo-tile:nth-child(6n+5){grid-column:1/span 5;grid-row:span 7;margin-top:22px}.photo-grid.layout-scattered .photo-tile:nth-child(6n){grid-column:7/span 5;grid-row:span 6}
/* Destacados: una selección compacta antes de abrir la galería larga. */
.highlights-block{padding:24px 0 6px}.highlights-head{display:flex;align-items:baseline;justify-content:center;gap:10px;margin:0 0 14px}.highlights-head span{font:500 19px/1 Georgia,serif}.highlights-head small{font-size:8px;letter-spacing:.16em;text-transform:uppercase;opacity:.52}.highlights-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:82px;grid-auto-flow:dense;gap:7px}.highlight-tile{border:0;padding:0;background:transparent;overflow:hidden;cursor:zoom-in;min-height:0}.highlight-tile img{width:100%;height:100%;display:block;object-fit:cover;object-position:var(--fx,50%) var(--fy,50%)}.highlight-tile:nth-child(6n+1){grid-column:span 8;grid-row:span 6}.highlight-tile:nth-child(6n+2){grid-column:span 4;grid-row:span 3}.highlight-tile:nth-child(6n+3){grid-column:span 4;grid-row:span 3}.highlight-tile:nth-child(6n+4),.highlight-tile:nth-child(6n+5),.highlight-tile:nth-child(6n){grid-column:span 4;grid-row:span 4}.highlights-open{margin:16px auto 6px;min-width:210px;border:0;border-top:1px solid color-mix(in srgb,var(--ink) 16%,transparent);background:transparent;color:inherit;padding:13px 18px 8px;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer;font-size:9px;letter-spacing:.16em;text-transform:uppercase}.highlights-open i{width:8px;height:8px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;transform:rotate(45deg);opacity:.48;transition:transform .25s ease}.highlights-open[aria-expanded="true"] i{transform:rotate(225deg)}.gallery-wrap.gallery-collapsed{display:none}
/* Portadas independientes del diseño general. */
body[data-cover="centered"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,.50),rgba(0,0,0,.05) 70%)}body[data-cover="centered"] .hero-copy{left:50%;right:auto;bottom:11%;transform:translateX(-50%);width:min(88%,820px);max-width:none;text-align:center;color:white}body[data-cover="centered"] .hero-copy h1{font-size:clamp(38px,6vw,88px)}
body[data-cover="split"] .hero{background:color-mix(in srgb,var(--bg) 90%,var(--accent));border:1px solid color-mix(in srgb,var(--ink) 10%,transparent)}body[data-cover="split"] .hero>img,body[data-cover="split"] .hero>.hero-placeholder{width:62%;right:auto}body[data-cover="split"] .hero-shade{width:62%;right:auto;background:linear-gradient(90deg,rgba(0,0,0,.20),rgba(0,0,0,.03))}body[data-cover="split"] .hero-copy{left:67%;right:5%;bottom:50%;transform:translateY(50%);color:var(--ink);max-width:none;text-align:left}body[data-cover="split"] .hero-copy h1{font-size:clamp(34px,4.6vw,72px)}
body[data-cover="fineart"] .hero{margin:20px 2.5%;width:95%;outline:1px solid color-mix(in srgb,var(--ink) 22%,transparent);outline-offset:10px}body[data-cover="fineart"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,.42),rgba(0,0,0,.02) 65%)}body[data-cover="fineart"] .hero-copy{left:50%;bottom:8%;transform:translateX(-50%);text-align:center;width:min(86%,760px);max-width:none}body[data-cover="fineart"] .hero-copy h1{font-size:clamp(34px,5.3vw,76px);font-weight:400}
/* Entradas de fotos. */
body[data-reveal="soft"] .reveal-target,body[data-reveal="editorial"] .reveal-target{opacity:0;will-change:transform,opacity;transition:opacity .65s ease,transform .72s cubic-bezier(.2,.75,.2,1);transition-delay:calc(var(--ri,0)*45ms)}body[data-reveal="soft"] .reveal-target{transform:translateY(14px)}body[data-reveal="editorial"] .reveal-target{transform:translateY(22px) scale(.992)}body[data-reveal="soft"] .reveal-target.revealed,body[data-reveal="editorial"] .reveal-target.revealed{opacity:1;transform:none}
.photo-grid.batch-paged .batch-hidden{display:none!important}.gallery-more{width:100%;margin:18px 0 6px;padding:16px 8px 11px;border:0;border-top:1px solid color-mix(in srgb,var(--ink) 14%,transparent);background:transparent;color:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;cursor:pointer}.gallery-more span{font:500 9px/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.15em;text-transform:uppercase;opacity:.65}.gallery-more i{width:18px;height:18px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;transform:rotate(45deg);opacity:.38;transition:transform .28s ease,opacity .28s ease}.gallery-more.expanded i{transform:rotate(225deg);opacity:.55}@media(max-width:760px){.chapter-menu{top:50px;right:10px;width:min(188px,calc(100vw - 24px));max-height:min(286px,calc(100dvh - 68px));padding:4px;background:color-mix(in srgb,var(--bg) 66%,transparent);border-color:color-mix(in srgb,var(--ink) 7%,transparent);border-radius:12px;box-shadow:0 10px 28px rgba(20,18,15,.055);backdrop-filter:blur(14px) saturate(112%);-webkit-backdrop-filter:blur(14px) saturate(112%)}.chapter-menu::before{display:none}.chapter-menu-nav{max-height:min(278px,calc(100dvh - 76px))}.chapter-menu-nav a{min-height:30px;padding:5px 8px;border-radius:8px}.chapter-menu-nav a b{font-size:10px;letter-spacing:.015em}.chapter-menu-nav a.active{background:color-mix(in srgb,var(--ink) 4%,transparent)}.chapter-menu-nav a.active::after{right:8px;width:3px;height:3px}.chapter-menu-nav a.active b{padding-right:11px}.gallery-more{margin:13px 0 4px;padding:15px 8px 10px}.sitebar{height:54px;padding:0 10px 0 14px;grid-template-columns:minmax(0,1fr) auto auto;gap:8px}.sitebrand-text{font-size:9px;letter-spacing:.14em}.sitebrand-logo{max-width:112px;max-height:27px}.site-status{justify-content:flex-end;gap:8px}.current-chapter{font-size:7px;letter-spacing:.13em;max-width:94px}.site-progress{width:34px}.site-actions{gap:0}.top-icon{width:38px;height:38px}.page{width:calc(100% - 16px);margin-bottom:30px}.hero{aspect-ratio:16/7}.hero-copy{left:5%;bottom:12%}.hero-copy h1{font-size:clamp(25px,9vw,48px)}.hero-copy p{display:none}.subnav{justify-content:flex-start;gap:18px;padding:14px 6px}.chapter{padding-top:10px}.chapter-banner{aspect-ratio:16/5}.chapter-copy h2{font-size:clamp(22px,7vw,36px)}.gallery-head{padding-top:13px}.video-grid{grid-template-columns:1fr}.lb-stage{padding:18px 8px}.lightbox img{max-width:100vw;max-height:94dvh}.photo-grid.layout-masonry{columns:2 150px;column-gap:4px}.photo-grid.layout-masonry[data-count="1"]{columns:1}.photo-grid.layout-masonry .photo-tile{margin-bottom:4px!important}.photo-grid.layout-editorial{gap:7px!important}.photo-grid.layout-carousel{gap:10px!important}.photo-grid.layout-carousel .photo-tile{flex-basis:86%!important}.photo-grid.layout-carousel[data-dominant="landscape"] .photo-tile{aspect-ratio:4/3!important}.photo-grid.layout-story{gap:16px!important}.photo-grid.layout-square{gap:4px!important}.photo-grid.layout-rectangular{gap:9px!important}.photo-grid.layout-collage{grid-auto-rows:118px!important;gap:6px!important}.photo-grid.layout-filmstrip{gap:9px!important}.photo-grid.layout-filmstrip .photo-tile{flex-basis:84%!important}.photo-grid.layout-filmstrip[data-dominant="landscape"] .photo-tile{flex-basis:88%!important}.photo-grid.layout-narrative{gap:22px!important}.photo-grid.layout-narrative .photo-tile{width:91%!important}.photo-grid.layout-polaroid_pro{gap:10px!important;padding:5px!important}.photo-grid.layout-polaroid_pro .photo-tile{padding:6px 6px 23px!important}body[data-style="framed"] .page{padding:6px 6px 24px}body[data-style="framed"] .hero{border-radius:18px;outline-offset:-10px;border-width:2px}body[data-style="minimal"] .page{width:calc(100% - 18px)}body[data-style="minimal"] .hero-copy{width:88%;padding:9px 12px;bottom:7%}body[data-style="minimal"] .hero-copy h1{font-size:clamp(22px,7vw,38px)}body[data-style="minimal"] .chapter-copy{padding:7px 10px}body[data-style="layers"] .page{width:calc(100% - 18px)}body[data-style="layers"] .hero{margin:18px 8px 24px}body[data-style="layers"] .hero::before{inset:-9px 6% 9px -7px}body[data-style="layers"] .hero-copy{left:4%;bottom:6%;padding:9px 11px;max-width:74%}body[data-style="split"] .hero>img,body[data-style="split"] .hero>.hero-placeholder,body[data-style="split"] .hero-shade{width:100%}body[data-style="split"] .hero-copy{left:5%;right:5%;bottom:12%;transform:none;color:white}body[data-style="split"] .chapter-banner{display:block;background:#d9d0c4}body[data-style="split"] .chapter-banner>img,body[data-style="split"] .chapter-banner>.banner-placeholder,body[data-style="split"] .chapter-banner .banner-shade{width:100%}body[data-style="split"] .chapter-copy{left:4.5%;right:auto;bottom:20%;transform:none;color:white}body[data-style="cinematic"] .page{width:calc(100% - 12px)}body[data-style="cinematic"] .hero-copy{left:5%;right:5%;bottom:12%;text-align:right}.photo-grid.layout-editorial-pro{grid-auto-rows:42px!important;gap:6px!important}.photo-grid.layout-organized{grid-auto-rows:48px!important;gap:5px!important}.photo-grid.layout-organized .photo-landscape{grid-column:span 12;grid-row:span 5}.photo-grid.layout-organized .photo-portrait{grid-column:span 6;grid-row:span 7}.photo-grid.layout-organized .photo-squareish,.photo-grid.layout-organized .photo-unknown{grid-column:span 6;grid-row:span 5}.photo-grid.layout-sorted .photo-landscape{grid-column:span 12}.photo-grid.layout-sorted .photo-portrait,.photo-grid.layout-sorted .photo-squareish,.photo-grid.layout-sorted .photo-unknown{grid-column:span 6}.photo-grid.layout-vertical{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important}.photo-grid.layout-vertical .photo-landscape{grid-column:span 2}.photo-grid.layout-horizontal{grid-template-columns:1fr!important;gap:7px!important}.photo-grid.layout-horizontal .photo-landscape:nth-child(5n+1){grid-column:auto}.photo-grid.layout-scattered{grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:auto!important;gap:8px!important;padding:8px 0!important}.photo-grid.layout-scattered .photo-tile{grid-column:auto!important;grid-row:auto!important;margin:0!important;aspect-ratio:3/4!important}.photo-grid.layout-scattered .photo-landscape{grid-column:1/-1!important;aspect-ratio:4/3!important}.highlights-block{padding-top:18px}.highlights-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:auto;gap:5px}.highlight-tile{grid-column:auto!important;grid-row:auto!important;aspect-ratio:3/4}.highlight-tile:first-child{grid-column:1/-1!important;aspect-ratio:4/3}.highlight-tile.h-landscape{aspect-ratio:4/3}.highlights-open{width:100%;min-width:0}.gallery-wrap.gallery-collapsed{display:none}body[data-cover="split"] .hero>img,body[data-cover="split"] .hero>.hero-placeholder,body[data-cover="split"] .hero-shade{width:100%}body[data-cover="split"] .hero-copy{left:5%;right:5%;bottom:12%;transform:none;color:white}body[data-cover="fineart"] .hero{margin:12px 3.5%;width:93%;outline-offset:5px}}
/* v1.3.3 · Portadas móviles diseñadas como composiciones propias, no encogidas. */
@media(max-width:760px){
  .hero{aspect-ratio:4/5;min-height:0}
  .hero>img,.hero>.hero-placeholder,.hero-shade{width:100%;height:100%;inset:0}
  .hero-copy{left:6%;right:6%;bottom:7%;max-width:none;width:auto;transform:none;text-align:left;color:white}
  .hero-copy small{font-size:8px;letter-spacing:.22em}
  .hero-copy h1{font-size:clamp(28px,9.4vw,44px);line-height:.94;margin:7px 0 8px;overflow-wrap:anywhere}
  .hero-copy .date{font-size:8px;letter-spacing:.18em}
  .hero-copy p{display:none}

  /* Portada centrada: fotografía dominante y placa tipográfica, sin bloque pesado. */
  body[data-cover="centered"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,.48),rgba(0,0,0,.03) 62%)}
  body[data-cover="centered"] .hero-copy{left:9%;right:9%;bottom:8%;width:auto;transform:none;text-align:center;color:white}
  body[data-cover="centered"] .hero-copy h1{font-size:clamp(29px,10vw,46px)}

  /* Doble panel móvil real: 68% fotografía + 32% bloque editorial. */
  body[data-cover="split"] .hero{background:color-mix(in srgb,var(--bg) 88%,var(--accent));border:1px solid color-mix(in srgb,var(--ink) 10%,transparent)}
  body[data-cover="split"] .hero>img,body[data-cover="split"] .hero>.hero-placeholder{left:0;top:0;right:auto;bottom:auto;width:100%;height:68%;object-fit:cover}
  body[data-cover="split"] .hero-shade{left:0;top:0;right:auto;bottom:auto;width:100%;height:68%;background:linear-gradient(to top,rgba(0,0,0,.18),rgba(0,0,0,.02) 62%)}
  body[data-cover="split"] .hero-copy{left:8%;right:8%;top:72%;bottom:auto;width:auto;max-width:none;transform:none;text-align:left;color:var(--ink)}
  body[data-cover="split"] .hero-copy h1{font-size:clamp(25px,8.5vw,40px);line-height:.95;margin:6px 0 7px}

  /* Fine Art: el marco respira; no aparece una caja de color sobre la foto. */
  body[data-cover="fineart"] .hero{margin:18px 4.5% 24px;width:91%;outline-offset:6px}
  body[data-cover="fineart"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,.40),rgba(0,0,0,.01) 58%)}
  body[data-cover="fineart"] .hero-copy{left:10%;right:10%;bottom:7%;width:auto;transform:none;text-align:center;color:white}
  body[data-cover="fineart"] .hero-copy h1{font-size:clamp(28px,9vw,42px)}

  /* Minimal: el rectángulo se vuelve una tarjeta compacta en el tercio inferior. */
  body[data-style="minimal"] .hero{margin-top:10px}
  body[data-style="minimal"] .hero-copy{left:50%;right:auto;bottom:6%;width:min(78%,340px);max-width:340px;max-height:34%;transform:translateX(-50%);padding:11px 14px;text-align:center;overflow:hidden}
  body[data-style="minimal"] .hero-copy h1{font-size:clamp(23px,7.6vw,36px);line-height:.96;margin:6px 0 7px}

  /* Capas: panel angosto y desplazado; siempre deja visible buena parte de la foto. */
  body[data-style="layers"] .hero{margin:16px 8px 26px;transform:rotate(.25deg)}
  body[data-style="layers"] .hero::before{inset:-8px 8% 9px -6px;transform:rotate(-1.2deg)}
  body[data-style="layers"] .hero-copy{left:6%;right:auto;bottom:6%;width:min(70%,330px);max-width:330px;max-height:34%;padding:11px 14px;transform:rotate(-.25deg);overflow:hidden;text-align:left}
  body[data-style="layers"] .hero-copy h1{font-size:clamp(23px,7.5vw,35px);line-height:.96;margin:6px 0 7px}

  /* Doble panel como diseño general mantiene su identidad si la portada no usa otro patrón. */
  body[data-style="split"] .hero>img,body[data-style="split"] .hero>.hero-placeholder{left:0;top:0;right:auto;bottom:auto;width:100%;height:68%;object-fit:cover}
  body[data-style="split"] .hero-shade{left:0;top:0;right:auto;bottom:auto;width:100%;height:68%;background:linear-gradient(to top,rgba(0,0,0,.18),rgba(0,0,0,.02) 62%)}
  body[data-style="split"] .hero-copy{left:8%;right:8%;top:72%;bottom:auto;width:auto;transform:none;color:var(--ink);text-align:left}
  body[data-style="split"] .hero-copy h1{font-size:clamp(25px,8.5vw,40px)}

  /* Cinemática: texto sobre degradado, sin rectángulo. */
  body[data-style="cinematic"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,.68),rgba(0,0,0,.03) 62%)}
  body[data-style="cinematic"] .hero-copy{left:7%;right:7%;bottom:7%;top:auto;width:auto;transform:none;text-align:right;color:white}
  body[data-style="cinematic"] .hero-copy h1{font-size:clamp(31px,10vw,48px)}

  /* El estilo de portada manda sobre el estilo general cuando ambos modifican la composición. */
  body[data-cover="split"] .hero>img,body[data-cover="split"] .hero>.hero-placeholder{width:100%;height:68%}
  body[data-cover="split"] .hero-shade{width:100%;height:68%}
  body[data-cover="split"] .hero-copy{left:8%;right:8%;top:72%;bottom:auto;width:auto;max-height:none;padding:0;background:transparent;border:0;backdrop-filter:none;-webkit-backdrop-filter:none;transform:none;color:var(--ink);text-align:left}
  body[data-cover="split"] .hero-copy h1{font-size:clamp(25px,8.5vw,40px)}

  body[data-cover="centered"] .hero>img,body[data-cover="centered"] .hero>.hero-placeholder,body[data-cover="centered"] .hero-shade{inset:0;width:100%;height:100%}
  body[data-cover="centered"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,.48),rgba(0,0,0,.03) 62%)}
  body[data-cover="centered"] .hero-copy{left:9%;right:9%;top:auto;bottom:8%;width:auto;max-width:none;max-height:none;padding:0;background:transparent;border:0;backdrop-filter:none;-webkit-backdrop-filter:none;transform:none;text-align:center;color:white}

  body[data-cover="fineart"] .hero{margin:18px 4.5% 24px;width:91%;outline-offset:6px}
  body[data-cover="fineart"] .hero>img,body[data-cover="fineart"] .hero>.hero-placeholder,body[data-cover="fineart"] .hero-shade{inset:0;width:100%;height:100%}
  body[data-cover="fineart"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,.40),rgba(0,0,0,.01) 58%)}
  body[data-cover="fineart"] .hero-copy{left:10%;right:10%;top:auto;bottom:7%;width:auto;max-width:none;max-height:none;padding:0;background:transparent;border:0;backdrop-filter:none;-webkit-backdrop-filter:none;transform:none;text-align:center;color:white}
}
/* Portada móvil v1.3.4: no todo se fuerza a vertical. Clásica y Fine Art conservan marco horizontal en modo “Según el diseño”. */
@media(max-width:760px){
  body[data-mobile-cover="horizontal"] .hero,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero,
  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero{aspect-ratio:16/7!important;min-height:0!important;height:auto!important;overflow:hidden}
  body[data-mobile-cover="horizontal"] .hero>img,
  body[data-mobile-cover="horizontal"] .hero>.hero-placeholder,
  body[data-mobile-cover="horizontal"] .hero>.hero-shade,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero>img,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero>.hero-placeholder,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero>.hero-shade,
  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero>img,
  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero>.hero-placeholder,
  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero>.hero-shade{position:absolute!important;inset:0!important;width:100%!important;height:100%!important}
  body[data-mobile-cover="horizontal"] .hero-copy,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero-copy{left:5%!important;right:auto!important;top:auto!important;bottom:9%!important;width:min(72%,290px)!important;max-width:none!important;max-height:78%!important;padding:0!important;transform:none!important;text-align:left!important;color:#fff!important;background:transparent!important;border:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:hidden}
  body[data-mobile-cover="horizontal"] .hero-copy h1,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero-copy h1{font-size:clamp(20px,7vw,34px)!important;line-height:.92!important;margin:3px 0 4px!important}
  body[data-mobile-cover="horizontal"] .hero-copy small,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero-copy small{font-size:6px!important;letter-spacing:.18em!important}
  body[data-mobile-cover="horizontal"] .hero-copy .date,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero-copy .date{font-size:7px!important;letter-spacing:.10em!important}
  body[data-mobile-cover="horizontal"] .hero-copy p,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero-copy p{display:none!important}

  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero{width:92%!important;margin:18px 4% 24px!important;outline-offset:5px!important}
  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero-copy{left:8%!important;right:8%!important;top:auto!important;bottom:8%!important;width:auto!important;max-width:none!important;max-height:76%!important;padding:0!important;transform:none!important;text-align:center!important;color:#fff!important;background:transparent!important;border:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:hidden}
  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero-copy h1{font-size:clamp(19px,6.5vw,32px)!important;line-height:.94!important;margin:3px 0 4px!important}
  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero-copy p{display:none!important}

  /* Si el usuario fuerza horizontal, Minimal y Capas mantienen su placa pero compacta. */
  body[data-mobile-cover="horizontal"][data-style="minimal"] .hero-copy{left:50%!important;right:auto!important;bottom:7%!important;width:min(72%,270px)!important;padding:7px 10px!important;transform:translateX(-50%)!important;text-align:center!important;color:var(--ink)!important;background:color-mix(in srgb,var(--bg) ${coverBoxOpacity}%,transparent)!important;border:1px solid color-mix(in srgb,var(--ink) ${coverBoxBorder}%,transparent)!important;backdrop-filter:blur(${coverBoxBlur}px)!important;-webkit-backdrop-filter:blur(${coverBoxBlur}px)!important}
  body[data-mobile-cover="horizontal"][data-style="layers"] .hero-copy{left:5%!important;right:auto!important;bottom:7%!important;width:min(68%,255px)!important;padding:7px 9px!important;transform:none!important;text-align:left!important;color:var(--ink)!important;background:color-mix(in srgb,var(--bg) ${coverBoxOpacity}%,transparent)!important;border:1px solid color-mix(in srgb,var(--ink) ${coverBoxBorder}%,transparent)!important;backdrop-filter:blur(${coverBoxBlur}px)!important;-webkit-backdrop-filter:blur(${coverBoxBlur}px)!important}

  /* Adaptada fuerza la composición móvil de v1.3.3 incluso en Clásica/Fine Art. */
  body[data-mobile-cover="adaptive"] .hero{aspect-ratio:4/5!important}
  body[data-mobile-cover="adaptive"][data-cover="fineart"] .hero{width:91%!important;margin:18px 4.5% 24px!important;outline-offset:6px!important}
}

/* v1.3.6 · Responsive predecible: el contenido nunca desaparece entre escritorio y móvil. */
@media(max-width:760px){
  /* La portada conserva TODO el texto introducido. Solo cambia escala y flujo. */
  .hero-copy{max-height:none!important;overflow:visible!important;min-width:0}
  .hero-copy small,.hero-copy .date,.hero-copy h1,.hero-copy p{max-width:100%;overflow-wrap:break-word;word-break:normal}
  .hero-copy p{display:block!important;font-size:clamp(8px,2.45vw,11px)!important;line-height:1.35!important;margin:7px 0 0!important;max-width:34ch!important}
  body[data-cover="centered"] .hero-copy p,body[data-cover="fineart"] .hero-copy p{margin-left:auto!important;margin-right:auto!important}
  body[data-style="cinematic"] .hero-copy p{margin-left:auto!important}

  /* Las cajas nunca recortan texto. Si el contenido crece, crece la caja; la opacidad sigue siendo editable. */
  body[data-style="minimal"] .hero-copy,body[data-style="layers"] .hero-copy,
  body[data-mobile-cover="horizontal"][data-style="minimal"] .hero-copy,
  body[data-mobile-cover="horizontal"][data-style="layers"] .hero-copy{max-height:none!important;overflow:visible!important}

  /* En portada horizontal se conserva el marco y se compacta la tipografía sin eliminar subtítulo/descripción. */
  body[data-mobile-cover="horizontal"] .hero-copy p,
  body[data-mobile-cover="mixed"][data-cover="classic"] .hero-copy p,
  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero-copy p{display:block!important;font-size:clamp(7px,2.05vw,9px)!important;line-height:1.22!important;margin-top:4px!important;max-width:29ch!important}
  body[data-mobile-cover="mixed"][data-cover="fineart"] .hero-copy p{margin-left:auto!important;margin-right:auto!important}

  /* Los banners de capítulos sí tienen composición móvil propia: pasan de 16:5 a 16:9. */
  .chapter-banner{aspect-ratio:16/9!important;min-height:0!important;overflow:hidden!important}
  .chapter-banner>img,.chapter-banner>.banner-placeholder,.chapter-banner>.banner-shade{position:absolute!important;inset:0!important;width:100%!important;height:100%!important}
  .chapter-copy{left:6%!important;right:6%!important;bottom:10%!important;top:auto!important;max-width:88%!important;width:auto!important;transform:none!important;overflow:visible!important}
  .chapter-copy small{font-size:clamp(7px,2vw,9px)!important;letter-spacing:.20em!important;line-height:1.25!important;overflow-wrap:break-word}
  .chapter-copy h2{font-size:clamp(25px,8.2vw,39px)!important;line-height:.98!important;margin:5px 0 0!important;max-width:100%!important;overflow-wrap:break-word;word-break:normal}

  /* Minimal conserva su placa, pero con tamaño gobernado por el texto y no por una altura rígida. */
  body[data-style="minimal"] .chapter-copy{left:5%!important;right:auto!important;bottom:8%!important;max-width:82%!important;padding:9px 12px!important}
  body[data-style="layers"] .chapter-copy{max-width:78%!important}
  body[data-style="cinematic"] .chapter-copy{left:auto!important;right:6%!important;text-align:right!important;max-width:82%!important}

  /* Doble panel no transforma los banners de capítulos: solo afecta la portada. */
  body[data-style="split"] .chapter-banner>img,body[data-style="split"] .chapter-banner>.banner-placeholder,body[data-style="split"] .chapter-banner .banner-shade{width:100%!important;height:100%!important}
  body[data-style="split"] .chapter-copy{left:6%!important;right:6%!important;bottom:10%!important;color:white!important;text-align:left!important}
}
@media(prefers-reduced-motion:reduce){.lightbox.hinting .lb-hint-line::after,.music-bars i{animation:none}.lb-hint,.gallery-more i,.reveal-target{transition:none!important}.reveal-target{opacity:1!important;transform:none!important}}

/* v1.4.1 · Menú móvil ultracompacto y translúcido */
body[data-style="cinematic"] .sitebar,body[data-style="dark"] .sitebar{max-width:none}body[data-style="fineart"] .sitebar{max-width:none}body[data-style="magazine"] .sitebar{border-bottom-width:1px}.sitebrand{justify-self:start}.chapter-menu-nav a:focus-visible,.top-icon:focus-visible,.menu-close:focus-visible{outline:1px solid var(--accent);outline-offset:3px}
@media(max-width:760px){.sitebar:not(.is-scrolled) .site-status{display:none}.sitebar.is-scrolled{grid-template-columns:minmax(0,1fr) auto auto}.sitebar.is-scrolled .sitebrand-image .sitebrand-logo{max-width:92px}.sitebar.is-scrolled .sitebrand-text{max-width:92px;overflow:hidden;text-overflow:ellipsis}.chapter-menu-head{padding-top:8px}.chapter-menu-nav{padding-top:16px}}

/* v1.4.2 · Navegación única debajo de la portada */
.sitebar{position:sticky;top:0;z-index:70;height:58px;margin:0;padding:0 16px;display:grid;grid-template-columns:minmax(120px,1fr) minmax(260px,2.2fr) minmax(120px,1fr);align-items:center;gap:14px;background:color-mix(in srgb,var(--bg) 92%,transparent);border-top:1px solid color-mix(in srgb,var(--ink) 8%,transparent);border-bottom:1px solid color-mix(in srgb,var(--ink) 8%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:none}
.sitebar.is-scrolled{background:color-mix(in srgb,var(--bg) 84%,transparent);box-shadow:0 8px 28px rgba(20,18,15,.035)}
.sitebrand{justify-self:start;overflow:hidden}.sitebrand-text{display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;font-size:10px;letter-spacing:.15em}.sitebrand-logo{max-width:150px;max-height:30px}
.chapter-strip{min-width:0;height:100%;display:flex;align-items:center;justify-content:center;gap:20px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-inline:contain;scroll-snap-type:x proximity;padding:0 4px}.chapter-strip::-webkit-scrollbar{display:none}.chapter-strip a{position:relative;flex:0 0 auto;display:flex;align-items:center;height:100%;padding:0 1px;color:inherit;text-decoration:none;opacity:.46;font:500 8px/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.13em;text-transform:uppercase;white-space:nowrap;scroll-snap-align:center;transition:opacity .24s ease,letter-spacing .24s ease}.chapter-strip a::after{content:"";position:absolute;left:50%;bottom:8px;width:0;height:1px;background:currentColor;transform:translateX(-50%);opacity:.72;transition:width .26s ease}.chapter-strip a.active{opacity:1;letter-spacing:.17em}.chapter-strip a.active::after{width:22px}.chapter-strip a.chapter-arrive{animation:chapter-arrive .42s ease both}@keyframes chapter-arrive{0%{opacity:.35;transform:translateY(2px)}55%{opacity:1}100%{transform:none}}
.site-actions{justify-self:end;display:flex;align-items:center;justify-content:flex-end;gap:2px;min-width:86px}.top-icon{width:38px;height:38px;opacity:.62}.top-icon:hover{opacity:1}.top-download svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round}.site-progress-global{position:absolute;left:0;right:0;bottom:-1px;height:1px;background:transparent;overflow:hidden;pointer-events:none}.site-progress-global i{display:block;width:100%;height:100%;background:color-mix(in srgb,var(--ink) 42%,transparent);transform:scaleX(0);transform-origin:left center;transition:transform .08s linear}
@media(max-width:760px){.sitebar{height:52px;padding:0 9px;grid-template-columns:minmax(72px,.9fr) minmax(0,2fr) minmax(74px,.9fr);gap:5px}.sitebrand-text{max-width:82px;font-size:7px;letter-spacing:.11em}.sitebrand-logo{max-width:82px;max-height:24px}.chapter-strip{justify-content:flex-start;gap:15px;padding:0 7px}.chapter-strip a{font-size:7px;letter-spacing:.10em}.chapter-strip a.active{letter-spacing:.13em}.chapter-strip a::after{bottom:7px}.chapter-strip a.active::after{width:17px}.site-actions{min-width:74px;gap:0}.top-icon{width:36px;height:36px}.top-download svg{width:16px;height:16px}}
/* v1.4.3 · Regreso al look limpio: marca arriba, capítulos solo debajo de portada */
.sitebar{position:relative!important;top:auto!important;z-index:10!important;max-width:1500px!important;margin:0 auto!important;height:62px!important;padding:0 3.2vw!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:18px!important;background:var(--bg)!important;border-bottom:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.sitebar.is-scrolled{background:var(--bg)!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.site-actions{margin-left:auto!important;min-width:0!important}.site-progress-global,.site-status,.chapter-menu{display:none!important}.subnav.chapter-strip{position:relative;display:flex;align-items:center;justify-content:center;gap:26px;height:auto;min-height:47px;overflow-x:auto;overflow-y:hidden;padding:0 12px;border-bottom:1px solid color-mix(in srgb,var(--ink) 11%,transparent);scrollbar-width:none;scroll-snap-type:x proximity;background:transparent}.subnav.chapter-strip::-webkit-scrollbar{display:none}.subnav.chapter-strip a{position:relative;flex:0 0 auto;display:flex;align-items:center;min-height:47px;padding:0 1px;color:inherit;text-decoration:none;opacity:.48;font:500 9px/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;scroll-snap-align:center;transition:opacity .24s ease,letter-spacing .24s ease}.subnav.chapter-strip a::after{content:"";position:absolute;left:50%;bottom:9px;width:0;height:1px;background:currentColor;transform:translateX(-50%);opacity:.68;transition:width .28s cubic-bezier(.2,.7,.2,1)}.subnav.chapter-strip a.active{opacity:1;letter-spacing:.16em}.subnav.chapter-strip a.active::after{width:22px}.subnav.chapter-strip a.chapter-arrive{animation:chapter-arrive-clean .42s ease both}@keyframes chapter-arrive-clean{0%{opacity:.32;transform:translateY(2px)}55%{opacity:1}100%{transform:none}}
@media(max-width:760px){.sitebar{height:54px!important;padding:0 14px!important}.sitebrand-text{max-width:150px!important;font-size:10px!important;letter-spacing:.14em!important}.sitebrand-logo{max-width:132px!important;max-height:29px!important}.site-actions{gap:1px!important}.top-icon{width:38px!important;height:38px!important}.subnav.chapter-strip{justify-content:flex-start;gap:19px;min-height:43px;padding:0 7px}.subnav.chapter-strip a{min-height:43px;font-size:8px;letter-spacing:.10em}.subnav.chapter-strip a.active{letter-spacing:.13em}.subnav.chapter-strip a::after{bottom:7px}.subnav.chapter-strip a.active::after{width:18px}}

/* v1.4.4 · Descarga integrada en la navegación; sin "Presentación" */
.subnav.chapter-strip .chapter-download{gap:6px;opacity:.68}.subnav.chapter-strip .chapter-download:hover{opacity:1}.subnav.chapter-strip .chapter-download::after{display:none}.subnav.chapter-strip .chapter-download svg{width:12px;height:12px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}.subnav.chapter-strip .chapter-download b{font:inherit;letter-spacing:inherit}
@media(max-width:760px){.subnav.chapter-strip .chapter-download{gap:5px}.subnav.chapter-strip .chapter-download svg{width:11px;height:11px}}

/* v1.4.7 · Cabecera independiente y compacta.
   Nunca se superpone a la portada: logo/nombre + música viven fuera del hero. */
.sitebar{position:relative!important;top:auto!important;left:auto!important;right:auto!important;transform:none!important;z-index:20!important;width:min(calc(100% - 28px),1450px)!important;max-width:none!important;margin:0 auto!important;height:48px!important;padding:0 10px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;color:var(--ink)!important;pointer-events:auto!important}
.sitebar.is-scrolled{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
.sitebar .sitebrand,.sitebar .site-actions{pointer-events:auto!important}
.sitebrand-text{color:var(--ink)!important;text-shadow:none!important}
.sitebrand-logo{filter:none!important}
.sitebar .top-icon{color:var(--ink)!important;text-shadow:none!important;background:transparent!important}
.sitebar .top-icon:hover{background:color-mix(in srgb,var(--ink) 5%,transparent)!important}
@media(max-width:760px){.sitebar{width:calc(100% - 18px)!important;height:44px!important;padding:0 5px!important;gap:10px!important}.sitebrand-text{max-width:128px!important;font-size:9px!important;letter-spacing:.12em!important}.sitebrand-logo{max-width:112px!important;max-height:25px!important}.sitebar .top-icon{width:34px!important;height:34px!important}}

/* v1.4.6 · Limpieza editorial: ninguna placa tapa la fotografía.
   Minimal y Capas usan texto directo + degradado; marcos y paneles pasan a tonos casi neutros. */
body[data-style="minimal"] .hero-copy,body[data-style="layers"] .hero-copy,
body[data-mobile-cover="horizontal"][data-style="minimal"] .hero-copy,body[data-mobile-cover="horizontal"][data-style="layers"] .hero-copy{
  left:6%!important;right:auto!important;top:auto!important;bottom:7%!important;transform:none!important;
  width:min(60%,680px)!important;max-width:680px!important;max-height:none!important;padding:0!important;
  background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
  color:#fff!important;text-align:left!important;text-shadow:0 2px 16px rgba(0,0,0,.24)!important;overflow:visible!important
}
body[data-style="minimal"] .hero-shade{background:linear-gradient(to top,rgba(0,0,0,${supportStrong}) 0%,rgba(0,0,0,${supportMid}) 48%,rgba(0,0,0,0) 80%)!important}
body[data-style="layers"] .hero-shade{background:linear-gradient(90deg,rgba(0,0,0,${supportStrong}) 0%,rgba(0,0,0,${supportMid}) 48%,rgba(0,0,0,0) 82%)!important}
body[data-style="minimal"] .chapter-copy,body[data-style="layers"] .chapter-copy{
  background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
  color:#fff!important;padding:0!important;text-shadow:0 2px 14px rgba(0,0,0,.24)!important
}
body[data-style="minimal"] .banner-shade{background:linear-gradient(to top,rgba(0,0,0,.48),rgba(0,0,0,.10) 52%,transparent 82%)!important}
body[data-style="layers"] .banner-shade{background:linear-gradient(90deg,rgba(0,0,0,.44),rgba(0,0,0,.10) 54%,transparent 84%)!important}
body[data-style="minimal"] .hero{border:1px solid color-mix(in srgb,var(--ink) 7%,transparent)!important}
body[data-style="minimal"] .chapter-banner{border:1px solid color-mix(in srgb,var(--ink) 6%,transparent)!important}

/* Capas conserva profundidad, pero sin cartón de color contrastante. */
body[data-style="layers"] .hero::before{background:color-mix(in srgb,var(--bg) 96%,var(--ink))!important;border:1px solid color-mix(in srgb,var(--ink) 6%,transparent)!important}
body[data-style="layers"] .hero{box-shadow:0 18px 46px color-mix(in srgb,var(--ink) 7%,transparent)!important}
body[data-style="layers"] .chapter-banner{box-shadow:0 12px 30px color-mix(in srgb,var(--ink) 6%,transparent)!important}

/* Portafolio y Fine Art: marco tonal, nunca blanco/negro duro contra la paleta. */
body[data-style="framed"] .page{background:var(--bg)!important}
body[data-style="framed"] .hero{border:1px solid color-mix(in srgb,var(--ink) 7%,transparent)!important;outline:1px solid color-mix(in srgb,var(--ink) 5%,transparent)!important;outline-offset:-10px!important}
body[data-style="framed"] .chapter-banner{border:1px solid color-mix(in srgb,var(--ink) 6%,transparent)!important}
body[data-cover="fineart"] .hero{outline-color:color-mix(in srgb,var(--ink) 8%,transparent)!important}
body[data-style="fineart"] .chapter-banner{outline:1px solid color-mix(in srgb,var(--ink) 5%,transparent);outline-offset:6px}

/* Doble panel se conserva, solo baja el contraste del plano de color. */
body[data-style="split"] .hero,body[data-cover="split"] .hero{background:color-mix(in srgb,var(--bg) 96%,var(--accent))!important;border-color:color-mix(in srgb,var(--ink) 6%,transparent)!important}
body[data-style="split"] .chapter-banner{background:color-mix(in srgb,var(--bg) 96%,var(--accent))!important}

@media(max-width:760px){
  body[data-style="minimal"] .hero-copy,body[data-style="layers"] .hero-copy,
  body[data-mobile-cover="horizontal"][data-style="minimal"] .hero-copy,body[data-mobile-cover="horizontal"][data-style="layers"] .hero-copy{
    left:6%!important;right:6%!important;bottom:7%!important;width:auto!important;max-width:88%!important;padding:0!important;transform:none!important;
    background:transparent!important;border:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;text-align:left!important;color:#fff!important
  }
  body[data-style="minimal"] .chapter-copy,body[data-style="layers"] .chapter-copy{left:6%!important;right:6%!important;bottom:9%!important;max-width:88%!important;padding:0!important}
  body[data-style="layers"] .hero::before{inset:-6px 7% 7px -5px!important}
  body[data-style="framed"] .hero{border-width:1px!important;outline-offset:-7px!important}
  body[data-cover="fineart"] .hero{outline-offset:5px!important}
}

/* Gallery Studio v1.4.12 — Reproductor slim sobre el menú, vidrio inspirado en Aura Invitaciones.
   Capa rgba semitransparente; SIN mezcla opaca con --bg. El fondo de portada se ve detrás. */
.gallery-nav-zone{display:flex;flex-direction:column;align-items:stretch;gap:10px;border-bottom:1px solid color-mix(in srgb,var(--ink) 11%,transparent);padding:12px clamp(8px,2vw,18px) 5px;min-width:0}
.gallery-nav-zone>.subnav{flex:none;width:100%;min-width:0;border:0;padding:9px 6px 10px;justify-content:safe center;gap:8px}
.gallery-player{width:242px;max-width:100%;display:flex;align-items:center;gap:8px;padding:6px 9px;min-height:44px;border:1px solid rgba(255,255,255,.20);border-radius:14px;background:rgba(28,30,34,.18);color:#fff;backdrop-filter:blur(14px) saturate(115%);-webkit-backdrop-filter:blur(14px) saturate(115%);box-shadow:0 6px 18px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.08)}
.nav-player{flex:0 0 auto;align-self:center;margin-left:auto;margin-right:auto;transform:none}
.gallery-player-art{width:24px;height:24px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:2px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10)}
.gallery-player-art i{display:block;width:2px;border-radius:2px;background:rgba(255,255,255,.92)}
.gallery-player-art i:nth-child(1){height:7px}.gallery-player-art i:nth-child(2){height:13px}.gallery-player-art i:nth-child(3){height:9px}.gallery-player-art i:nth-child(4){height:15px}.gallery-player-art i:nth-child(5){height:8px}
.gallery-player-main{min-width:0;flex:1;display:grid;gap:3px}
.gallery-player-heading{display:flex;align-items:center;gap:3px;min-width:0}
.gallery-player-song{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.gallery-player-song strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 9.5px/1.15 Inter,ui-sans-serif,sans-serif;letter-spacing:.01em;text-shadow:0 1px 2px rgba(0,0,0,.20)}
.gallery-player-song span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:400 7.5px/1.15 Inter,ui-sans-serif,sans-serif;opacity:.78;text-shadow:0 1px 2px rgba(0,0,0,.18)}
.gallery-player-mute{flex:none;display:grid;place-items:center;width:20px;height:20px;padding:3px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;opacity:.76;cursor:pointer}
.gallery-player-mute:hover{opacity:1;background:rgba(255,255,255,.14)}.gallery-player-mute.muted{opacity:.38}
.gallery-player-mute svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.gallery-player-timeline{display:flex;align-items:center;gap:4px}
.gallery-player-timeline span{flex:none;font:7px/1 ui-monospace,monospace;font-variant-numeric:tabular-nums;opacity:.70;text-shadow:0 1px 2px rgba(0,0,0,.16)}
.gallery-player-seek{width:100%;min-width:0;height:10px;margin:0;appearance:none;-webkit-appearance:none;border:0;background:transparent;cursor:pointer;outline-offset:3px}
.gallery-player-seek::-webkit-slider-runnable-track{height:2px;border-radius:999px;background:linear-gradient(to right,rgba(255,255,255,.92) var(--progress),rgba(255,255,255,.22) var(--progress))}
.gallery-player-seek::-moz-range-track{height:2px;border-radius:999px;background:rgba(255,255,255,.22)}
.gallery-player-seek::-moz-range-progress{height:2px;border-radius:999px;background:rgba(255,255,255,.92)}
.gallery-player-seek::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:7px;height:7px;margin-top:-2.5px;border-radius:50%;background:#fff;border:0}
.gallery-player-seek::-moz-range-thumb{width:7px;height:7px;border-radius:50%;background:#fff;border:0}
.gallery-player-play{flex:none;display:grid;place-items:center;width:26px;height:26px;border:1px solid rgba(255,255,255,.22);border-radius:50%;background:rgba(255,255,255,.92);color:#212429;cursor:pointer;transition:transform .18s ease,background .18s ease;box-shadow:0 2px 8px rgba(0,0,0,.10),inset 0 1px 0 rgba(255,255,255,.46)}
.gallery-player-play:hover{transform:scale(1.05);background:#fff}.gallery-player-play:active{transform:scale(.96)}
.gallery-player-play svg{width:12px;height:12px;fill:currentColor;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.gallery-player-play .icon-pause{display:none;fill:none;stroke-width:2.8}.gallery-player-play.playing .icon-play{display:none}.gallery-player-play.playing .icon-pause{display:block}
@media(max-width:960px){.gallery-nav-zone{padding:11px 10px 5px;gap:9px}.gallery-nav-zone>.subnav{width:100%;padding:9px 5px 10px;gap:8px}.gallery-player{width:230px}}
@media(max-width:760px){.gallery-nav-zone{align-items:stretch;padding:12px 5px 6px;gap:9px}.gallery-nav-zone>.subnav{padding:9px 7px 10px;gap:7px;justify-content:safe center}.gallery-player{width:min(100%,226px);align-self:center;gap:7px;min-height:40px;padding:5px 8px;border-radius:13px}.gallery-player-art{width:22px;height:22px}.gallery-player-play{width:24px;height:24px}.gallery-player-main{gap:3px}}
@media(max-width:360px){.gallery-player{width:214px}.gallery-player-art{width:20px;height:20px}}

/* v1.4.14 - Menú de capítulos con ancho intrínseco: grupo compacto real.
   Antes el nav tomaba 100% de ancho, y los rótulos tenían tracking extra.
   El borde exterior permanece en .gallery-nav-zone, no en el grupo. */
.gallery-nav-zone > .subnav.chapter-strip{
  display:flex;
  flex:0 1 auto;
  width:fit-content;
  max-width:100%;
  min-width:0;
  align-self:center;
  justify-content:safe center;
  gap:3px;
  padding:0 2px;
  margin:0 auto;
  min-height:42px;
  border:0;
  overflow-x:auto;
  overflow-y:hidden;
}
.gallery-nav-zone > .subnav.chapter-strip a{
  padding:0 1px;
  min-height:42px;
  letter-spacing:.025em;
}
.gallery-nav-zone > .subnav.chapter-strip a.active{letter-spacing:.035em}
.gallery-nav-zone > .subnav.chapter-strip a.chapter-download{gap:3px}
@media(max-width:760px){
  .gallery-nav-zone > .subnav.chapter-strip{
    width:fit-content;
    max-width:100%;
    justify-content:safe center;
    gap:3px;
    padding:0 1px;
    min-height:43px;
  }
  .gallery-nav-zone > .subnav.chapter-strip a{
    min-height:43px;
    padding:0 1px;
    letter-spacing:.025em;
  }
  .gallery-nav-zone > .subnav.chapter-strip a.active{letter-spacing:.035em}
}


/* Gallery Studio 1.4.15 · Destacados 3 × 2: ordenados, sin portada adicional. */
.chapter>.highlights-block{padding:14px 0 16px;margin:0 auto;width:100%;max-width:1120px}
.chapter .highlights-head{display:flex;justify-content:center;align-items:center;margin:0 0 11px;gap:0}
.chapter .highlights-head span{font:500 9px/1.2 Inter,ui-sans-serif,sans-serif;letter-spacing:.17em;text-transform:uppercase;color:color-mix(in srgb,var(--ink) 67%,transparent)}
.chapter .highlights-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-flow:row;grid-auto-rows:auto;gap:7px;width:100%;margin:0 auto}
.chapter .highlights-grid>.highlight-tile,.chapter .highlights-grid>.highlight-tile:nth-child(n){position:relative;display:block;width:100%;min-width:0;grid-column:auto!important;grid-row:auto!important;aspect-ratio:4/5!important;isolation:isolate;overflow:hidden;cursor:zoom-in;border:0;padding:0;background:color-mix(in srgb,var(--ink) 6%,var(--bg))}
.chapter .highlights-grid>.highlight-tile img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;opacity:1;transition:opacity .4s ease}
.chapter .highlights-grid>.highlight-tile img.is-highlight-incoming{opacity:0}
.chapter .highlights-grid>.highlight-tile img.is-highlight-outgoing{opacity:0}
.chapter .highlights-grid>.highlight-tile img.is-highlight-incoming.is-highlight-shown{opacity:1}
.chapter .highlights-grid>.highlight-tile:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.chapter .highlights-open{margin:12px auto 0;min-width:0;width:max-content;max-width:100%;padding:10px 16px 8px}
@media(max-width:760px){.chapter>.highlights-block{padding:10px 0 13px}.chapter .highlights-grid{gap:5px;grid-template-columns:repeat(3,minmax(0,1fr))}.chapter .highlights-grid>.highlight-tile,.chapter .highlights-grid>.highlight-tile:nth-child(n){grid-column:auto!important;grid-row:auto!important;aspect-ratio:4/5!important}.chapter .highlights-head{margin-bottom:9px}.chapter .highlights-head span{font-size:8px}.chapter .highlights-open{width:max-content;max-width:100%}}
/* v1.4.26 · El acceso principal utiliza el mismo aspecto que «Ver 15 fotos más». */
.chapter .highlights-open{width:100%;max-width:100%;min-width:0;min-height:0;margin:18px 0 6px;padding:16px 8px 11px;border:0;border-top:1px solid color-mix(in srgb,var(--ink) 14%,transparent);border-radius:0;background:transparent;color:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;cursor:pointer;box-shadow:none;animation:none;-webkit-tap-highlight-color:transparent;transition:none;font:inherit;text-align:center}
.chapter .highlights-open span{display:block;font:500 9px/1 Inter,ui-sans-serif,sans-serif;letter-spacing:.15em;text-transform:uppercase;opacity:.65;animation:none;transform:none}
.chapter .highlights-open i{display:block!important;width:18px;height:18px;border:0;border-right:1px solid currentColor;border-bottom:1px solid currentColor;transform:rotate(45deg);opacity:.38;transition:transform .28s ease,opacity .28s ease}
.chapter .highlights-open[aria-expanded="true"] i{transform:rotate(225deg);opacity:.55}
.chapter .highlights-open:hover{background:transparent;color:inherit;border-top-color:color-mix(in srgb,var(--ink) 14%,transparent)}
.chapter .highlights-open:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media(max-width:760px){.chapter .highlights-open{width:100%;max-width:100%;margin:13px 0 4px;padding:15px 8px 10px}}
@media(prefers-reduced-motion:reduce){.chapter .highlights-open i{transition:none!important}}
@media(prefers-reduced-motion:reduce){.chapter .highlights-grid>.highlight-tile img{transition:none!important}}


/* v1.4.28 · Reproductor editorial: mismo lenguaje de líneas finas que las galerías. */
.gallery-nav-zone .gallery-player{
  width:264px;max-width:calc(100% - 16px);min-height:48px;gap:8px;
  padding:7px 9px 7px 8px;border:1px solid color-mix(in srgb,var(--ink) 16%,transparent);
  border-radius:5px;background:transparent;color:var(--ink);
  box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none;
}
.gallery-nav-zone .gallery-player-art{
  width:18px;height:27px;border:0;border-right:1px solid color-mix(in srgb,var(--ink) 14%,transparent);
  border-radius:0;background:transparent;gap:1.5px;padding-right:7px;
}
.gallery-nav-zone .gallery-player-art i{width:1px;border-radius:0;background:currentColor;opacity:.55}
.gallery-nav-zone .gallery-player-art i:nth-child(1){height:5px}
.gallery-nav-zone .gallery-player-art i:nth-child(2){height:10px}
.gallery-nav-zone .gallery-player-art i:nth-child(3){height:7px}
.gallery-nav-zone .gallery-player-art i:nth-child(4){height:12px}
.gallery-nav-zone .gallery-player-art i:nth-child(5){display:none}
.gallery-nav-zone .gallery-player-main{gap:4px}
.gallery-nav-zone .gallery-player-song strong{font:400 11px/1.15 Georgia,"Times New Roman",serif;letter-spacing:.01em;text-shadow:none}
.gallery-nav-zone .gallery-player-song span{font:400 7px/1.25 Inter,ui-sans-serif,sans-serif;letter-spacing:.055em;opacity:.62;text-shadow:none}
.gallery-nav-zone .gallery-player-mute{
  color:inherit;background:transparent;border:0;border-radius:0;
  width:18px;height:20px;padding:2px;opacity:.6;
}
.gallery-nav-zone .gallery-player-mute:hover{background:transparent;opacity:.9}
.gallery-nav-zone .gallery-player-mute.muted{opacity:.32}
.gallery-nav-zone .gallery-player-timeline{gap:5px}
.gallery-nav-zone .gallery-player-timeline span{font:7px/1 ui-monospace,monospace;opacity:.55;text-shadow:none}
.gallery-nav-zone .gallery-player-seek::-webkit-slider-runnable-track{
  height:1px;border-radius:0;background:linear-gradient(to right,var(--ink) var(--progress),color-mix(in srgb,var(--ink) 16%,transparent) var(--progress));
}
.gallery-nav-zone .gallery-player-seek::-moz-range-track{height:1px;border-radius:0;background:color-mix(in srgb,var(--ink) 16%,transparent)}
.gallery-nav-zone .gallery-player-seek::-moz-range-progress{height:1px;border-radius:0;background:var(--ink)}
.gallery-nav-zone .gallery-player-seek::-webkit-slider-thumb{width:5px;height:5px;margin-top:-2px;background:var(--ink)}
.gallery-nav-zone .gallery-player-seek::-moz-range-thumb{width:5px;height:5px;background:var(--ink)}
.gallery-nav-zone .gallery-player-play{
  width:23px;height:28px;padding:0;border:0;border-left:1px solid color-mix(in srgb,var(--ink) 14%,transparent);
  border-radius:0;background:transparent;color:var(--ink);box-shadow:none;
  transition:opacity .18s ease;opacity:.74;
}
.gallery-nav-zone .gallery-player-play:hover{transform:none;background:transparent;opacity:1}
.gallery-nav-zone .gallery-player-play:active{transform:none;opacity:.55}
.gallery-nav-zone .gallery-player-play svg{width:12px;height:12px;stroke-width:1.4}
.gallery-nav-zone .gallery-player-play .icon-play{fill:currentColor;stroke:none}
.gallery-nav-zone .gallery-player-play .icon-pause{stroke-width:2;fill:none}
.gallery-nav-zone .gallery-player-play:focus-visible,.gallery-nav-zone .gallery-player-mute:focus-visible{outline:1px solid var(--ink);outline-offset:2px}
@media(max-width:760px){
  .gallery-nav-zone .gallery-player{width:250px;max-width:calc(100% - 16px);min-height:46px;gap:7px;padding:6px 8px}
  .gallery-nav-zone .gallery-player-art{width:18px;height:25px}
  .gallery-nav-zone .gallery-player-play{width:23px;height:26px}
}
</style></head><body data-style="${escapeAttr(m.style)}" data-cover="${escapeAttr(m.coverStyle || 'classic')}" data-mobile-cover="${escapeAttr(m.mobileCoverMode || 'mixed')}" data-reveal="${escapeAttr(m.revealStyle || 'soft')}"><header class="sitebar" id="sitebar">${brandHtml}<div class="site-actions">${musicTop}</div></header><main class="page"><section class="hero reveal-target" id="presentacion">${heroMedia}<div class="hero-shade"></div><div class="hero-copy">${heroEyebrow}<h1>${escapeHtml(m.title)}</h1><div class="date">${escapeHtml(m.dateText)}</div><p>${escapeHtml(m.subtitle)}<br>${escapeHtml(m.description)}</p></div></section><div class="gallery-nav-zone">${musicPlayer}<nav class="subnav chapter-strip" id="chapterStrip" aria-label="Capítulos">${drawerNav}</nav></div>${chapters}${videos}</main>${music}<div class="lightbox" id="lightbox"><button class="lb-close" aria-label="Cerrar">×</button><div class="lb-stage"><img alt="" draggable="false"></div><div class="lb-hint" aria-hidden="true"><span class="lb-hint-line"></span><small>desliza</small></div></div><script>
(()=>{const qs=s=>document.querySelector(s),qsa=s=>[...document.querySelectorAll(s)];const contentOrder=${JSON.stringify(contentOrder)},page=qs('.page');if(page)contentOrder.forEach(id=>{const el=qs('#'+id);if(el)page.appendChild(el)});const chapterStrip=qs('#chapterStrip');let activeNavLink=null;const tracked=contentOrder.map(id=>qs('#'+id)).filter(Boolean);let navTick=false;function syncNav(){navTick=false;const threshold=Math.min(innerHeight*.22,150);let active=tracked[0];for(const el of tracked){if(el&&el.getBoundingClientRect().top<=threshold)active=el}if(active){const link=qs('[data-menu-link][href="#'+active.id+'"]');qsa('[data-menu-link]').forEach(a=>a.classList.toggle('active',a===link));if(link&&link!==activeNavLink){activeNavLink=link;link.classList.remove('chapter-arrive');void link.offsetWidth;link.classList.add('chapter-arrive');if(chapterStrip){const target=link.offsetLeft-(chapterStrip.clientWidth-link.offsetWidth)/2;chapterStrip.scrollTo({left:Math.max(0,target),behavior:'smooth'})}}}}function requestNav(){if(navTick)return;navTick=true;requestAnimationFrame(syncNav)}addEventListener('scroll',requestNav,{passive:true});addEventListener('resize',requestNav);syncNav();qsa('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const t=qs(a.getAttribute('href'));if(t){e.preventDefault();const top=t.getBoundingClientRect().top+(scrollY||0)-8;scrollTo({top:Math.max(0,top),behavior:'smooth'})}}));qsa('[data-highlights-open]').forEach(b=>b.addEventListener('click',()=>{const wrap=qs('#'+b.dataset.highlightsOpen);if(!wrap)return;const opening=wrap.classList.contains('gallery-collapsed');wrap.classList.toggle('gallery-collapsed',!opening);b.setAttribute('aria-expanded',String(opening));const label=b.querySelector('span');if(label)label.textContent=opening?'Ocultar galería':'Presiona aquí para ver la galería completa';if(opening)setTimeout(()=>wrap.scrollIntoView({behavior:'smooth',block:'start'}),30)}));/* Seis destacados visibles. Cada 3.8 s cambia una sola imagen, con fade y sin repeticiones.
   No rota si está fuera de pantalla, si la pestaña está oculta, si el usuario interactúa,
   si se usa movimiento reducido o si el visor de fotos está abierto. */
qsa('[data-dynamic-highlights]').forEach(grid=>{
  if(grid.dataset.rotationEnabled!=='true')return;
  const chapter=grid.closest('.chapter');
  const slots=qsa('[data-highlight-photo]').filter(b=>b.closest('.highlights-grid')===grid);
  const photos=[...chapter.querySelectorAll('[data-photo-id]')];
  if(photos.length<=slots.length||slots.length!==6)return;
  let nextIndex=slots.length,slotIndex=0,visible=false,transitioning=false;
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting)},{threshold:.05});
  if(io)io.observe(grid);else visible=true;
  function nextPhoto(){
    if(!visible||document.hidden||transitioning||reduceMotion?.matches||grid.matches(':hover')||grid.contains(document.activeElement)||document.querySelector('.lightbox.open'))return;
    const slot=slots[slotIndex];
    const source=photos[nextIndex%photos.length];
    nextIndex++;slotIndex=(slotIndex+1)%slots.length;
    if(!source)return;
    const url=source.getAttribute('data-lightbox-src');
    if(!url)return;
    const old=slot.querySelector('img');
    const incoming=new Image();
    incoming.alt=source.getAttribute('data-lightbox-alt')||'';
    incoming.className='is-highlight-incoming';
    incoming.style.objectPosition=(source.style.getPropertyValue('--fx')||'50%')+' '+(source.style.getPropertyValue('--fy')||'50%');
    transitioning=true;
    let finished=false;
    const cleanup=()=>{if(finished)return;finished=true;slot.dataset.highlightPhoto=source.dataset.photoId;slot.appendChild(incoming);requestAnimationFrame(()=>requestAnimationFrame(()=>{incoming.classList.add('is-highlight-shown');old.classList.add('is-highlight-outgoing')}));setTimeout(()=>{old.remove();incoming.classList.remove('is-highlight-incoming','is-highlight-shown');transitioning=false},430)};
    incoming.onload=cleanup;
    incoming.onerror=()=>{transitioning=false};
    incoming.src=url;
    if(incoming.complete&&incoming.naturalWidth)cleanup();
  }
  const highlightDelay=()=>Math.max(1850,2500+((Math.random()*840)-420));let highlightTimer=null;const scheduleHighlightSwap=()=>{clearTimeout(highlightTimer);highlightTimer=setTimeout(()=>{nextPhoto();scheduleHighlightSwap()},highlightDelay())};scheduleHighlightSwap();addEventListener('beforeunload',()=>clearTimeout(highlightTimer),{once:true});
});
qsa('[data-highlight-photo]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.highlightPhoto;const target=qsa('[data-photo-id]').find(x=>x.dataset.photoId===id);target?.click()}));const revealTargets=qsa('.reveal-target');const reduced=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;if(document.body.dataset.reveal==='none'||reduced||!('IntersectionObserver' in window)){revealTargets.forEach(el=>el.classList.add('revealed'))}else{const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('revealed');io.unobserve(entry.target)}}),{rootMargin:'0px 0px -7% 0px',threshold:.06});revealTargets.forEach(el=>io.observe(el))}const audio=qs('#bgMusic'),musicControls=qsa('[data-music-control]');

/* Reproductor slim sobre el menú: ambos fuera de la portada, sin superposición. */

const trackSeek=qs('#galleryTrackSeek'),trackNow=qs('#galleryTrackNow'),trackDuration=qs('#galleryTrackDuration'),muteBtn=qs('[data-music-mute]');
const musicClock=seconds=>{if(!Number.isFinite(seconds)||seconds<0)return '0:00';const secs=Math.floor(seconds);return Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0')};
function syncTrackProgress(){if(!audio)return;const duration=Number.isFinite(audio.duration)?audio.duration:0;const progress=duration?Math.max(0,Math.min(1,audio.currentTime/duration)):0;if(trackNow)trackNow.textContent=musicClock(audio.currentTime);if(trackDuration)trackDuration.textContent=musicClock(duration);if(trackSeek){trackSeek.value=String(Math.round(progress*1000));trackSeek.style.setProperty('--progress',(progress*100)+'%');trackSeek.disabled=!duration}}
function syncMusic(){if(!audio)return;const playing=!audio.paused;musicControls.forEach(btn=>{btn.classList.toggle('playing',playing);btn.setAttribute('aria-label',playing?'Pausar música':'Reproducir música');btn.title=playing?'Pausar música':'Reproducir música';const label=btn.querySelector('b');if(label)label.textContent=playing?'Pausar música':'Reproducir música'});if(muteBtn){muteBtn.classList.toggle('muted',audio.muted);muteBtn.setAttribute('aria-label',audio.muted?'Activar sonido':'Silenciar música');muteBtn.title=audio.muted?'Activar sonido':'Silenciar música'}syncTrackProgress()}
if(audio&&musicControls.length){musicControls.forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(audio.paused)audio.play().catch(()=>{});else audio.pause();syncMusic()}));['play','pause','ended','loadedmetadata','durationchange','timeupdate','volumechange'].forEach(event=>audio.addEventListener(event,syncMusic));if(trackSeek){trackSeek.addEventListener('input',()=>{const duration=audio.duration;if(Number.isFinite(duration)&&duration>0){audio.currentTime=duration*(Number(trackSeek.value)/1000);syncTrackProgress()}})}if(muteBtn)muteBtn.addEventListener('click',()=>{audio.muted=!audio.muted;syncMusic()});syncMusic()}
qsa('[data-gallery-more]').forEach(b=>b.addEventListener('click',()=>{const grid=qs('#'+b.dataset.galleryMore);if(!grid)return;const batch=Number(b.dataset.batchSize)||15,total=Number(b.dataset.total)||0;let visible=Number(b.dataset.visible)||batch;const hidden=[...grid.querySelectorAll('.batch-hidden')];if(hidden.length){hidden.slice(0,batch).forEach(el=>el.classList.remove('batch-hidden'));visible=Math.min(total,visible+batch);b.dataset.visible=String(visible);b.setAttribute('aria-expanded',String(visible>=total));const remaining=Math.max(0,total-visible),label=b.querySelector('span');if(label)label.textContent=remaining?('Ver '+Math.min(batch,remaining)+' fotos más'):'Mostrar menos';b.classList.toggle('expanded',!remaining)}else{[...grid.querySelectorAll('.batch-extra')].forEach(el=>el.classList.add('batch-hidden'));b.dataset.visible=String(Math.min(batch,total));b.setAttribute('aria-expanded','false');b.classList.remove('expanded');const remaining=Math.max(0,total-Math.min(batch,total)),label=b.querySelector('span');if(label)label.textContent='Ver '+Math.min(batch,remaining)+' fotos más';grid.scrollIntoView({behavior:'smooth',block:'start'})}}));const tiles=qsa('[data-lightbox-src]'),lb=qs('#lightbox'),stage=lb.querySelector('.lb-stage'),img=lb.querySelector('img');let ix=0,startX=0,startY=0,dx=0,dy=0,dragging=false,pid=null,hintTimer=null;function resetImg(animate=true){img.style.transition=animate?'transform .22s ease,opacity .22s ease':'none';img.style.transform='translate3d(0,0,0) scale(1)';img.style.opacity='1'}function cueHint(){clearTimeout(hintTimer);lb.classList.remove('hinting');if(innerWidth>760)return;requestAnimationFrame(()=>{lb.classList.add('hinting');hintTimer=setTimeout(()=>lb.classList.remove('hinting'),2800)})}function preloadNeighbors(){[-1,1].forEach(d=>{const t=tiles[(ix+d+tiles.length)%tiles.length];if(t){const p=new Image();p.src=t.dataset.lightboxSrc}})}function show(i,dir=0){if(!tiles.length)return;ix=(i+tiles.length)%tiles.length;const next=tiles[ix];if(dir){img.style.transition='none';img.style.transform='translate3d('+(dir>0?'18vw':'-18vw')+',0,0)';img.style.opacity='.35'}img.src=next.dataset.lightboxSrc;img.alt=next.dataset.lightboxAlt||'';lb.classList.add('open');if(!dir)cueHint();else lb.classList.remove('hinting');preloadNeighbors();requestAnimationFrame(()=>requestAnimationFrame(()=>resetImg(true)))}function close(){clearTimeout(hintTimer);lb.classList.remove('open','hinting');resetImg(false)}tiles.forEach((b,i)=>b.addEventListener('click',()=>show(i)));lb.querySelector('.lb-close').onclick=close;stage.addEventListener('pointerdown',e=>{if(!lb.classList.contains('open'))return;clearTimeout(hintTimer);lb.classList.remove('hinting');dragging=true;pid=e.pointerId;startX=e.clientX;startY=e.clientY;dx=dy=0;stage.setPointerCapture?.(pid);img.style.transition='none'});stage.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==pid)return;dx=e.clientX-startX;dy=e.clientY-startY;const horizontal=Math.abs(dx)>=Math.abs(dy);const tx=horizontal?dx:dx*.18;const ty=horizontal?dy*.12:dy;const scale=Math.max(.92,1-Math.min(1,Math.hypot(dx,dy)/700)*.06);img.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale('+scale+')';img.style.opacity=String(Math.max(.55,1-Math.abs(horizontal?dx:dy)/650));e.preventDefault()});function finish(e){if(!dragging||e.pointerId!==pid)return;dragging=false;try{stage.releasePointerCapture?.(pid)}catch(_){}const ax=Math.abs(dx),ay=Math.abs(dy),threshold=Math.max(55,innerWidth*.10);if(ax>ay&&ax>threshold){const dir=dx<0?1:-1;img.style.transition='transform .16s ease,opacity .16s ease';img.style.transform='translate3d('+(dx<0?'-35vw':'35vw')+',0,0)';img.style.opacity='.15';setTimeout(()=>show(ix+dir,dir),145)}else if(ay>ax&&dy>Math.max(80,innerHeight*.10)){img.style.transition='transform .18s ease,opacity .18s ease';img.style.transform='translate3d(0,30vh,0) scale(.94)';img.style.opacity='0';setTimeout(close,170)}else resetImg(true)}stage.addEventListener('pointerup',finish);stage.addEventListener('pointercancel',finish);lb.addEventListener('click',e=>{if(e.target===lb)close()});addEventListener('keydown',e=>{if(!lb.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(ix-1,-1);if(e.key==='ArrowRight')show(ix+1,1)})})();
<\/script></body></html>`;
  }

  function schedulePreview(anchor = '', immediate = false) {
    clearTimeout(previewTimer);
    // La vista previa sigue siendo en vivo, pero se agrupan cambios rápidos para no
    // repintar el iframe durante cada pequeño movimiento del usuario.
    previewTimer = setTimeout(() => updatePreview(anchor), immediate ? 0 : 220);
  }

  function captureEditorViewport() {
    const pane = document.querySelector('.editor-pane');
    const active = document.activeElement;
    const snap = {
      pageX: window.scrollX || 0,
      pageY: window.scrollY || 0,
      paneY: pane?.scrollTop || 0,
      active: active && active !== document.body ? active : null,
      start: null,
      end: null
    };
    try {
      if (snap.active && typeof snap.active.selectionStart === 'number') {
        snap.start = snap.active.selectionStart;
        snap.end = snap.active.selectionEnd;
      }
    } catch (_) {}
    return snap;
  }

  function restoreEditorViewport(snap) {
    if (!snap) return;
    requestAnimationFrame(() => {
      const pane = document.querySelector('.editor-pane');
      if (pane) pane.scrollTop = snap.paneY;
      window.scrollTo({ left: snap.pageX, top: snap.pageY, behavior: 'auto' });
      const active = snap.active;
      if (active?.isConnected) {
        try { active.focus({ preventScroll: true }); } catch (_) {}
        try {
          if (snap.start !== null && typeof active.setSelectionRange === 'function') active.setSelectionRange(snap.start, snap.end ?? snap.start);
        } catch (_) {}
      }
    });
  }

  function scrollPreviewFrameTo(frame, anchor, fallbackY = 0) {
    try {
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      if (!win || !doc) return;
      if (anchor) {
        const target = doc.getElementById(anchor);
        if (target) {
          // Importante: NO usar scrollIntoView() aquí. Desde un iframe puede hacer
          // que el navegador también desplace la página del editor para mostrar el frame.
          const top = target.getBoundingClientRect().top + (win.scrollY || 0);
          win.scrollTo({ left: 0, top: Math.max(0, top), behavior: 'auto' });
          return;
        }
      }
      win.scrollTo({ left: 0, top: Math.max(0, fallbackY || 0), behavior: 'auto' });
    } catch (_) {}
  }

  function updatePreview(anchor = '') {
    const editorSnap = captureEditorViewport();
    const html = buildGalleryHtml(currentModel());
    const frame = $('previewFrame');
    let previousScroll = 0;
    try { previousScroll = frame.contentWindow?.scrollY || 0; } catch (_) {}
    frame.onload = () => {
      scrollPreviewFrameTo(frame, anchor, previousScroll);
      restoreEditorViewport(editorSnap);
    };
    frame.srcdoc = html;
    // Restauramos también en el siguiente frame: así el editor no brinca mientras
    // el iframe está cargando, incluso en Safari/iPhone.
    restoreEditorViewport(editorSnap);
    renderDetachedPreview(html, anchor);
  }
  function detachedPhoneShell() {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Gallery Studio · Vista móvil</title><style>
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#e9e5df;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;color:#282522}
      body{display:grid;place-items:center}.mock-stage{position:fixed;inset:0;display:grid;place-items:center;padding:16px;background:radial-gradient(circle at 50% 16%,#f8f6f2 0,#ebe7e1 46%,#d9d3ca 100%);overflow:hidden}
      .phone-scale-box{position:relative;display:block;flex:0 0 auto}.phone-wrap{display:grid;justify-items:center;gap:10px;transform-origin:top left}.device{position:relative;width:417px;height:876px;padding:12px;border-radius:54px;background:linear-gradient(145deg,#151515,#343434 48%,#0b0b0b);box-shadow:0 35px 90px rgba(35,30,24,.28),inset 0 0 0 1px rgba(255,255,255,.14)}
      .screen-shell{position:relative;width:393px;height:852px;border-radius:43px;background:#f7f4ef;overflow:hidden}.browser-safe{position:absolute;z-index:2;left:0;right:0;top:0;height:62px;background:#f7f4ef;pointer-events:none}.screen{position:absolute;left:0;right:0;top:62px;width:393px;height:790px;border:0;background:#fff;display:block}.island{position:absolute;z-index:5;top:20px;left:50%;transform:translateX(-50%);width:116px;height:31px;border-radius:999px;background:#050505;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);pointer-events:none}.side{position:absolute;background:#1b1b1b;border-radius:3px}.side.s1{left:-3px;top:126px;width:4px;height:30px}.side.s2{left:-3px;top:174px;width:4px;height:55px}.side.s3{right:-3px;top:154px;width:4px;height:77px}.device-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#756e66;background:rgba(255,255,255,.58);border:1px solid rgba(73,65,56,.10);border-radius:999px;padding:7px 11px;backdrop-filter:blur(10px)}
      @media(max-width:470px){.mock-stage{padding:8px}.device-label{display:none}}
    </style></head><body><main class="mock-stage"><div class="phone-scale-box" id="phoneScaleBox"><div class="phone-wrap" id="phoneWrap"><div class="device"><span class="island"></span><span class="side s1"></span><span class="side s2"></span><span class="side s3"></span><div class="screen-shell"><div class="browser-safe" aria-hidden="true"></div><iframe class="screen" id="gallery-mobile-frame" title="Vista móvil de la galería"></iframe></div></div><div class="device-label">Vista móvil · 393 × 852</div></div></div></main><script>
      function fitPhone(){const wrap=document.getElementById('phoneWrap'),box=document.getElementById('phoneScaleBox');if(!wrap||!box)return;wrap.style.transform='none';box.style.width='auto';box.style.height='auto';const naturalW=wrap.offsetWidth||417,naturalH=wrap.offsetHeight||914;const safeX=32,safeY=32,availW=Math.max(220,innerWidth-safeX),availH=Math.max(360,innerHeight-safeY);const scale=Math.min(1,availW/naturalW,availH/naturalH);box.style.width=(naturalW*scale)+'px';box.style.height=(naturalH*scale)+'px';wrap.style.transformOrigin='top left';wrap.style.transform='scale('+scale+')'}
      addEventListener('resize',fitPhone);requestAnimationFrame(fitPhone);setTimeout(fitPhone,80);
    <\/script></body></html>`;
  }
  function renderDetachedPreview(html, anchor = '') {
    if (!detachedPreviewWindow || detachedPreviewWindow.closed) return;
    try {
      const frame = detachedPreviewWindow.document.getElementById('gallery-mobile-frame');
      if (!frame) return;
      let y = 0; try { y = frame.contentWindow?.scrollY || 0; } catch (_) {}
      frame.onload = () => scrollPreviewFrameTo(frame, anchor, y);
      frame.srcdoc = html;
    } catch (e) { console.warn('No se pudo actualizar la vista móvil', e); }
  }
  function openDetachedPreview() {
    const availW = Math.max(520, window.screen?.availWidth || window.innerWidth || 900), availH = Math.max(700, window.screen?.availHeight || window.innerHeight || 980);
    const width = Math.min(560, Math.max(500, availW - 80)), height = Math.min(980, Math.max(760, availH - 70));
    const sx = Number.isFinite(window.screenX) ? window.screenX : (window.screenLeft || 0), sy = Number.isFinite(window.screenY) ? window.screenY : (window.screenTop || 0);
    const left = Math.max(sx + 8, sx + (window.outerWidth || availW) - width - 24), top = Math.max(sy + 12, sy + Math.round(Math.max(0, availH - height) / 2));
    try { if (detachedPreviewWindow && !detachedPreviewWindow.closed) detachedPreviewWindow.close(); } catch (_) {}
    detachedPreviewWindow = window.open('about:blank', 'galleryStudioMobilePreview', `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`);
    if (!detachedPreviewWindow) { alert('El navegador bloqueó la vista móvil. Permite ventanas emergentes para esta página e inténtalo de nuevo.'); return; }
    try {
      detachedPreviewWindow.document.open();
      detachedPreviewWindow.document.write(detachedPhoneShell());
      detachedPreviewWindow.document.close();
    } catch (e) { console.warn('No se pudo preparar el mockup móvil', e); }
    setTimeout(() => { updatePreview(); try { detachedPreviewWindow.focus(); } catch (_) {} }, 40);
  }

  /* ================================================================
     MOTOR AURA DIGITAL v5.6.4 · PERFIL 500 KB
     Copiado en su lógica exacta de la versión estable del usuario.
     ================================================================ */
  const ZIP_IMAGE_TARGET_BYTES_500 = Math.round(500 * 1024);
  const ZIP_IMAGE_MAX_BYTES_500 = Math.round(550 * 1024);
  const ZIP_IMAGE_MIN_BYTES_500 = Math.round(430 * 1024);

  function zipImageSourceExt(file){
    const ext=fileExt(file?.name||'');
    if(ext)return ext;
    const type=String(file?.type||'').toLowerCase();
    if(type==='image/jpeg')return '.jpg';
    if(type==='image/png')return '.png';
    if(type==='image/webp')return '.webp';
    if(type==='image/gif')return '.gif';
    return '.jpg';
  }
  function zipImageOutputType(file){
    const type=String(file?.type||'').toLowerCase(),ext=zipImageSourceExt(file);
    if(type==='image/png'||ext==='.png')return {mime:'image/png',ext:'.png',quality:false};
    if(type==='image/webp'||ext==='.webp')return {mime:'image/webp',ext:'.webp',quality:true};
    if(type==='image/gif'||ext==='.gif')return {mime:'image/gif',ext:'.gif',quality:false,keep:true};
    return {mime:'image/jpeg',ext:ext==='.jpeg'?'.jpeg':'.jpg',quality:true};
  }
  function canvasBlob(canvas,mime,quality){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('No se pudo codificar la imagen.')),mime,quality));
  }
  async function decodeImageForZip(file){
    if('createImageBitmap' in window){
      try{
        const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
        return {source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};
      }catch(e){}
    }
    const url=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>reject(new Error('Formato de imagen no compatible con el navegador.'));el.src=url});
      return {source:img,width:img.naturalWidth||img.width,height:img.naturalHeight||img.height,close:()=>URL.revokeObjectURL(url)};
    }catch(e){URL.revokeObjectURL(url);throw e}
  }
  function drawZipCanvas(decoded,width,height,mime){
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));
    const ctx=canvas.getContext('2d',{alpha:mime!=='image/jpeg'});
    if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height)}
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(decoded.source,0,0,canvas.width,canvas.height);
    return canvas;
  }
  async function bestQualityBlob500(canvas,mime){
    let low=.34,high=.96,best=null,bestDelta=Infinity;
    for(let i=0;i<10;i++){
      const q=(low+high)/2,blob=await canvasBlob(canvas,mime,q),size=blob.size;
      if(size<=ZIP_IMAGE_MAX_BYTES_500){
        const delta=Math.abs(size-ZIP_IMAGE_TARGET_BYTES_500);
        if(delta<bestDelta){best=blob;bestDelta=delta}
        low=q;
      }else high=q;
    }
    if(!best){
      const blob=await canvasBlob(canvas,mime,.30);
      if(blob.size<=ZIP_IMAGE_MAX_BYTES_500)best=blob; else return blob;
    }
    return best;
  }
  async function optimizeImageForZipAura500(file){
    if(!file)return null;
    const sourceExt=zipImageSourceExt(file),kind=zipImageOutputType(file);
    if(kind.keep||file.size<=ZIP_IMAGE_MAX_BYTES_500)return {blob:file,ext:sourceExt,optimized:false,sourceSize:file.size,finalSize:file.size};
    let decoded;
    try{
      decoded=await decodeImageForZip(file);
      let width=decoded.width,height=decoded.height;
      const maxSide=Math.max(width,height);
      if(maxSide>3000){const scale=3000/maxSide;width=Math.round(width*scale);height=Math.round(height*scale)}
      let blob=null;
      for(let pass=0;pass<8;pass++){
        const canvas=drawZipCanvas(decoded,width,height,kind.mime);
        blob=kind.quality?await bestQualityBlob500(canvas,kind.mime):await canvasBlob(canvas,kind.mime);
        canvas.width=1;canvas.height=1;
        if(blob.size<=ZIP_IMAGE_MAX_BYTES_500)break;
        const ratio=Math.sqrt(ZIP_IMAGE_TARGET_BYTES_500/blob.size);
        const scale=Math.max(.54,Math.min(.88,ratio*.96));
        width=Math.max(260,Math.round(width*scale));height=Math.max(260,Math.round(height*scale));
      }
      if(blob&&!kind.quality&&blob.size<ZIP_IMAGE_MIN_BYTES_500&&file.size>ZIP_IMAGE_MAX_BYTES_500){
        for(let tune=0;tune<3;tune++){
          const grow=Math.min(1.12,Math.sqrt(ZIP_IMAGE_TARGET_BYTES_500/blob.size)*.99);
          const nextWidth=Math.min(decoded.width,Math.max(width+1,Math.round(width*grow)));
          const nextHeight=Math.min(decoded.height,Math.max(height+1,Math.round(height*grow)));
          if(nextWidth===width&&nextHeight===height)break;
          const canvas=drawZipCanvas(decoded,nextWidth,nextHeight,kind.mime),candidate=await canvasBlob(canvas,kind.mime);canvas.width=1;canvas.height=1;
          if(candidate.size>ZIP_IMAGE_MAX_BYTES_500)break;
          blob=candidate;width=nextWidth;height=nextHeight;
          if(blob.size>=ZIP_IMAGE_MIN_BYTES_500)break;
        }
      }
      if(!blob||blob.size>ZIP_IMAGE_MAX_BYTES_500){
        return {blob:file,ext:sourceExt,optimized:false,sourceSize:file.size,finalSize:file.size};
      }
      return {blob,ext:kind.ext,optimized:true,sourceSize:file.size,finalSize:blob.size};
    }catch(e){
      console.warn('Gallery Studio/Aura: no se pudo optimizar',file.name,e);
      return {blob:file,ext:sourceExt,optimized:false,sourceSize:file.size,finalSize:file.size};
    }finally{decoded?.close?.()}
  }

  function profileSettings(profile) {
    if (+profile === 200) return { target:Math.round(200*1024), max:Math.round(230*1024), min:Math.round(170*1024) };
    if (+profile === 300) return { target:Math.round(300*1024), max:Math.round(340*1024), min:Math.round(260*1024) };
    return { target:ZIP_IMAGE_TARGET_BYTES_500, max:ZIP_IMAGE_MAX_BYTES_500, min:ZIP_IMAGE_MIN_BYTES_500 };
  }
  async function optimizeImageAuraScaled(file, profile) {
    if (+profile === 500) return optimizeImageForZipAura500(file);
    const {target,max,min} = profileSettings(profile);
    if(!file)return null;
    const sourceExt=zipImageSourceExt(file),kind=zipImageOutputType(file);
    if(kind.keep||file.size<=max)return {blob:file,ext:sourceExt,optimized:false,sourceSize:file.size,finalSize:file.size};
    let decoded;
    const bestQuality = async (canvas,mime) => {
      let low=.34,high=.96,best=null,bestDelta=Infinity;
      for(let i=0;i<10;i++){
        const q=(low+high)/2,blob=await canvasBlob(canvas,mime,q),size=blob.size;
        if(size<=max){const delta=Math.abs(size-target);if(delta<bestDelta){best=blob;bestDelta=delta}low=q}else high=q;
      }
      if(!best){const blob=await canvasBlob(canvas,mime,.30);if(blob.size<=max)best=blob;else return blob}return best;
    };
    try{
      decoded=await decodeImageForZip(file); let width=decoded.width,height=decoded.height;
      const maxSide=Math.max(width,height); if(maxSide>3000){const scale=3000/maxSide;width=Math.round(width*scale);height=Math.round(height*scale)}
      let blob=null;
      for(let pass=0;pass<8;pass++){
        const canvas=drawZipCanvas(decoded,width,height,kind.mime); blob=kind.quality?await bestQuality(canvas,kind.mime):await canvasBlob(canvas,kind.mime); canvas.width=1;canvas.height=1;
        if(blob.size<=max)break; const ratio=Math.sqrt(target/blob.size),scale=Math.max(.54,Math.min(.88,ratio*.96)); width=Math.max(260,Math.round(width*scale));height=Math.max(260,Math.round(height*scale));
      }
      if(blob&&!kind.quality&&blob.size<min&&file.size>max){for(let tune=0;tune<3;tune++){const grow=Math.min(1.12,Math.sqrt(target/blob.size)*.99),nextWidth=Math.min(decoded.width,Math.max(width+1,Math.round(width*grow))),nextHeight=Math.min(decoded.height,Math.max(height+1,Math.round(height*grow)));if(nextWidth===width&&nextHeight===height)break;const canvas=drawZipCanvas(decoded,nextWidth,nextHeight,kind.mime),candidate=await canvasBlob(canvas,kind.mime);canvas.width=1;canvas.height=1;if(candidate.size>max)break;blob=candidate;width=nextWidth;height=nextHeight;if(blob.size>=min)break}}
      if(!blob||blob.size>max)return {blob:file,ext:sourceExt,optimized:false,sourceSize:file.size,finalSize:file.size};
      return {blob,ext:kind.ext,optimized:true,sourceSize:file.size,finalSize:blob.size};
    } catch(e) { console.warn('No se pudo optimizar',file.name,e); return {blob:file,ext:sourceExt,optimized:false,sourceSize:file.size,finalSize:file.size}; }
    finally { decoded?.close?.(); }
  }

  async function optimizeCached(file, profile) {
    const key = `${profile}|${fileFingerprint(file)}`;
    if (!optimizationCache.has(key)) optimizationCache.set(key, optimizeImageAuraScaled(file, profile));
    return optimizationCache.get(key);
  }
  async function sha256Hex(blob) {
    if (hashCache.has(blob)) return hashCache.get(blob);
    const promise = blob.arrayBuffer().then(async buffer => {
      // Safari (y editores abiertos como archivo local) no siempre exponen crypto.subtle.
      // El hash solo identifica archivos iguales para no subir copias duplicadas;
      // no se utiliza para seguridad ni autenticación.
      if (globalThis.crypto?.subtle?.digest) {
        try {
          const digest = await crypto.subtle.digest('SHA-256', buffer);
          return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
        } catch(e) { console.warn('WebCrypto no disponible, usando identificación local:', e); }
      }
      const bytes = new Uint8Array(buffer);
      let a = 0x811c9dc5, b = 0x9e3779b9, c = 0x85ebca6b, d = 0x27d4eb2f;
      for (let i=0; i<bytes.length; i++) {
        const v=bytes[i];
        a=Math.imul(a ^ v, 0x01000193);
        b=Math.imul(b ^ (v + (i & 255)), 0x85ebca6b);
        c=Math.imul(c ^ (v + 17), 0xc2b2ae35);
        d=Math.imul(d ^ (v + 71), 0x27d4eb2d);
      }
      return [a,b,c,d,bytes.length].map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');
    });
    hashCache.set(blob, promise); return promise;
  }

  function collectMedia() {
    const refs = [];
    if (state.studioLogo?.file) refs.push({ kind:'logo', id:'logo', file:state.studioLogo.file, previewBlob:state.studioLogo.previewBlob });
    if (state.hero?.file) refs.push({ kind:'hero', id:'hero', file:state.hero.file, previewBlob:state.hero.previewBlob });
    SECTION_DEFS.forEach(([id]) => { const b = state.sections[id].banner; if (b?.file) refs.push({kind:'banner',id,file:b.file,previewBlob:b.previewBlob}); });
    state.photos.forEach(p => refs.push({kind:'photo',id:p.id,file:p.file,previewBlob:p.previewBlob}));
    return refs;
  }

  function buildExportConfig(assetRefs) {
    return {
      schemaVersion: 1,
      studioVersion: VERSION,
      optimizer: { engine:'Aura Digital v5.6.4', profileKB:state.imageProfile, exactAura500:state.imageProfile===500 },
      appearance: { style:state.style, coverStyle:state.coverStyle, mobileCoverMode:state.mobileCoverMode, coverBoxOpacity:state.coverBoxOpacity, revealStyle:state.revealStyle, studioName:state.studioName, brandMode:state.brandMode, logoPath:assetRefs.logo || '', accentColor:state.accentColor, backgroundColor:state.backgroundColor, textColor:state.textColor },
      social: { title:state.shareTitle||'', description:state.shareDescription||'', imageSource:state.shareImageSource||'hero', publicUrl:state.sharePublicUrl||'', imagePath:'og-preview.jpg' },
      event: { title:state.title, date:state.date, heroEyebrow:state.heroEyebrow, subtitle:state.subtitle, description:state.description, heroX:state.heroX, heroY:state.heroY, heroPath:assetRefs.hero || '' },
      sectionOrder: orderedContentIds(),
      sections: SECTION_DEFS.map(([id,fallbackLabel]) => { const s=state.sections[id]; return {id,label:s.label||fallbackLabel,title:s.title,enabled:s.enabled,x:s.x,y:s.y,layout:s.layout||'masonry',highlightsEnabled:!!s.highlightsEnabled,highlightsCount:6,galleryDisplay:s.galleryDisplay==='expanded'?'expanded':'manual',bannerPath:assetRefs.banners[id]||''}; }),
      photos: state.photos.map(p => ({id:p.id,name:p.file.name,section:p.section,width:p.width||0,height:p.height||0,focusX:p.focusX??50,focusY:p.focusY??50,fit:p.fit==='contain'?'contain':'cover',path:assetRefs.photos[p.id]||''})),
      videos: { enabled:state.videosEnabled, eyebrow:state.videosEyebrow, title:state.videosTitle, items:[{url:state.video1,label:state.video1Label||'Video 1'},{url:state.video2,label:state.video2Label||'Video 2'}].filter(v=>v.url), urls:[state.video1,state.video2].filter(Boolean) },
      music: { enabled:!!state.music, path:assetRefs.music || '', name:state.music?.file?.name || '', title:state.musicTitle || '', artist:state.musicArtist || '', playerVisible:state.musicPlayerVisible !== false, autostart:false, loop:state.musicLoop !== false },
      download: { enabled:!!state.downloadEnabled, url:state.downloadUrl || '' }
    };
  }

  async function buildPackage(onProgress = () => {}, preferredPublicUrl = '') {
    const refs = collectMedia(), assetRefs = { logo:'', hero:'', banners:{}, photos:{}, music:'' }, assets = [], hashToPath = new Map();
    let originalTotal = 0, finalTotal = 0, optimizedCount = 0, keptCount = 0, fallbackLarge = 0;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]; originalTotal += ref.file.size;
      onProgress({stage:'optimize', current:i, total:refs.length, name:ref.file.name});
      let out, hash;
      try {
        out = await optimizeCached(ref.file, state.imageProfile);
        // Safari puede mostrar la vista previa de un archivo que ya no permite leer.
        // Comprobamos la lectura real AHORA, antes de construir el ZIP o publicar.
        hash = await sha256Hex(out.blob);
      } catch (error) {
        if (!ref.previewBlob) {
          throw new Error(`No se pudo leer la fotografía «${ref.file.name}». Selecciónala de nuevo desde la carpeta original y vuelve a intentar. Detalle: ${error?.message || error}`);
        }
        console.warn('Gallery Studio: original no disponible; recuperando desde vista previa', ref.file.name, error);
        try {
          const fallback = new File([ref.previewBlob], `respaldo-${ref.file.name.replace(/\.[^.]+$/, '')}.${ref.previewBlob.type === 'image/png' ? 'png' : 'jpg'}`, { type:ref.previewBlob.type || 'image/jpeg' });
          out = await optimizeImageAuraScaled(fallback, state.imageProfile);
          hash = await sha256Hex(out.blob);
        } catch (fallbackError) {
          throw new Error(`No se pudo preparar «${ref.file.name}», ni siquiera desde su vista previa. Vuelve a cargar esa imagen. Detalle: ${fallbackError?.message || fallbackError}`);
        }
      }
      finalTotal += out.finalSize; if (out.optimized) optimizedCount++; else keptCount++;
      const max = profileSettings(state.imageProfile).max; if (!out.optimized && out.finalSize > max) fallbackLarge++;
      let path = hashToPath.get(hash);
      if (!path) { path = `assets/img-${String(assets.length + 1).padStart(3,'0')}${out.ext}`; hashToPath.set(hash,path); assets.push({path,blob:out.blob,size:out.finalSize,sourceName:ref.file.name}); }
      if (ref.kind === 'logo') assetRefs.logo = path;
      else if (ref.kind === 'hero') assetRefs.hero = path;
      else if (ref.kind === 'banner') assetRefs.banners[ref.id] = path;
      else assetRefs.photos[ref.id] = path;
      onProgress({stage:'optimize', current:i+1, total:refs.length, name:ref.file.name});
    }
    let musicSize = 0;
    if (state.music?.file) {
      const mf = state.music.file, ext = fileExt(mf.name) || (mf.type === 'audio/mp4' ? '.m4a' : '.mp3');
      const safeExt = /^(\.mp3|\.m4a|\.aac|\.ogg)$/i.test(ext) ? ext.toLowerCase() : '.mp3';
      assetRefs.music = `assets/music${safeExt}`;
      const backup = state.music.backupBlob || await state.music.backupPromise;
      let audioBlob = backup || mf;
      try { await audioBlob.slice(0, 16).arrayBuffer(); }
      catch (e) {
        if (backup) audioBlob = backup;
        else throw new Error(`No se puede leer «${mf.name}». Vuelve a seleccionar el archivo de música. Detalle: ${e?.message || e}`);
      }
      musicSize = audioBlob.size || 0; finalTotal += musicSize; originalTotal += musicSize;
      assets.push({path:assetRefs.music,blob:audioBlob,size:musicSize,sourceName:mf.name});
    }
    const socialBlob=await createSocialImage();
    assets.push({path:'og-preview.jpg',blob:socialBlob,size:socialBlob.size,sourceName:'Miniatura social 1200x630'});
    finalTotal+=socialBlob.size;
    const configuredUrl=preferredPublicUrl||state.sharePublicUrl||(githubUser?suggestedPagesUrl(githubUser.login,sanitizeFilePart($('githubRepo').value||state.title)):'');
    const publicUrl=absoluteGalleryBase(configuredUrl);
    if(configuredUrl && !publicUrl) throw new Error('La dirección pública para la miniatura no es válida. Usa una URL que empiece con https://.');
    const config = buildExportConfig(assetRefs);
    config.social.publicUrl=publicUrl;
    const indexHtml = buildGalleryHtml({...currentModel(assetRefs), sharePublicUrl: publicUrl});
    const configText = JSON.stringify(config, null, 2);
    const report = { photos:state.photos.length, mediaInputs:refs.length + (state.music?.file ? 1 : 0), uniqueAssets:assets.length, originalTotal, finalTotal, musicSize, optimizedCount, keptCount, fallbackLarge, profile:state.imageProfile };
    showOptimizationReport(report);
    return { indexHtml, configText, config, assets, report };
  }

  function showOptimizationReport(r) {
    const warn = r.fallbackLarge ? `<br><b>Atención:</b> ${r.fallbackLarge} archivo(s) quedaron por encima del máximo porque el motor Aura conserva el original cuando no puede bajarlo sin salir de su lógica (suele ocurrir con PNG/GIF).` : '';
    $('optimizationReport').innerHTML = `<b>Última preparación:</b> ${r.photos} fotos · ${r.uniqueAssets} archivos físicos · ${formatBytes(r.originalTotal)} originales → <b>${formatBytes(r.finalTotal)}</b> publicados · perfil ${r.profile} KB · ${r.optimizedCount} optimizadas · ${r.keptCount} conservadas.${r.musicSize ? ` · música ${formatBytes(r.musicSize)}` : ''}.${warn}`;
  }

  async function generateZip() {
    if (exportBusy) return; exportBusy = true; const btn=$('generateZip'), old=btn.textContent; btn.disabled=true; btn.textContent='Preparando…';
    try {
      const pkg = await buildPackage(p => { if (p.stage==='optimize') btn.textContent=`Optimizando ${p.current}/${p.total}`; });
      const zip = new JSZip();
      zip.file('index.html', pkg.indexHtml); zip.file('config.json', pkg.configText); zip.file('.nojekyll', '');
      pkg.assets.forEach(a => zip.file(a.path, a.blob, {binary:true,compression:'STORE'}));
      btn.textContent='Empaquetando…';
      const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${sanitizeFilePart(state.title)}-galeria.zip`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      $('optimizationReport').innerHTML += `<br><b>ZIP final:</b> ${formatBytes(blob.size)}.`;
    } catch(e) { console.error(e); alert(`No se pudo generar el ZIP: ${e.message || e}\n\nSi Safari perdió acceso al archivo original, el editor intentará recuperar la copia de vista previa automáticamente.`); }
    finally { exportBusy=false; btn.disabled=false; btn.textContent=old; }
  }

  function textToBase64(str) {
    const bytes = new TextEncoder().encode(str); let binary=''; const step=0x8000;
    for(let i=0;i<bytes.length;i+=step) binary += String.fromCharCode(...bytes.subarray(i,i+step));
    return btoa(binary);
  }
  function blobToBase64(blob) { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=reject;r.readAsDataURL(blob)}); }

  const GITHUB_API_VERSION = '2022-11-28';

  class GithubPublishError extends Error {
    constructor(message, status = 0, data = null) {
      super(message);
      this.name = 'GithubPublishError';
      this.status = status;
      this.data = data;
    }
  }

  function githubDelay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async function githubRequest(path, options = {}) {
    const token = $('githubToken').value.trim();
    if (!token) throw new GithubPublishError('Falta conectar GitHub.', 401);
    const method = options.method || 'GET';
    const headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      ...(options.headers || {})
    };
    if (options.body != null) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(`https://api.github.com${path}`, {
        method,
        headers,
        body: options.body,
        cache: 'no-store'
      });
    } catch (err) {
      throw new GithubPublishError('No se pudo conectar con la API de GitHub. Revisa tu conexión.', 0, err);
    }
    if (res.status === 204) return null;
    const raw = await res.text();
    let data = null;
    if (raw) { try { data = JSON.parse(raw); } catch (_) { data = raw; } }
    if (!res.ok) {
      const detail = data && typeof data === 'object' ? (data.message || data.error) : '';
      throw new GithubPublishError(detail || `GitHub respondió ${res.status}.`, res.status, data);
    }
    return data;
  }

  function githubFriendlyError(err) {
    if (err?.status === 401) return 'GitHub rechazó el token. Vuelve a conectarlo.';
    if (err?.status === 403) return 'Faltan permisos. El token necesita escritura en Contents, Administration y Pages. Si es fine-grained, también debe tener acceso al repositorio.';
    if (err?.status === 404) return 'GitHub no encontró el recurso o el token no tiene acceso al repositorio.';
    if (err?.status === 409) return err.message || 'GitHub reportó un conflicto. Si el repositorio estaba vacío, Gallery Studio intentará repararlo automáticamente.';
    if (err?.status === 422) return 'GitHub rechazó la operación. Revisa el nombre del repositorio y los permisos del token.';
    return err?.message || String(err || 'No se pudo publicar en GitHub.');
  }

  async function connectGitHub() {
    const btn = $('githubConnect');
    const old = btn?.textContent;
    $('githubAuthStatus').textContent = 'Conectando…';
    if (btn) { btn.disabled = true; btn.textContent = 'Conectando…'; }
    try {
      githubUser = await githubRequest('/user');
      $('githubAuthStatus').textContent = `Conectado: @${githubUser.login}`;
      if (!$('githubRepo').value.trim()) $('githubRepo').value = sanitizeFilePart(state.title);
      $('githubPublish').disabled = false;
      return true;
    } catch (e) {
      githubUser = null;
      $('githubAuthStatus').textContent = `Error: ${githubFriendlyError(e)}`;
      $('githubPublish').disabled = true;
      return false;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  }

  async function ensureRepo(owner, repo) {
    const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    try {
      const found = await githubRequest(repoPath);
      if (found.private) throw new GithubPublishError('El repositorio es privado. Para GitHub Pages público usa un repositorio público.', 409, found);
      return { repo: found, created: false };
    } catch (e) {
      if (e.status !== 404) throw e;
      // IMPORTANTE: GitHub no permite crear refs en un repositorio totalmente vacío.
      // Aura inicializa el repositorio para que exista una rama y un commit padre.
      const created = await githubRequest('/user/repos', {
        method: 'POST',
        body: JSON.stringify({
          name: repo,
          private: false,
          auto_init: true,
          description: 'Galería digital publicada con Gallery Studio',
          has_issues: false,
          has_projects: false,
          has_wiki: false
        })
      });
      return { repo: created, created: true };
    }
  }

  async function waitForRef(owner, repo, branch, attempts = 8) {
    let lastError = null;
    for (let i = 0; i < attempts; i++) {
      try {
        return await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`);
      } catch (e) {
        lastError = e;
        // GitHub usa 404 mientras la rama aún no existe y puede devolver 409
        // mientras termina de crear el repositorio o si el repo está vacío.
        if (![404, 409].includes(e.status)) throw e;
        await githubDelay(450 + (i * 220));
      }
    }
    throw lastError || new GithubPublishError('GitHub todavía no creó la rama del repositorio.');
  }

  async function initializeEmptyRepo(owner, repoName) {
    // La v1.0.0 pudo dejar un repositorio existente pero SIN ramas. GitHub
    // documenta que la Git Data API devuelve 409 en ese caso y recomienda
    // inicializarlo con Contents API antes de usar refs/trees/commits.
    const initPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/contents/.gallery-init`;
    const payload = {
      message: 'Inicializar repositorio para Gallery Studio',
      content: textToBase64('Gallery Studio\n')
    };
    await githubRequest(initPath, { method: 'PUT', body: JSON.stringify(payload) });
    // Refrescar metadatos: GitHub ya debe conocer la rama predeterminada.
    return githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`);
  }

  async function ensureRepoReady(owner, repoName, repo) {
    let currentRepo = repo;
    let branch = currentRepo.default_branch || 'main';
    try {
      const ref = await waitForRef(owner, repoName, branch, 6);
      return { repo: currentRepo, branch, ref, initialized: false };
    } catch (e) {
      if (![404, 409].includes(e.status)) throw e;
    }

    // Si el repositorio quedó vacío por una versión anterior, repararlo en lugar
    // de obligar al usuario a borrarlo o cambiar de nombre.
    $('githubPublishStatus').textContent = 'El repositorio existe pero está vacío. Inicializándolo…';
    currentRepo = await initializeEmptyRepo(owner, repoName);
    branch = currentRepo.default_branch || 'main';
    const ref = await waitForRef(owner, repoName, branch, 10);
    return { repo: currentRepo, branch, ref, initialized: true };
  }

  async function uploadGitBlob(owner, repo, contentBase64) {
    return githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: contentBase64, encoding: 'base64' })
    });
  }

  async function enablePages(owner, repo, branch) {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pages`;
    let existing = null;
    try { existing = await githubRequest(path); }
    catch (e) { if (e.status !== 404) throw e; }

    if (existing) {
      await githubRequest(path, { method: 'PUT', body: JSON.stringify({ source: { branch, path: '/' } }) });
    } else {
      let last = null;
      for (let i = 0; i < 4; i++) {
        try {
          return await githubRequest(path, { method: 'POST', body: JSON.stringify({ source: { branch, path: '/' } }) });
        } catch (e) {
          last = e;
          if (![409, 422].includes(e.status) || i === 3) throw e;
          await githubDelay(850 + (i * 500));
        }
      }
      if (last) throw last;
    }
    try { return await githubRequest(path); } catch (_) { return existing; }
  }

  async function publishGitHub() {
    if (!githubUser) { const ok = await connectGitHub(); if (!ok || !githubUser) return; }
    const repoName = sanitizeFilePart($('githubRepo').value || state.title);
    $('githubRepo').value = repoName;
    const status = $('githubPublishStatus'), box = $('publishProgress'), bar = $('publishBar'), label = $('publishLabel'), btn = $('githubPublish');
    box.hidden = false; bar.value = 0; bar.max = 1; btn.disabled = true; status.textContent = 'Preparando galería…';
    const oldLabel = btn.textContent; btn.textContent = 'Publicando…';
    try {
      let suggestedPublicUrl=state.sharePublicUrl.trim();
      if(!suggestedPublicUrl && githubUser?.login){
        try{const existingPages=await githubRequest(`/repos/${encodeURIComponent(githubUser.login)}/${encodeURIComponent(repoName)}/pages`);suggestedPublicUrl=existingPages?.html_url||'';}
        catch(e){if(e.status!==404 && e.status!==403)console.warn('No fue posible consultar Pages antes de publicar',e);}
      }
      if(!suggestedPublicUrl)suggestedPublicUrl=suggestedPagesUrl(githubUser.login,repoName);
      suggestedPublicUrl=resolvedGalleryPublicUrl(githubUser.login,repoName,suggestedPublicUrl);
      const pkg = await buildPackage(p => {
        if (p.stage === 'optimize') {
          bar.value = .5 * (p.total ? p.current / p.total : 0);
          label.textContent = `Optimizando ${p.current}/${p.total}`;
        }
      }, suggestedPublicUrl);

      status.textContent = 'Revisando repositorio…'; bar.value = .53; label.textContent = 'Conectando con GitHub';
      const { repo, created } = await ensureRepo(githubUser.login, repoName);
      const owner = githubUser.login;

      // Repara automáticamente repositorios vacíos que pudieron quedar de v1.0.0.
      const ready = await ensureRepoReady(owner, repoName, repo);
      const branch = ready.branch;
      const parentSha = ready.ref?.object?.sha;
      if (!parentSha) throw new GithubPublishError('No se pudo leer la rama principal del repositorio.');

      const files = [
        { path: 'index.html', base64: textToBase64(pkg.indexHtml) },
        { path: 'config.json', base64: textToBase64(pkg.configText) },
        { path: '.nojekyll', base64: textToBase64('') }
      ];
      for (const a of pkg.assets) files.push({ path: a.path, base64: await blobToBase64(a.blob) });

      const entries = new Array(files.length); let done = 0, next = 0;
      const workers = Array.from({ length: Math.min(4, files.length) }, async () => {
        while (true) {
          const i = next++; if (i >= files.length) break;
          const f = files[i];
          const blob = await uploadGitBlob(owner, repoName, f.base64);
          entries[i] = { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
          done++;
          bar.value = .55 + .30 * (done / files.length);
          label.textContent = `Subiendo archivos ${done}/${files.length}`;
        }
      });
      await Promise.all(workers);

      bar.value = .88; label.textContent = 'Creando publicación';
      const tree = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/trees`, {
        method: 'POST', body: JSON.stringify({ tree: entries })
      });
      const commit = await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/commits`, {
        method: 'POST', body: JSON.stringify({
          message: `Publicar galería ${new Date().toISOString()}`,
          tree: tree.sha,
          parents: [parentSha]
        })
      });
      await githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false })
      });

      bar.value = .94; label.textContent = 'Activando GitHub Pages';
      const pages = await enablePages(owner, repoName, branch);
      const fallback = repoName.toLowerCase() === `${owner.toLowerCase()}.github.io`
        ? `https://${owner}.github.io/`
        : `https://${owner}.github.io/${repoName}/`;
      const url = resolvedGalleryPublicUrl(owner,repoName,pages?.html_url||fallback);

      bar.value = 1; label.textContent = 'Publicación enviada';
      status.textContent = created
        ? 'Galería publicada. GitHub Pages puede tardar unos segundos en completar el primer despliegue.'
        : 'Galería actualizada correctamente.';
      state.sharePublicUrl=url; $('sharePublicUrl').value=url;
      $('githubPagesUrl').value = url; $('githubPagesLink').href = url; $('githubPagesActions').hidden = false;
      btn.textContent = 'Actualizar publicación';
    } catch (e) {
      console.error(e);
      status.textContent = `No se pudo publicar: ${githubFriendlyError(e)}`;
      box.hidden = true;
      if (e.status === 401) { githubUser = null; $('githubAuthStatus').textContent = 'Sesión de GitHub vencida.'; }
    } finally {
      btn.disabled = !githubUser;
      if (btn.textContent === 'Publicando…') btn.textContent = oldLabel;
    }
  }

  function normalizeConfigUrl(input) {
    let s=String(input||'').trim(); if(!s) throw new Error('Escribe una URL.');
    if(/^https?:\/\/github\.com\//i.test(s)&&s.includes('/blob/')) { const u=new URL(s),parts=u.pathname.split('/').filter(Boolean); if(parts.length>=5){const [owner,repo,,branch,...path]=parts;s=`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path.join('/')}`;} }
    if(!/\.json(?:[?#].*)?$/i.test(s)) s=s.replace(/\/?$/,'/')+'config.json';
    return s;
  }
  async function fetchAssetAsFile(url, name) {
    const res=await fetch(url); if(!res.ok)throw new Error(`No se pudo recuperar ${name || url}`); const blob=await res.blob(); return new File([blob],name||decodeURIComponent(new URL(url).pathname.split('/').pop()||'imagen'),{type:blob.type,lastModified:Date.now()});
  }
  async function applyConfig(config, configUrl = null) {
    const a=config.appearance||{},e=config.event||{};
    state.style=a.style||'organic';state.coverStyle=['classic','centered','split','fineart'].includes(a.coverStyle)?a.coverStyle:'classic';state.mobileCoverMode=['mixed','horizontal','adaptive'].includes(a.mobileCoverMode)?a.mobileCoverMode:'mixed';state.coverBoxOpacity=clamp(a.coverBoxOpacity??91,0,100);state.revealStyle=['soft','editorial','none'].includes(a.revealStyle)?a.revealStyle:'soft';state.studioName=a.studioName??'Nuestra Historia';state.brandMode=a.brandMode==='logo'?'logo':'text';state.accentColor=a.accentColor||'#a58d63';state.backgroundColor=a.backgroundColor||'#f5f2ec';state.textColor=a.textColor||'#2f2c28';
    state.title=e.title||'';state.date=e.date||'';state.shareTitle=config.social?.title||'';state.shareDescription=config.social?.description||'';state.shareImageSource=config.social?.imageSource||'hero';state.sharePublicUrl=config.social?.publicUrl||'';state.heroEyebrow=e.heroEyebrow??'NUESTRA HISTORIA';state.subtitle=e.subtitle||'';state.description=e.description||'';state.heroX=e.heroX??50;state.heroY=e.heroY??50;
    const configuredOrder = Array.isArray(config.sectionOrder) ? config.sectionOrder : (Array.isArray(config.sections) ? config.sections.map(x=>x.id) : []);
    const validContentIds = [...SECTION_DEFS.map(([id])=>id), 'videos'];
    state.sectionOrder = configuredOrder.filter(id=>validContentIds.includes(id));
    validContentIds.forEach(id=>{if(!state.sectionOrder.includes(id))state.sectionOrder.push(id);});
    SECTION_DEFS.forEach(([id,label,defTitle])=>{const c=(config.sections||[]).find(x=>x.id===id)||{};const fallbackLayout=id==='vals'?'carousel':(id==='getting-ready'||id==='misa'?'editorial':'masonry');state.sections[id]={...state.sections[id],id,label:c.label||label,title:c.title||defTitle,enabled:c.enabled!==false,x:c.x??50,y:c.y??50,layout:['masonry','editorial','editorial-pro','organized','carousel','story','narrative','collage','scattered','filmstrip','sorted','vertical','horizontal','rectangular','square','polaroid_pro'].includes(c.layout)?c.layout:(c.layout==='sequence'?'story':fallbackLayout),highlightsEnabled:!!c.highlightsEnabled,highlightsCount:6,galleryDisplay:c.galleryDisplay==='expanded'?'expanded':'manual',banner:null};});
    state.videosEnabled=config.videos?.enabled!==false;state.videosEyebrow=config.videos?.eyebrow??'PELÍCULA';state.videosTitle=config.videos?.title??'Videos del evento';const videoItems=Array.isArray(config.videos?.items)?config.videos.items:[];state.video1=videoItems[0]?.url||config.videos?.urls?.[0]||'';state.video1Label=videoItems[0]?.label||'Video 1';state.video2=videoItems[1]?.url||config.videos?.urls?.[1]||'';state.video2Label=videoItems[1]?.label||'Video 2';state.musicAutostart=false;state.musicLoop=config.music?.loop!==false;state.musicPlayerVisible=config.music?.playerVisible!==false;state.musicTitle=config.music?.title||'';state.musicArtist=config.music?.artist||'';state.downloadEnabled=!!config.download?.enabled;state.downloadUrl=config.download?.url||'';state.imageProfile=+[200,300,500].includes(+config.optimizer?.profileKB)?+config.optimizer.profileKB:500;
    // Limpiar medios existentes.
    if(state.studioLogo?.previewUrl&&previewUrls.has(state.studioLogo.previewUrl)){URL.revokeObjectURL(state.studioLogo.previewUrl);previewUrls.delete(state.studioLogo.previewUrl)}state.studioLogo=null;
    if(state.music?.previewUrl&&previewUrls.has(state.music.previewUrl)){URL.revokeObjectURL(state.music.previewUrl);previewUrls.delete(state.music.previewUrl)}state.music=null;
    if(state.hero?.previewUrl&&previewUrls.has(state.hero.previewUrl)){URL.revokeObjectURL(state.hero.previewUrl);previewUrls.delete(state.hero.previewUrl)}state.hero=null;
    state.photos.forEach(p=>{if(p.previewUrl&&previewUrls.has(p.previewUrl)){URL.revokeObjectURL(p.previewUrl);previewUrls.delete(p.previewUrl)}});state.photos=[];
    if(configUrl){
      const base=new URL('.',configUrl).href;const jobs=[];
      if(a.logoPath)jobs.push(async()=>{const f=await fetchAssetAsFile(new URL(a.logoPath,base).href,a.logoPath.split('/').pop());replaceStateLogo(await createLogoMediaRecord(f,1400));});
      if(config.music?.path)jobs.push(async()=>{const f=await fetchAssetAsFile(new URL(config.music.path,base).href,config.music.name||config.music.path.split('/').pop());replaceStateMusic(f);const fallback=guessTrackInfo(f.name);state.musicTitle=state.musicTitle||fallback.title;state.musicArtist=state.musicArtist||fallback.artist;await updateTrackFromTags(f,true);});
      if(e.heroPath)jobs.push(async()=>{const f=await fetchAssetAsFile(new URL(e.heroPath,base).href,e.heroPath.split('/').pop());replaceStateHero(await createMediaRecord(f,2000));});
      for(const c of config.sections||[]){if(c.bannerPath&&state.sections[c.id])jobs.push(async()=>{const f=await fetchAssetAsFile(new URL(c.bannerPath,base).href,c.bannerPath.split('/').pop());state.sections[c.id].banner=await createMediaRecord(f,1900);});}
      for(const p of config.photos||[]){if(!p.path)continue;jobs.push(async()=>{const f=await fetchAssetAsFile(new URL(p.path,base).href,p.name||p.path.split('/').pop());const media=await createMediaRecord(f,1600);state.photos.push({id:p.id||`p${++photoSeq}`,file:f,previewUrl:media.previewUrl,previewBlob:media.previewBlob,width:media.width||p.width||0,height:media.height||p.height||0,section:p.section||'getting-ready',focusX:p.focusX??50,focusY:p.focusY??50,fit:p.fit==='contain'?'contain':'cover'});});}
      let done=0;await mapLimit(jobs,3,async job=>{await job();done++;$('configStatus').textContent=`Recuperando medios ${done}/${jobs.length}`;});
    }
    syncFormFromState();buildSectionEditor();buildTargetOptions();renderPhotoList();schedulePreview('',true);
  }
  function syncFormFromState(){
    $('galleryStyle').value=state.style;$('coverStyle').value=state.coverStyle;$('mobileCoverMode').value=state.mobileCoverMode;$('coverBoxOpacity').value=state.coverBoxOpacity;$('coverBoxOpacityOut').value=`${state.coverBoxOpacity}%`;$('revealStyle').value=state.revealStyle;$('studioName').value=state.studioName;$('brandMode').value=state.brandMode;$('accentColor').value=state.accentColor;$('backgroundColor').value=state.backgroundColor;$('textColor').value=state.textColor;
    $('shareTitle').value=state.shareTitle||'';$('shareDescription').value=state.shareDescription||'';$('sharePublicUrl').value=state.sharePublicUrl||'';refreshSharePreview();
    $('heroEyebrow').value=state.heroEyebrow??'';$('eventTitle').value=state.title;$('eventDate').value=state.date;$('eventSubtitle').value=state.subtitle;$('eventDescription').value=state.description;$('heroX').value=state.heroX;$('heroY').value=state.heroY;$('heroXOut').value=`${state.heroX}%`;$('heroYOut').value=`${state.heroY}%`;$('heroFileName').textContent=state.hero?.file?.name||'Selecciona una fotografía horizontal';
    updateBrandEditor();$('musicFileName').textContent=state.music?.file?.name||'Selecciona MP3, M4A, AAC u OGG';$('musicLoop').checked=state.musicLoop!==false;$('musicPlayerVisible').checked=state.musicPlayerVisible!==false;$('musicTitle').value=state.musicTitle||'';$('musicArtist').value=state.musicArtist||'';$('downloadEnabled').checked=!!state.downloadEnabled;$('downloadUrl').value=state.downloadUrl||'';$('videosEnabled').checked=state.videosEnabled;$('videosEyebrow').value=state.videosEyebrow;$('videosTitle').value=state.videosTitle;$('video1').value=state.video1;$('video1Label').value=state.video1Label;$('video2').value=state.video2;$('video2Label').value=state.video2Label;document.querySelector(`input[name="imageProfile"][value="${state.imageProfile}"]`).checked=true;
  }
  async function loadConfigFromUrl(){
    $('configStatus').textContent='Cargando…';
    try{const url=normalizeConfigUrl($('configUrl').value),res=await fetch(url);if(!res.ok)throw new Error(`No se pudo abrir config.json (${res.status})`);const cfg=await res.json();await applyConfig(cfg,url);$('configStatus').textContent='Galería recuperada.';}catch(e){console.error(e);$('configStatus').textContent=`Error: ${e.message}`;}
  }
  async function loadLocalConfig(file){
    if(!file)return;try{const cfg=JSON.parse(await file.text());await applyConfig(cfg,null);$('configStatus').textContent='Configuración cargada. Los medios requieren una URL pública para recuperarse automáticamente.';}catch(e){$('configStatus').textContent=`Error: ${e.message}`;}
  }

  function init() {
    buildSectionEditor(); buildTargetOptions(); bindBaseForm(); updateBrandEditor(); setupDropzone(); renderPhotoList(); refreshSharePreview(); updatePreview();
    const panels = [...document.querySelectorAll('details.panel')];
    panels.forEach(panel => panel.addEventListener('toggle', () => {
      if (!panel.open) return;
      panels.forEach(other => { if (other !== panel) other.open = false; });
    }));
    $('openPreview').addEventListener('click',openDetachedPreview);$('refreshPreview').addEventListener('click',()=>updatePreview());$('generateZip').addEventListener('click',generateZip);$('jumpGitHub').addEventListener('click',()=>{$('secPublish').open=true;$('secPublish').scrollIntoView({behavior:'smooth',block:'start'})});
    document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>{const el=$(b.dataset.jump);if(el){el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'})}}));
    document.querySelectorAll('[data-device]').forEach(b=>b.addEventListener('click',()=>{
      if (b.dataset.device === 'mobile') { openDetachedPreview(); return; }
      document.querySelectorAll('[data-device]').forEach(x=>x.classList.toggle('active',x.dataset.device==='desktop'));
      $('previewStage').className='preview-stage desktop';
    }));
    $('photoOrderMode').addEventListener('change',()=>{if($('photoOrderMode').value==='name'){state.photos.sort((a,b)=>a.file.name.localeCompare(b.file.name,'es',{numeric:true}));renderPhotoList();schedulePreview();}});
    $('loadConfigUrl').addEventListener('click',loadConfigFromUrl);$('localConfig').addEventListener('change',e=>loadLocalConfig(e.target.files?.[0]));
    $('githubConnect').addEventListener('click',connectGitHub);$('githubPublish').addEventListener('click',publishGitHub);$('copyPublicUrl').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('githubPagesUrl').value);$('githubPublishStatus').textContent='Enlace copiado.'}catch(_){}});
    addEventListener('beforeunload',()=>{previewUrls.forEach(u=>URL.revokeObjectURL(u));try{detachedPreviewWindow?.close()}catch(_){}});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
