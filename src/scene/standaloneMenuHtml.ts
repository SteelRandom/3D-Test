import { BUILTIN_MAP_LIST, BUILTIN_MAPS } from '../engine/levelData';
import {
  CUSTOM_MAPS_STORAGE_KEY,
  SELECTED_MAP_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from '../engine/settings';

export function generateStandaloneMenuHtml(): string {
  const builtinMapsJson = JSON.stringify(BUILTIN_MAP_LIST);
  const sampleMapJson = JSON.stringify(BUILTIN_MAPS.parque_stunt, null, 2)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Moto &amp; TPS Engine 3D · Menú Principal</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100%;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background-color: #f8fafc;
      background-image:
        linear-gradient(to right, rgba(148, 163, 184, 0.14) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.14) 1px, transparent 1px),
        linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #e2e8f0 100%);
      background-size: 36px 36px, 36px 36px, 100% 100%;
    }
    .shell {
      max-width: 1120px;
      margin: 0 auto;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 24px 20px 40px;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 24px;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .eyebrow {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #64748b;
      margin: 0 0 4px;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #020617;
    }
    .btn {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      padding: 10px 16px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: background-color 140ms ease, border-color 140ms ease;
    }
    .btn:hover { background: #f1f5f9; }
    .btn-primary {
      background: #0f172a;
      border-color: #0f172a;
      color: #ffffff;
    }
    .btn-primary:hover { background: #1e293b; }
    .hero {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr;
      gap: 28px;
      align-items: center;
      padding: 20px 0;
    }
    @media (min-width: 900px) {
      .hero { grid-template-columns: 1.3fr 1fr; }
    }
    .spec-tag {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      color: #475569;
      margin-bottom: 14px;
    }
    .hero-title {
      margin: 0 0 12px;
      font-size: clamp(28px, 4.4vw, 46px);
      line-height: 1.1;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #020617;
    }
    .hero-desc {
      margin: 0 0 24px;
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      max-width: 560px;
    }
    .menu-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 420px;
    }
    .menu-action {
      min-height: 52px;
      width: 100%;
      justify-content: space-between;
      padding: 14px 18px;
      font-size: 14px;
    }
    .menu-action-meta {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      opacity: 0.72;
    }
    .card {
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      padding: 22px;
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 12px;
      margin-bottom: 14px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
      font-size: 14px;
    }
    .stat-label { color: #64748b; }
    .stat-val { font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; }
    .note-box {
      margin-top: 14px;
      padding: 12px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      font-size: 12px;
      line-height: 1.5;
      color: #475569;
    }
    .maps-toolbar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
    }
    .maps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .map-card {
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      overflow: hidden;
      cursor: pointer;
      text-align: left;
      padding: 0;
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }
    .map-card:hover {
      border-color: #94a3b8;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07);
    }
    .map-accent { height: 9px; width: 100%; }
    .map-body {
      padding: 18px;
      display: flex;
      flex-direction: column;
      flex: 1;
      justify-content: space-between;
      gap: 14px;
    }
    .map-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #64748b;
    }
    .diff-badge {
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #334155;
      font-family: inherit;
      font-weight: 700;
    }
    .map-title {
      margin: 8px 0 6px;
      font-size: 18px;
      font-weight: 800;
      color: #020617;
    }
    .map-desc {
      margin: 0;
      font-size: 12px;
      line-height: 1.55;
      color: #475569;
    }
    .map-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
      font-size: 12px;
      color: #64748b;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.58);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 40;
    }
    .modal-backdrop.open { display: flex; }
    .modal-box {
      width: 100%;
      max-width: 460px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.25);
    }
    .modal-box.wide { max-width: 680px; }
    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      font-weight: 700;
      font-size: 15px;
    }
    .modal-body { padding: 18px; display: flex; flex-direction: column; gap: 16px; }
    .modal-foot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 18px;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
    }
    .seg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .seg-btn {
      min-height: 40px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      font-weight: 600;
      font-size: 12px;
      color: #334155;
      cursor: pointer;
    }
    .seg-btn.active {
      background: #0f172a;
      border-color: #0f172a;
      color: #ffffff;
    }
    .field-label {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      margin-bottom: 6px;
    }
    input[type="range"] { width: 100%; accent-color: #0f172a; cursor: pointer; }
    textarea {
      width: 100%;
      min-height: 240px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #0f172a;
    }
    .err-box {
      display: none;
      padding: 10px 12px;
      border-radius: 10px;
      background: #fff1f2;
      border: 1px solid #fecdd3;
      color: #be123c;
      font-size: 12px;
    }
    .err-box.visible { display: block; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="topbar-left">
        <button id="btn-back" class="btn hidden" type="button">← Volver</button>
        <div>
          <p class="eyebrow">MOTO &amp; TPS SANDBOX ENGINE</p>
          <h1 id="page-title">Menú Principal</h1>
        </div>
      </div>
      <button id="btn-top-settings" class="btn" type="button">Configuración</button>
    </header>

    <section id="view-menu" class="hero">
      <div>
        <span class="spec-tag">Three.js · Cannon-es 2-Wheel Suspension · Honda CB 750</span>
        <h2 class="hero-title">Estudio de Conducción y Escenarios JSON</h2>
        <p class="hero-desc">
          Arquitectura modular lista para ejecutar en carpeta local o servidor. Elige un mapa, ajusta tus controles y salta directo al motor 3D (<code style="font-family:monospace;">engine.html</code>).
        </p>
        <div class="menu-stack">
          <button id="btn-play" class="btn btn-primary menu-action" type="button">
            <span>▶ JUGAR</span>
            <span class="menu-action-meta" id="menu-map-count">3 mapas</span>
          </button>
          <button id="btn-settings" class="btn menu-action" type="button">
            <span>⚙ CONFIGURACIÓN</span>
            <span class="menu-action-meta" id="menu-settings-summary">Medio · Auto</span>
          </button>
          <button id="btn-json" class="btn menu-action" type="button">
            <span>{ } EDITOR / CARGAR JSON</span>
            <span class="menu-action-meta">Importar o pegar</span>
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span>Estado del Perfil</span>
          <span>localStorage</span>
        </div>
        <div class="stat-row"><span class="stat-label">Calidad gráfica</span><span class="stat-val" id="stat-quality">Medio</span></div>
        <div class="stat-row"><span class="stat-label">Controles</span><span class="stat-val" id="stat-controls">Auto</span></div>
        <div class="stat-row"><span class="stat-label">Sensibilidad cámara</span><span class="stat-val" id="stat-sens">1.00x</span></div>
        <div class="stat-row"><span class="stat-label">Volumen motor</span><span class="stat-val" id="stat-vol">80%</span></div>
        <div class="note-box">
          Compatible con ejecución directa mediante doble clic (<code style="font-family:monospace;">file://</code>) siempre que <code style="font-family:monospace;">index.html</code> y <code style="font-family:monospace;">engine.html</code> estén en la misma carpeta.
        </div>
      </div>
    </section>

    <section id="view-maps" class="hidden">
      <div class="maps-toolbar">
        <span style="font-size:13px;color:#475569;">Pulsa cualquier tarjeta para iniciar directamente en <code style="font-family:monospace;">engine.html</code>.</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input id="file-map-input" type="file" accept=".json,application/json" class="hidden" />
          <button id="btn-upload-map" class="btn" type="button">Subir mapa (.json)</button>
          <button id="btn-open-editor-2" class="btn btn-primary" type="button">Pegar JSON</button>
        </div>
      </div>
      <div id="maps-error" class="err-box" style="margin-bottom:14px;"></div>
      <div id="maps-grid" class="maps-grid"></div>
    </section>
  </main>

  <div id="modal-settings" class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal-box">
      <div class="modal-head">
        <span>Configuración del Motor</span>
        <button id="btn-close-settings" class="btn" style="min-height:34px;padding:4px 10px;" type="button">✕</button>
      </div>
      <div class="modal-body">
        <div>
          <div class="field-label"><span>Calidad gráfica</span></div>
          <div class="seg-grid" id="seg-quality">
            <button class="seg-btn" data-val="low" type="button">Bajo</button>
            <button class="seg-btn" data-val="medium" type="button">Medio</button>
            <button class="seg-btn" data-val="high" type="button">Alto</button>
          </div>
        </div>
        <div>
          <div class="field-label"><span>Controles</span></div>
          <div class="seg-grid" id="seg-controls">
            <button class="seg-btn" data-val="auto" type="button">Auto</button>
            <button class="seg-btn" data-val="touch" type="button">Táctil Móvil</button>
            <button class="seg-btn" data-val="pc" type="button">Teclado PC</button>
          </div>
        </div>
        <div>
          <div class="field-label"><span>Sensibilidad cámara</span><span id="lbl-sens">1.00x</span></div>
          <input id="rng-sens" type="range" min="0.4" max="2.0" step="0.05" value="1.0" />
        </div>
        <div>
          <div class="field-label"><span>Volumen motor y audio</span><span id="lbl-vol">80%</span></div>
          <input id="rng-vol" type="range" min="0" max="1" step="0.05" value="0.8" />
        </div>
      </div>
      <div class="modal-foot">
        <button id="btn-save-settings" class="btn btn-primary" type="button">Guardar y Cerrar</button>
      </div>
    </div>
  </div>

  <div id="modal-json" class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal-box wide">
      <div class="modal-head">
        <span>Editor / Cargar Mapa JSON</span>
        <button id="btn-close-json" class="btn" style="min-height:34px;padding:4px 10px;" type="button">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:12px;color:#475569;">Pega un mapa JSON o carga un archivo local <code style="font-family:monospace;">.json</code>.</span>
          <input id="file-editor-input" type="file" accept=".json,application/json" class="hidden" />
          <button id="btn-import-editor" class="btn" style="min-height:36px;padding:6px 12px;" type="button">Importar .json</button>
        </div>
        <textarea id="json-textarea" spellcheck="false">${sampleMapJson}</textarea>
        <div id="json-error" class="err-box"></div>
      </div>
      <div class="modal-foot">
        <button id="btn-cancel-json" class="btn" type="button">Cancelar</button>
        <button id="btn-launch-json" class="btn btn-primary" type="button">▶ Cargar y Jugar</button>
      </div>
    </div>
  </div>

  <script>
    (function () {
      const SETTINGS_KEY = ${JSON.stringify(SETTINGS_STORAGE_KEY)};
      const SELECTED_MAP_KEY = ${JSON.stringify(SELECTED_MAP_STORAGE_KEY)};
      const CUSTOM_MAPS_KEY = ${JSON.stringify(CUSTOM_MAPS_STORAGE_KEY)};
      const BUILTIN_MAPS = ${builtinMapsJson};

      function loadSettings() {
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const defaults = { quality: coarse ? 'low' : 'medium', controls: 'auto', cameraSensitivity: 1.0, audioVolume: 0.8 };
        try {
          const raw = window.localStorage.getItem(SETTINGS_KEY);
          if (!raw) return defaults;
          const p = JSON.parse(raw);
          return {
            quality: ['low', 'medium', 'high'].includes(p.quality) ? p.quality : defaults.quality,
            controls: ['auto', 'touch', 'pc'].includes(p.controls) ? p.controls : defaults.controls,
            cameraSensitivity: typeof p.cameraSensitivity === 'number' ? Math.max(0.3, Math.min(2.5, p.cameraSensitivity)) : 1.0,
            audioVolume: typeof p.audioVolume === 'number' ? Math.max(0, Math.min(1, p.audioVolume)) : 0.8
          };
        } catch (e) {
          return defaults;
        }
      }

      function saveSettings(s) {
        try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
      }

      function loadCustomMaps() {
        try {
          const raw = window.localStorage.getItem(CUSTOM_MAPS_KEY);
          const arr = raw ? JSON.parse(raw) : [];
          return Array.isArray(arr) ? arr : [];
        } catch (e) {
          return [];
        }
      }

      function saveCustomMaps(list) {
        try { window.localStorage.setItem(CUSTOM_MAPS_KEY, JSON.stringify(list)); } catch (e) {}
      }

      function normalizeBasicMap(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('El JSON debe ser un objeto válido.');
        const title = (typeof raw.nombre === 'string' && raw.nombre.trim()) || (typeof raw.name === 'string' && raw.name.trim()) || 'Mapa Personalizado';
        const id = (typeof raw.id === 'string' && raw.id.trim()) || title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || ('custom_' + Date.now());
        return Object.assign({}, raw, {
          id: id,
          nombre: title,
          name: title,
          descripcion: raw.descripcion || 'Mapa personalizado cargado desde archivo JSON.',
          dificultad: raw.dificultad || 'Personalizada',
          thumbnailColor: raw.thumbnailColor || '#0f172a',
          colliders: Array.isArray(raw.colliders) ? raw.colliders : [],
          doors: Array.isArray(raw.doors) ? raw.doors : [],
          triggers: Array.isArray(raw.triggers) ? raw.triggers : []
        });
      }

      let settings = loadSettings();
      let customMaps = loadCustomMaps();

      function qText(q) { return q === 'low' ? 'Bajo' : q === 'high' ? 'Alto' : 'Medio'; }
      function cText(c) { return c === 'touch' ? 'Táctil Móvil' : c === 'pc' ? 'Teclado PC' : 'Auto'; }

      function refreshSettingsUi() {
        document.getElementById('stat-quality').textContent = qText(settings.quality);
        document.getElementById('stat-controls').textContent = cText(settings.controls);
        document.getElementById('stat-sens').textContent = settings.cameraSensitivity.toFixed(2) + 'x';
        document.getElementById('stat-vol').textContent = Math.round(settings.audioVolume * 100) + '%';
        document.getElementById('menu-settings-summary').textContent = qText(settings.quality) + ' · ' + cText(settings.controls);
        document.getElementById('menu-map-count').textContent = (BUILTIN_MAPS.length + customMaps.length) + ' mapas';

        document.querySelectorAll('#seg-quality .seg-btn').forEach(function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-val') === settings.quality);
        });
        document.querySelectorAll('#seg-controls .seg-btn').forEach(function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-val') === settings.controls);
        });
        document.getElementById('rng-sens').value = String(settings.cameraSensitivity);
        document.getElementById('lbl-sens').textContent = settings.cameraSensitivity.toFixed(2) + 'x';
        document.getElementById('rng-vol').value = String(settings.audioVolume);
        document.getElementById('lbl-vol').textContent = Math.round(settings.audioVolume * 100) + '%';
      }

      function launchToEngine(mapObj) {
        const normalized = normalizeBasicMap(mapObj);
        saveSettings(settings);
        try { window.localStorage.setItem(SELECTED_MAP_KEY, JSON.stringify(normalized)); } catch (e) {}
        try { window.sessionStorage.setItem(SELECTED_MAP_KEY, JSON.stringify(normalized)); } catch (e) {}
        try {
          window.name = '__ENGINE3D_HANDOFF__' + JSON.stringify({
            mapId: normalized.id,
            mapData: normalized,
            settings: settings
          });
        } catch (e) {}
        window.location.href = 'engine.html?map=' + encodeURIComponent(normalized.id);
      }

      function renderMapsGrid() {
        const grid = document.getElementById('maps-grid');
        grid.innerHTML = '';
        const all = BUILTIN_MAPS.concat(customMaps);
        all.forEach(function (map) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'map-card';
          const isBuiltin = BUILTIN_MAPS.some(function (b) { return b.id === map.id; });
          btn.innerHTML =
            '<div class="map-accent" style="background:' + (map.thumbnailColor || '#334155') + ';"></div>' +
            '<div class="map-body">' +
              '<div>' +
                '<div class="map-meta"><span>' + (isBuiltin ? map.id + '.json' : 'Personalizado') + '</span><span class="diff-badge">' + (map.dificultad || 'Media') + '</span></div>' +
                '<h3 class="map-title"></h3>' +
                '<p class="map-desc"></p>' +
              '</div>' +
              '<div class="map-footer">' +
                '<span>' + (map.colliders ? map.colliders.length : 0) + ' estructuras · ' + (map.doors ? map.doors.length : 0) + ' puertas · ' + (map.triggers ? map.triggers.length : 0) + ' triggers</span>' +
                '<strong style="color:#0f172a;">Iniciar ▶</strong>' +
              '</div>' +
            '</div>';
          btn.querySelector('.map-title').textContent = map.nombre || map.name;
          btn.querySelector('.map-desc').textContent = map.descripcion || '';
          btn.addEventListener('click', function () { launchToEngine(map); });
          grid.appendChild(btn);
        });
        refreshSettingsUi();
      }

      function showScreen(name) {
        const isMaps = name === 'maps';
        document.getElementById('view-menu').classList.toggle('hidden', isMaps);
        document.getElementById('view-maps').classList.toggle('hidden', !isMaps);
        document.getElementById('btn-back').classList.toggle('hidden', !isMaps);
        document.getElementById('page-title').textContent = isMaps ? 'Selección de Mapa' : 'Menú Principal';
      }

      document.getElementById('btn-play').addEventListener('click', function () { showScreen('maps'); });
      document.getElementById('btn-back').addEventListener('click', function () { showScreen('menu'); });

      function openSettings() { document.getElementById('modal-settings').classList.add('open'); }
      function closeSettings() { saveSettings(settings); document.getElementById('modal-settings').classList.remove('open'); }
      document.getElementById('btn-settings').addEventListener('click', openSettings);
      document.getElementById('btn-top-settings').addEventListener('click', openSettings);
      document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
      document.getElementById('btn-save-settings').addEventListener('click', closeSettings);
      document.getElementById('modal-settings').addEventListener('click', function (e) {
        if (e.target === this) closeSettings();
      });

      document.querySelectorAll('#seg-quality .seg-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          settings.quality = btn.getAttribute('data-val');
          saveSettings(settings);
          refreshSettingsUi();
        });
      });
      document.querySelectorAll('#seg-controls .seg-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          settings.controls = btn.getAttribute('data-val');
          saveSettings(settings);
          refreshSettingsUi();
        });
      });
      document.getElementById('rng-sens').addEventListener('input', function () {
        settings.cameraSensitivity = Number(this.value);
        saveSettings(settings);
        refreshSettingsUi();
      });
      document.getElementById('rng-vol').addEventListener('input', function () {
        settings.audioVolume = Number(this.value);
        saveSettings(settings);
        refreshSettingsUi();
      });

      function openJsonModal() { document.getElementById('modal-json').classList.add('open'); }
      function closeJsonModal() { document.getElementById('modal-json').classList.remove('open'); }
      document.getElementById('btn-json').addEventListener('click', openJsonModal);
      document.getElementById('btn-open-editor-2').addEventListener('click', openJsonModal);
      document.getElementById('btn-close-json').addEventListener('click', closeJsonModal);
      document.getElementById('btn-cancel-json').addEventListener('click', closeJsonModal);
      document.getElementById('modal-json').addEventListener('click', function (e) {
        if (e.target === this) closeJsonModal();
      });

      document.getElementById('btn-import-editor').addEventListener('click', function () {
        document.getElementById('file-editor-input').click();
      });
      document.getElementById('file-editor-input').addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          document.getElementById('json-textarea').value = String(reader.result || '');
          document.getElementById('json-error').classList.remove('visible');
        };
        reader.readAsText(file);
      });

      document.getElementById('btn-launch-json').addEventListener('click', function () {
        const errBox = document.getElementById('json-error');
        try {
          const parsed = JSON.parse(document.getElementById('json-textarea').value);
          const norm = normalizeBasicMap(parsed);
          customMaps = customMaps.filter(function (m) { return m.id !== norm.id; });
          if (!BUILTIN_MAPS.some(function (b) { return b.id === norm.id; })) {
            customMaps.unshift(norm);
            saveCustomMaps(customMaps);
          }
          errBox.classList.remove('visible');
          launchToEngine(norm);
        } catch (err) {
          errBox.textContent = (err && err.message) || 'Error en el formato JSON.';
          errBox.classList.add('visible');
        }
      });

      document.getElementById('btn-upload-map').addEventListener('click', function () {
        document.getElementById('file-map-input').click();
      });
      document.getElementById('file-map-input').addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        const errBox = document.getElementById('maps-error');
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const parsed = JSON.parse(String(reader.result || ''));
            const norm = normalizeBasicMap(parsed);
            customMaps = customMaps.filter(function (m) { return m.id !== norm.id; });
            customMaps.unshift(norm);
            saveCustomMaps(customMaps);
            errBox.classList.remove('visible');
            renderMapsGrid();
          } catch (err) {
            errBox.textContent = (err && err.message) || 'Archivo JSON inválido.';
            errBox.classList.add('visible');
          }
        };
        reader.readAsText(file);
      });

      renderMapsGrid();
      refreshSettingsUi();
    })();
  </script>
</body>
</html>`;
}
