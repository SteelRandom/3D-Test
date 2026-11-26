import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Code2,
  Compass,
  FileJson,
  FolderUp,
  Gamepad2,
  Home,
  Layers,
  Map as MapIcon,
  Play,
  RotateCcw,
  Sliders,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import {
  BUILTIN_MAPS,
  MapJSON,
  normalizeMapJSON,
  NormalizedMapJSON,
} from '../engine/levelData';
import { ControlMode, EngineSettings, QualityPreset } from '../engine/settings';

interface MainMenuProps {
  screen: 'menu' | 'maps';
  maps: NormalizedMapJSON[];
  settings: EngineSettings;
  onNavigate: (next: 'menu' | 'maps') => void;
  onLaunchMap: (map: MapJSON | NormalizedMapJSON) => void;
  onImportCustomMap: (rawJson: unknown) => {
    ok: boolean;
    map?: NormalizedMapJSON;
    error?: string;
  };
  onRemoveCustomMap: (id: string) => void;
  onUpdateSettings: (next: EngineSettings) => void;
  onOpenSettings: () => void;
  onOpenJsonEditor: () => void;
}

const SAMPLE_JSON_TEMPLATE = JSON.stringify(BUILTIN_MAPS.parque_stunt, null, 2);

function qualityLabel(q: QualityPreset): string {
  return q === 'low' ? 'Bajo' : q === 'high' ? 'Alto' : 'Medio';
}

function controlsLabel(c: ControlMode): string {
  return c === 'touch' ? 'Táctil Móvil' : c === 'pc' ? 'Teclado PC' : 'Auto';
}

export function MainMenu({
  screen,
  maps,
  settings,
  onNavigate,
  onLaunchMap,
  onImportCustomMap,
  onRemoveCustomMap,
  onOpenSettings,
  onOpenJsonEditor,
}: MainMenuProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = onImportCustomMap(parsed);
      if (!res.ok) {
        setImportError(res.error ?? 'Archivo JSON no válido');
      } else {
        setImportError(null);
      }
    } catch {
      setImportError('No se pudo leer o parsear el archivo .json.');
    }
  };

  return (
    <div
      className="relative flex min-h-screen w-screen flex-col overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-200 text-slate-900 select-none"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(148, 163, 184, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.14) 1px, transparent 1px), linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #e2e8f0 100%)',
        backgroundSize: '36px 36px, 36px 36px, 100% 100%',
      }}
    >
      {/* Cabecera superior de estudio */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 pb-4 sm:px-8">
        <div className="flex items-center gap-3">
          {screen === 'maps' && (
            <button
              type="button"
              onClick={() => onNavigate('menu')}
              className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          )}
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
              MOTO &amp; TPS SANDBOX ENGINE
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
              {screen === 'menu' ? 'Menú Principal' : 'Selección de Mapa'}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Abrir configuración"
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-100"
        >
          <Sliders className="h-4 w-4 text-slate-600" />
          <span className="hidden sm:inline">Configuración</span>
        </button>
      </header>

      {screen === 'menu' ? (
        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-8 sm:px-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs font-medium text-slate-600 shadow-xs">
                <span>Three.js · Cannon-es 2-Wheel Suspension · Honda CB 750</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                Estudio de Conducción y Escenarios JSON
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Explora pistas urbanas, rampas stunt o terreno irregular con físicas reales de doble suspensión, cámara TPS/FPS y compatibilidad completa para PC y dispositivos táctiles.
              </p>

              <div className="grid grid-cols-1 gap-3 pt-2 sm:max-w-md">
                <button
                  type="button"
                  onClick={() => onNavigate('maps')}
                  className="flex min-h-[52px] cursor-pointer items-center justify-between rounded-xl bg-slate-900 px-5 py-3.5 text-left text-base font-semibold text-white shadow-md transition-all hover:bg-slate-800 active:scale-[0.99]"
                >
                  <span className="flex items-center gap-3">
                    <Play className="h-5 w-5 fill-current" />
                    JUGAR
                  </span>
                  <span className="font-mono text-xs font-medium text-slate-300">
                    {maps.length} mapas
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex min-h-[48px] cursor-pointer items-center justify-between rounded-xl border border-slate-300 bg-white px-5 py-3 text-left text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3">
                    <Sliders className="h-4 w-4 text-slate-600" />
                    CONFIGURACIÓN
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {qualityLabel(settings.quality)} · {controlsLabel(settings.controls)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onOpenJsonEditor}
                  className="flex min-h-[48px] cursor-pointer items-center justify-between rounded-xl border border-slate-300 bg-white px-5 py-3 text-left text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3">
                    <Code2 className="h-4 w-4 text-slate-600" />
                    EDITOR / CARGAR JSON
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    Importar o pegar
                  </span>
                </button>
              </div>
            </div>

            {/* Panel resumen técnico de estudio */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Estado del Perfil
                </span>
                <span className="font-mono text-xs font-medium text-slate-700">
                  localStorage activo
                </span>
              </div>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-slate-500">
                    <Layers className="h-4 w-4" /> Calidad gráfica
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {qualityLabel(settings.quality)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-slate-500">
                    <Gamepad2 className="h-4 w-4" /> Controles
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {controlsLabel(settings.controls)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-slate-500">
                    <Compass className="h-4 w-4" /> Sensibilidad cámara
                  </dt>
                  <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                    {settings.cameraSensitivity.toFixed(2)}x
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-slate-500">
                    <Volume2 className="h-4 w-4" /> Volumen motor
                  </dt>
                  <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                    {Math.round(settings.audioVolume * 100)}%
                  </dd>
                </div>
              </dl>

              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600">
                Modo de inicio ligero sin renderizado 3D en el menú. Al elegir un mapa se iniciará el motor WebGL y las físicas inmediatamente.
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pt-2 pb-10 sm:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Pulsa cualquier tarjeta para iniciar directamente en el escenario seleccionado.
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-100"
              >
                <FolderUp className="h-4 w-4 text-slate-700" />
                Subir mapa (.json)
              </button>
              <button
                type="button"
                onClick={onOpenJsonEditor}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
              >
                <Code2 className="h-4 w-4" />
                Pegar JSON
              </button>
            </div>
          </div>

          {importError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
              {importError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {maps.map((map) => {
              const isBuiltin = Boolean(BUILTIN_MAPS[map.id]);
              return (
                <article
                  key={map.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-400 hover:shadow-md"
                >
                  <div
                    className="h-2.5 w-full"
                    style={{ backgroundColor: map.thumbnailColor || '#334155' }}
                  />
                  <button
                    type="button"
                    onClick={() => onLaunchMap(map)}
                    className="flex flex-1 cursor-pointer flex-col justify-between p-5 text-left"
                  >
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-500 uppercase">
                          <MapIcon className="h-3.5 w-3.5" />
                          {isBuiltin ? `${map.id}.json` : 'Personalizado'}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {map.dificultad}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold tracking-tight text-slate-950 group-hover:text-slate-700">
                        {map.nombre}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                        {map.descripcion}
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="font-mono text-slate-500">
                        {map.colliders.length} estructuras · {map.doors.length} puertas ·{' '}
                        {map.triggers.length} triggers
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                        Iniciar
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </span>
                    </div>
                  </button>

                  {!isBuiltin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCustomMap(map.id);
                      }}
                      aria-label={`Eliminar mapa ${map.nombre}`}
                      className="absolute top-5 right-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rose-300 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

interface SettingsModalProps {
  open: boolean;
  settings: EngineSettings;
  onChange: (next: EngineSettings) => void;
  onClose: () => void;
}

export function SettingsModal({
  open,
  settings,
  onChange,
  onClose,
}: SettingsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-slate-700" />
            <h2 id="settings-modal-title" className="text-base font-bold text-slate-950">
              Configuración del Motor
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5 text-sm">
          <div>
            <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Calidad gráfica (Resolución, Sombras y Niebla)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange({ ...settings, quality: preset })}
                  aria-pressed={settings.quality === preset}
                  className={`min-h-[42px] cursor-pointer rounded-xl border text-xs font-semibold transition-colors ${
                    settings.quality === preset
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {qualityLabel(preset)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Modo de Controles
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['auto', 'touch', 'pc'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange({ ...settings, controls: mode })}
                  aria-pressed={settings.controls === mode}
                  className={`min-h-[42px] cursor-pointer rounded-xl border text-xs font-semibold transition-colors ${
                    settings.controls === mode
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {controlsLabel(mode)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="cam-sens-slider"
                className="text-xs font-semibold tracking-wider text-slate-500 uppercase"
              >
                Sensibilidad de Cámara
              </label>
              <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                {settings.cameraSensitivity.toFixed(2)}x
              </span>
            </div>
            <input
              id="cam-sens-slider"
              type="range"
              min={0.4}
              max={2.0}
              step={0.05}
              value={settings.cameraSensitivity}
              onChange={(e) =>
                onChange({
                  ...settings,
                  cameraSensitivity: Number(e.target.value),
                })
              }
              className="h-2 w-full cursor-pointer accent-slate-900"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="audio-vol-slider"
                className="text-xs font-semibold tracking-wider text-slate-500 uppercase"
              >
                Volumen de Audio y Motor
              </label>
              <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                {Math.round(settings.audioVolume * 100)}%
              </span>
            </div>
            <input
              id="audio-vol-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.audioVolume}
              onChange={(e) =>
                onChange({
                  ...settings,
                  audioVolume: Number(e.target.value),
                })
              }
              className="h-2 w-full cursor-pointer accent-slate-900"
            />
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Check className="h-4 w-4" />
            Guardar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

interface JsonEditorModalProps {
  open: boolean;
  onClose: () => void;
  onLaunchJson: (map: NormalizedMapJSON) => void;
}

export function JsonEditorModal({
  open,
  onClose,
  onLaunchJson,
}: JsonEditorModalProps) {
  const [jsonText, setJsonText] = useState(SAMPLE_JSON_TEMPLATE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const content = await file.text();
      setJsonText(content);
      setErrorMsg(null);
    } catch {
      setErrorMsg('No se pudo leer el archivo seleccionado.');
    }
  };

  const handleValidateAndLaunch = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const normalized = normalizeMapJSON(parsed);
      setErrorMsg(null);
      onLaunchJson(normalized);
    } catch (err) {
      setErrorMsg((err as Error).message || 'JSON inválido.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="json-editor-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-slate-700" />
            <h2 id="json-editor-title" className="text-base font-bold text-slate-950">
              Editor / Cargar Mapa JSON
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar editor JSON"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Pega la estructura JSON de un mapa o importa un archivo <code className="font-mono">.json</code> local.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar .json
            </button>
          </div>

          <textarea
            rows={13}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            className="w-full flex-1 rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 select-text focus:border-slate-900 focus:bg-white focus:outline-none"
          />

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] cursor-pointer rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleValidateAndLaunch}
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Cargar y Jugar
          </button>
        </div>
      </div>
    </div>
  );
}

interface PauseMenuModalProps {
  open: boolean;
  activeMapName: string;
  onResume: () => void;
  onReset: () => void;
  onOpenSettings: () => void;
  onChangeMap: () => void;
  onBackToMenu: () => void;
}

export function PauseMenuModal({
  open,
  activeMapName,
  onResume,
  onReset,
  onOpenSettings,
  onChangeMap,
  onBackToMenu,
}: PauseMenuModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/65 p-4"
      onClick={onResume}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="font-mono text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
            Menú en Partida
          </p>
          <h2 id="pause-modal-title" className="text-lg font-bold text-slate-950">
            {activeMapName}
          </h2>
        </div>

        <div className="space-y-2 p-4">
          <button
            type="button"
            onClick={onResume}
            className="flex min-h-[46px] w-full cursor-pointer items-center gap-2.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Play className="h-4 w-4 fill-current" />
            Reanudar
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            <RotateCcw className="h-4 w-4 text-slate-600" />
            Reiniciar posición
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            <Sliders className="h-4 w-4 text-slate-600" />
            Configuración
          </button>
          <button
            type="button"
            onClick={onChangeMap}
            className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            <MapIcon className="h-4 w-4 text-slate-600" />
            Cambiar de Mapa
          </button>
          <button
            type="button"
            onClick={onBackToMenu}
            className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Home className="h-4 w-4 text-slate-500" />
            Volver al Menú Principal
          </button>
        </div>
      </div>
    </div>
  );
}
