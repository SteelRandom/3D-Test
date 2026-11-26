import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Bug,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  Copy,
  Database,
  Download,
  Eye,
  FileJson,
  FolderOpen,
  Gauge,
  Hand,
  Layers,
  Map as MapIcon,
  Menu,
  Pause,
  Play,
  RotateCcw,
  Save,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  CameraMode,
  CharacterAnimState,
  InteractTargetType,
  QualityPreset,
  ThirdPersonViewport,
  ThirdPersonViewportHandle,
  ViewportStateSnapshot,
} from './components/ThirdPersonViewport';
import { MobileControls } from './components/MobileControls';
import { CodeModal } from './components/CodeModal';
import {
  JsonEditorModal,
  MainMenu,
  PauseMenuModal,
  SettingsModal,
} from './components/MainMenu';
import { generateStandaloneHtml } from './scene/standaloneHtml';
import { generateStandaloneMenuHtml } from './scene/standaloneMenuHtml';
import { CAMERA_VIEWS } from './scene/courseConfig';
import { HondaOptStats } from './engine/hondaOptimizer';
import {
  BUILTIN_MAP_LIST,
  BUILTIN_MAPS,
  MAP_FILENAMES,
  MapJSON,
  normalizeMapJSON,
  NormalizedMapJSON,
} from './engine/levelData';
import {
  CUSTOM_MAPS_STORAGE_KEY,
  EngineSettings,
  loadEngineSettings,
  saveEngineSettings,
  SELECTED_MAP_STORAGE_KEY,
} from './engine/settings';

function loadSavedCustomMaps(): NormalizedMapJSON[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_MAPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: NormalizedMapJSON[] = [];
    for (const item of parsed) {
      try {
        result.push(normalizeMapJSON(item));
      } catch {
        // Ignora entradas corruptas
      }
    }
    return result;
  } catch {
    return [];
  }
}

function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const viewportRef = useRef<ThirdPersonViewportHandle | null>(null);

  const [view, setView] = useState<'menu' | 'maps' | 'playing'>('menu');
  const [settings, setSettings] = useState<EngineSettings>(() => loadEngineSettings());
  const [customMaps, setCustomMaps] = useState<NormalizedMapJSON[]>(() =>
    loadSavedCustomMaps()
  );
  const [activeMap, setActiveMap] = useState<NormalizedMapJSON>(() =>
    normalizeMapJSON(BUILTIN_MAPS.barrio_urbana)
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);

  const [loadPct, setLoadPct] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadNotice, setLoadNotice] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const [animState, setAnimState] = useState<CharacterAnimState>('Idle');
  const [grounded, setGrounded] = useState(true);
  const [viewLabel, setViewLabel] = useState(CAMERA_VIEWS[0].label);
  const [cameraMode, setCameraMode] = useState<CameraMode>('TPS');
  const [timeScale, setTimeScale] = useState(1.0);
  const [health, setHealth] = useState(100);
  const [isWaving, setIsWaving] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [vehicleSpeedKmh, setVehicleSpeedKmh] = useState(0);
  const [interactPrompt, setInteractPrompt] = useState<string | null>(null);
  const [interactType, setInteractType] = useState<InteractTargetType>(null);
  const [doorOpen, setDoorOpen] = useState(false);
  const [hondaParts, setHondaParts] = useState<string[]>([]);
  const [freeCam, setFreeCam] = useState(false);
  const [fps, setFps] = useState(60);
  const [drawCalls, setDrawCalls] = useState(0);
  const [triangles, setTriangles] = useState(0);
  const [hondaOptStats, setHondaOptStats] = useState<HondaOptStats | null>(null);
  const [modelCacheStatus, setModelCacheStatus] = useState('Cargando...');
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>(
    () => loadEngineSettings().quality
  );
  const [activeMapName, setActiveMapName] = useState(
    BUILTIN_MAPS.barrio_urbana.nombre ?? 'Barrio Urbano'
  );
  const [playerXYZ, setPlayerXYZ] = useState<[number, number, number]>([0, 0.9, 0]);
  const [camXYZ, setCamXYZ] = useState<[number, number, number]>([0, 2.9, 4.2]);
  const [copiedPos, setCopiedPos] = useState(false);
  const [customMapOpen, setCustomMapOpen] = useState(false);
  const [customMapJsonText, setCustomMapJsonText] = useState(() =>
    JSON.stringify(BUILTIN_MAPS.parque_stunt, null, 2)
  );
  const [mapError, setMapError] = useState<string | null>(null);
  const [lastTrigger, setLastTrigger] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [testModelStatus, setTestModelStatus] = useState<string | null>(null);
  const [testModelUrlInput, setTestModelUrlInput] = useState(
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoxAnimated/glTF-Binary/BoxAnimated.glb'
  );

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);

  const allMaps = useMemo(
    () => [...BUILTIN_MAP_LIST, ...customMaps],
    [customMaps]
  );

  useEffect(() => {
    const checkTouch = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const touchCapable =
        'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(coarse || touchCapable);
    };
    checkTouch();

    const mql = window.matchMedia('(pointer: coarse)');
    mql.addEventListener('change', checkTouch);
    return () => mql.removeEventListener('change', checkTouch);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (view !== 'playing') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'h' && !codeModalOpen && !settingsOpen && !jsonEditorOpen) {
        setDebugOpen((prev) => !prev);
      } else if (
        e.key === 'Escape' &&
        !codeModalOpen &&
        !settingsOpen &&
        !jsonEditorOpen
      ) {
        setPauseMenuOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, codeModalOpen, settingsOpen, jsonEditorOpen]);

  const standaloneHtml = useMemo(() => generateStandaloneHtml(), []);
  const standaloneMenuHtml = useMemo(() => generateStandaloneMenuHtml(), []);

  const persistCustomMaps = useCallback((nextMaps: NormalizedMapJSON[]) => {
    setCustomMaps(nextMaps);
    try {
      window.localStorage.setItem(
        CUSTOM_MAPS_STORAGE_KEY,
        JSON.stringify(nextMaps)
      );
    } catch {
      // noop
    }
  }, []);

  const handleUpdateSettings = useCallback(
    (next: EngineSettings) => {
      setSettings(next);
      saveEngineSettings(next);
      setQualityPreset(next.quality);
      if (view === 'playing') {
        viewportRef.current?.setQualityPreset(next.quality);
      }
    },
    [view]
  );

  const handleImportCustomMap = useCallback(
    (
      rawJson: unknown
    ): { ok: boolean; map?: NormalizedMapJSON; error?: string } => {
      try {
        const normalized = normalizeMapJSON(rawJson);
        const builtinIds = new Set(BUILTIN_MAP_LIST.map((m) => m.id));
        const finalMap: NormalizedMapJSON = builtinIds.has(normalized.id)
          ? {
              ...normalized,
              id: `${normalized.id}_custom_${Date.now().toString(36)}`,
            }
          : normalized;
        const filtered = customMaps.filter((m) => m.id !== finalMap.id);
        persistCustomMaps([...filtered, finalMap]);
        return { ok: true, map: finalMap };
      } catch (err) {
        return {
          ok: false,
          error: (err as Error).message || 'JSON de mapa no válido.',
        };
      }
    },
    [customMaps, persistCustomMaps]
  );

  const handleRemoveCustomMap = useCallback(
    (id: string) => {
      persistCustomMaps(customMaps.filter((m) => m.id !== id));
    },
    [customMaps, persistCustomMaps]
  );

  const handleLaunchMap = useCallback(
    (map: MapJSON | NormalizedMapJSON) => {
      const normalized = normalizeMapJSON(map);
      setActiveMap(normalized);
      setActiveMapName(normalized.nombre || normalized.name);
      setMapError(null);
      try {
        window.localStorage.setItem(
          SELECTED_MAP_STORAGE_KEY,
          JSON.stringify(normalized)
        );
      } catch {
        // noop
      }
      setSettingsOpen(false);
      setJsonEditorOpen(false);
      setPauseMenuOpen(false);
      if (view === 'playing' && viewportRef.current) {
        viewportRef.current.loadMapFromJSON(normalized);
      } else {
        setLoadPct(0);
        setIsLoaded(false);
        setView('playing');
      }
    },
    [view]
  );

  const handleLoadProgress = useCallback(
    (progress: number, loaded: boolean, error: string | null) => {
      setLoadPct(progress);
      setIsLoaded(loaded);
      setLoadNotice(error);
    },
    []
  );

  const handleStateChange = useCallback((next: ViewportStateSnapshot) => {
    setAnimState(next.animState);
    setGrounded(next.grounded);
    setViewLabel(next.viewLabel);
    setCameraMode(next.cameraMode);
    setFreeCam(next.freeCam);
    setTimeScale(next.timeScale);
    setHealth(next.health);
    setIsWaving(next.isWaving);
    setIsMounted(next.isMounted);
    setVehicleSpeedKmh(next.vehicleSpeedKmh);
    setInteractPrompt(next.interactPrompt);
    setInteractType(next.interactType);
    setDoorOpen(next.doorOpen);
    setHondaParts(next.hondaParts);
    setFps(next.fps);
    setDrawCalls(next.drawCalls);
    setTriangles(next.triangles);
    setHondaOptStats(next.hondaOptStats);
    setModelCacheStatus(next.modelCacheStatus);
    setQualityPreset(next.qualityPreset);
    setActiveMapName(next.activeMapName);
    setPlayerXYZ(next.playerXYZ);
    setCamXYZ(next.camXYZ);
    setLastTrigger(next.lastTrigger);
    setSaveStatus(next.saveStatus);
    setTestModelStatus(next.testModelStatus);
  }, []);

  const handleCopyPosition = useCallback(async () => {
    const payload = viewportRef.current?.getPositionCopyPayload();
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.colliderJson);
      setCopiedPos(true);
      window.setTimeout(() => setCopiedPos(false), 1600);
    } catch {
      setCopiedPos(false);
    }
  }, []);

  const handleLoadBuiltinMap = useCallback(
    (key: 'barrio_urbana' | 'parque_stunt' | 'circuito_offroad') => {
      const target = BUILTIN_MAPS[key];
      const res = viewportRef.current?.loadMapFromJSON(target);
      if (res && !res.ok) {
        setMapError(res.error ?? 'Error al cargar mapa');
      } else {
        setMapError(null);
        setActiveMap(normalizeMapJSON(target));
      }
    },
    []
  );

  const handleLoadCustomMap = useCallback(() => {
    const res = viewportRef.current?.loadMapFromJSON(customMapJsonText);
    if (res && !res.ok) {
      setMapError(res.error ?? 'Error de sintaxis en el JSON');
    } else {
      setMapError(null);
    }
  }, [customMapJsonText]);

  const handleDownloadMenuHtml = useCallback(() => {
    triggerFileDownload(
      'index.html',
      standaloneMenuHtml,
      'text/html;charset=utf-8'
    );
  }, [standaloneMenuHtml]);

  const handleDownloadEngineHtml = useCallback(() => {
    triggerFileDownload(
      'engine.html',
      standaloneHtml,
      'text/html;charset=utf-8'
    );
  }, [standaloneHtml]);

  const handleDownloadBuiltinMapsJson = useCallback(() => {
    const entries = Object.entries(BUILTIN_MAPS);
    entries.forEach(([key, mapData], idx) => {
      const filename = MAP_FILENAMES[key] ?? `${key}.json`;
      const jsonContent = JSON.stringify(mapData, null, 2);
      window.setTimeout(() => {
        triggerFileDownload(
          filename,
          jsonContent,
          'application/json;charset=utf-8'
        );
      }, idx * 180);
    });
  }, []);

  if (view !== 'playing') {
    return (
      <>
        <MainMenu
          screen={view}
          maps={allMaps}
          settings={settings}
          onNavigate={setView}
          onLaunchMap={handleLaunchMap}
          onImportCustomMap={handleImportCustomMap}
          onRemoveCustomMap={handleRemoveCustomMap}
          onUpdateSettings={handleUpdateSettings}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenJsonEditor={() => setJsonEditorOpen(true)}
        />
        <SettingsModal
          open={settingsOpen}
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onChange={handleUpdateSettings}
        />
        <JsonEditorModal
          open={jsonEditorOpen}
          onClose={() => setJsonEditorOpen(false)}
          onLaunchJson={(normalized) => {
            handleImportCustomMap(normalized);
            handleLaunchMap(normalized);
          }}
        />
      </>
    );
  }

  const touchControlsVisible =
    settings.controls === 'touch'
      ? true
      : settings.controls === 'pc'
      ? showMobilePreview
      : isTouchDevice || showMobilePreview;
  const isPaused = timeScale === 0;
  const isSlowMo = timeScale > 0 && timeScale < 1;
  const hasRayTarget = interactType === 'door' || interactType === 'motorcycle';

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#cfd9e6] select-none">
      {/* Lienzo 3D aislado a pantalla completa */}
      <ThirdPersonViewport
        ref={viewportRef}
        initialMap={activeMap}
        initialQuality={settings.quality}
        cameraSensitivity={settings.cameraSensitivity}
        audioVolume={settings.audioVolume}
        onLoadProgress={handleLoadProgress}
        onStateChange={handleStateChange}
        onContextLostChange={setContextLost}
      />

      {/* Punto sutil de apuntado para EngineRaycaster (sin texto en el centro) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform duration-100 ${
          hasRayTarget
            ? 'h-2.5 w-2.5 border-amber-600 bg-amber-400'
            : 'h-1.5 w-1.5 border-slate-900/45 bg-white/75'
        }`}
      />

      {/* HUD principal mínimo: únicamente velocidad de la moto (km/h) arriba a la izquierda */}
      <div className="pointer-events-none fixed top-4 left-4 z-15 flex items-baseline gap-1.5 rounded-lg border border-white/15 bg-slate-950/88 px-3.5 py-2 text-white shadow-lg">
        <span className="font-mono text-2xl font-bold tracking-tight tabular-nums">
          {vehicleSpeedKmh}
        </span>
        <span className="text-xs font-medium tracking-wide text-slate-300 uppercase">
          km/h
        </span>
      </div>

      {/* Indicador Presiona E centrado arriba, sin solapar joystick ni velocímetro */}
      {(interactPrompt || isMounted) && (
        <div
          role="status"
          className="pointer-events-none fixed top-4 left-1/2 z-15 -translate-x-1/2 rounded-md border border-amber-400/40 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold tracking-wide text-amber-300 shadow-lg"
        >
          Presiona E
        </div>
      )}

      {/* Botón discreto Menú + panel colapsable derecho DEBUG */}
      <aside className="fixed top-4 right-4 z-[25] flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPauseMenuOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-100 shadow-lg transition-colors hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Menu className="h-3.5 w-3.5 text-slate-300" />
            Menú
          </button>

          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            aria-expanded={debugOpen}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold tracking-wider text-slate-100 shadow-lg transition-colors hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Bug className="h-3.5 w-3.5 text-sky-400" />
            DEBUG
            {debugOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </div>

        {debugOpen && (
          <div className="flex max-h-[calc(100vh-5rem)] w-72 flex-col gap-3 overflow-y-auto rounded-xl border border-white/15 bg-slate-950/92 p-3.5 text-xs text-slate-100 shadow-2xl">
            <div className="space-y-1.5 border-b border-white/10 pb-2.5 font-mono text-[11px] tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Animación</span>
                <span className="font-semibold text-white">
                  {animState}
                  {isWaving ? ' + Wave' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Estado suelo</span>
                <span className={grounded ? 'text-emerald-400' : 'text-amber-300'}>
                  {grounded ? 'En suelo' : 'En aire'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Salud</span>
                <span>HP {health}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Vehículo</span>
                <span className="text-sky-300">
                  {isMounted ? `Montado (${vehicleSpeedKmh} km/h)` : 'Estacionada'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Cámara</span>
                <span>
                  {cameraMode} · {viewLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tiempo</span>
                <span
                  className={
                    isPaused
                      ? 'text-amber-400'
                      : isSlowMo
                      ? 'text-sky-400'
                      : 'text-slate-200'
                  }
                >
                  {isPaused ? 'PAUSA' : `${timeScale}x`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Puerta</span>
                <span>{doorOpen ? 'Abierta' : 'Cerrada'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Rendimiento</span>
                <span className="text-emerald-400">
                  {fps} FPS · {drawCalls} draws · {triangles.toLocaleString()} tris
                </span>
              </div>
              {hondaOptStats && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Honda opt</span>
                  <span className="truncate text-sky-300">
                    {hondaOptStats.beforeMeshes}→{hondaOptStats.afterDrawCalls} draws ·{' '}
                    {hondaOptStats.beforeTriangles.toLocaleString()}→
                    {hondaOptStats.afterTriangles.toLocaleString()} tris
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Caché</span>
                <span className="truncate text-teal-300">{modelCacheStatus}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Jugador XYZ</span>
                <span className="text-slate-200">
                  {playerXYZ[0]}, {playerXYZ[1]}, {playerXYZ[2]}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Cámara XYZ</span>
                <span className="text-slate-300">
                  {camXYZ[0]}, {camXYZ[1]}, {camXYZ[2]}
                </span>
              </div>
              {lastTrigger && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Trigger</span>
                  <span className="truncate text-cyan-300">{lastTrigger}</span>
                </div>
              )}
              {saveStatus && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Guardado</span>
                  <span className="truncate text-amber-300">{saveStatus}</span>
                </div>
              )}
              {interactPrompt && (
                <div className="pt-1 text-[11px] text-amber-300">
                  {interactPrompt}
                </div>
              )}
              {loadNotice && (
                <div className="pt-1 text-[11px] text-amber-400">
                  {loadNotice}
                </div>
              )}
            </div>

            <div className="space-y-1.5 border-b border-white/10 pb-2">
              <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Calidad y Caché
                </span>
                <span className="text-[10px] font-normal normal-case text-slate-300">
                  {qualityPreset === 'low' ? 'Bajo' : qualityPreset === 'high' ? 'Alto' : 'Medio'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['low', 'medium', 'high'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      viewportRef.current?.setQualityPreset(preset);
                      handleUpdateSettings({ ...settings, quality: preset });
                    }}
                    aria-pressed={qualityPreset === preset}
                    className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      qualityPreset === preset
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {preset === 'low' ? 'Bajo' : preset === 'medium' ? 'Medio' : 'Alto'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyPosition}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-100 transition-colors hover:bg-slate-700"
                >
                  {copiedPos ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-sky-400" />
                  )}
                  {copiedPos ? '¡Copiado!' : 'Copiar Posición / Collider JSON'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void viewportRef.current?.clearModelCache();
                  }}
                  className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-rose-200 transition-colors hover:bg-slate-700"
                >
                  <Database className="h-3.5 w-3.5 text-rose-400" />
                  Limpiar Caché de Modelos
                </button>
              </div>
            </div>

            <div className="space-y-1.5 border-b border-white/10 pb-2">
              <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                <span className="inline-flex items-center gap-1">
                  <MapIcon className="h-3 w-3" />
                  Mapas JSON
                </span>
                <span className="max-w-32 truncate text-[10px] font-normal normal-case text-amber-300">
                  {activeMapName}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => handleLoadBuiltinMap('barrio_urbana')}
                  className={`cursor-pointer rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
                    activeMapName === 'Barrio Urbano'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  Urbano
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBuiltinMap('parque_stunt')}
                  className={`cursor-pointer rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
                    activeMapName === 'Stunt Arena'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  Stunt
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadBuiltinMap('circuito_offroad')}
                  className={`cursor-pointer rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
                    activeMapName === 'Terreno Irregular'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  Offroad
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCustomMapOpen((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between rounded bg-slate-900/90 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
              >
                <span>Mapa JSON personalizado</span>
                {customMapOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {customMapOpen && (
                <div className="space-y-1.5">
                  <textarea
                    rows={5}
                    value={customMapJsonText}
                    onChange={(e) => setCustomMapJsonText(e.target.value)}
                    spellCheck={false}
                    className="w-full rounded border border-white/15 bg-slate-900 p-1.5 font-mono text-[10px] text-slate-100 select-text focus:border-sky-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleLoadCustomMap}
                    className="w-full cursor-pointer rounded-md bg-sky-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-sky-500"
                  >
                    Cargar Mapa JSON
                  </button>
                  {mapError && (
                    <p className="rounded bg-rose-950/70 px-2 py-1 text-[10px] text-rose-300">
                      {mapError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {hondaParts.length > 0 && (
              <div className="border-b border-white/10 pb-2">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Honda CB 750 ({hondaParts.length} partes OBJ/MTL)
                </p>
                <div className="max-h-28 space-y-0.5 overflow-y-auto rounded bg-slate-900/80 p-1.5 font-mono text-[10px] text-slate-300">
                  {hondaParts.map((entry) => (
                    <div key={entry} className="truncate">
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => viewportRef.current?.toggleCameraMode()}
                aria-pressed={cameraMode === 'FPS'}
                className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  cameraMode === 'FPS'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                    : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                {cameraMode} (F2)
              </button>

              <button
                type="button"
                onClick={() => viewportRef.current?.togglePause()}
                aria-pressed={isPaused}
                className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  isPaused
                    ? 'bg-amber-600 text-white hover:bg-amber-500'
                    : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                }`}
              >
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {isPaused ? 'Reanudar' : 'Pausa (P)'}
              </button>

              <button
                type="button"
                onClick={() => viewportRef.current?.toggleSlowMotion()}
                aria-pressed={isSlowMo}
                className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  isSlowMo
                    ? 'bg-sky-600 text-white hover:bg-sky-500'
                    : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                }`}
              >
                <Gauge className="h-3.5 w-3.5" />
                Lenta (L)
              </button>

              <button
                type="button"
                onClick={() => viewportRef.current?.cycleCameraView()}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 font-medium text-slate-100 transition-colors hover:bg-slate-700"
              >
                <Camera className="h-3.5 w-3.5" />
                Vista (V)
              </button>

              {!isMounted && (
                <button
                  type="button"
                  onClick={() => viewportRef.current?.toggleWave()}
                  aria-pressed={isWaving}
                  className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                    isWaving
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                  }`}
                >
                  <Hand className="h-3.5 w-3.5" />
                  Saludar (F)
                </button>
              )}

              <button
                type="button"
                onClick={() => viewportRef.current?.resetPlayer()}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 font-medium text-slate-100 transition-colors hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reiniciar
              </button>

              <button
                type="button"
                onClick={() => viewportRef.current?.toggleFreeCam()}
                aria-pressed={freeCam}
                className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  freeCam
                    ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                    : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                Free-Cam (C)
              </button>

              <button
                type="button"
                onClick={() => viewportRef.current?.quickSave()}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 font-medium text-slate-100 transition-colors hover:bg-slate-700"
              >
                <Save className="h-3.5 w-3.5" />
                Guardar (G)
              </button>

              <button
                type="button"
                onClick={() => viewportRef.current?.quickLoad()}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 font-medium text-slate-100 transition-colors hover:bg-slate-700"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Cargar (K)
              </button>

              {!isTouchDevice && (
                <button
                  type="button"
                  onClick={() => setShowMobilePreview((v) => !v)}
                  aria-pressed={showMobilePreview}
                  className={`col-span-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                    showMobilePreview
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Vista móvil
                </button>
              )}

              <button
                type="button"
                onClick={() => setCodeModalOpen(true)}
                className="col-span-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 font-medium text-slate-100 transition-colors hover:bg-slate-700"
              >
                <Code2 className="h-3.5 w-3.5" />
                Ver HTML (engine.html)
              </button>
            </div>

            <div className="space-y-1.5 border-t border-white/10 pt-2">
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Exportar Proyecto Modular
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadMenuHtml}
                  className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-slate-800 px-2 py-1.5 text-[11px] font-medium text-slate-100 transition-colors hover:bg-slate-700"
                >
                  <Download className="h-3 w-3 text-sky-400" />
                  index.html
                </button>
                <button
                  type="button"
                  onClick={handleDownloadEngineHtml}
                  className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-500"
                >
                  <Download className="h-3 w-3" />
                  engine.html
                </button>
              </div>
              <button
                type="button"
                onClick={handleDownloadBuiltinMapsJson}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-slate-700"
              >
                <FileJson className="h-3.5 w-3.5" />
                Descargar 3 Mapas (.json)
              </button>
            </div>

            <div className="space-y-1.5 border-t border-white/10 pt-2">
              <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                <span>Modelos prueba (URL)</span>
                {testModelStatus && (
                  <span className="max-w-28 truncate font-normal normal-case text-sky-300">
                    {testModelStatus}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const url =
                      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoxAnimated/glTF-Binary/BoxAnimated.glb';
                    setTestModelUrlInput(url);
                    viewportRef.current?.loadTestModel(url);
                  }}
                  className="flex-1 cursor-pointer rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700"
                >
                  BoxAnimated
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const url =
                      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb';
                    setTestModelUrlInput(url);
                    viewportRef.current?.loadTestModel(url);
                  }}
                  className="flex-1 cursor-pointer rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700"
                >
                  DamagedHelmet
                </button>
              </div>
              <input
                type="url"
                value={testModelUrlInput}
                onChange={(e) => setTestModelUrlInput(e.target.value)}
                placeholder="https://.../modelo.glb o .obj"
                className="w-full rounded border border-white/15 bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-100 select-text focus:border-sky-400 focus:outline-none"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => viewportRef.current?.loadTestModel(testModelUrlInput)}
                  className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-sky-600 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-sky-500"
                >
                  <Box className="h-3 w-3" />
                  Cargar modelo
                </button>
                <button
                  type="button"
                  onClick={() => viewportRef.current?.clearTestModel()}
                  className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
                  title="Quitar modelo de prueba"
                >
                  <Trash2 className="h-3 w-3" />
                  Quitar
                </button>
              </div>
            </div>

            <p className="border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-400">
              WASD mover/conducir · Shift correr · Espacio saltar · E moto/puerta · F saludar · V vista · C free-cam · F2 FPS/TPS · P pausa · L lenta · G guardar · K cargar · H debug
            </p>
          </div>
        )}
      </aside>

      {/* Pantalla de carga inicial del GLB */}
      {!isLoaded && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#cfd9e6] text-slate-900"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium">
            Cargando escena 3D (<span className="tabular-nums">{loadPct}%</span>)...
          </p>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-slate-900/15">
            <div
              className="h-full bg-blue-600 transition-all duration-150"
              style={{ width: `${loadPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Aviso de pérdida de contexto WebGL */}
      {contextLost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-6 text-center text-white">
          <p className="text-sm font-medium">
            Contexto WebGL suspendido temporalmente. Restaurando escena...
          </p>
        </div>
      )}

      {/* Controles táctiles móviles */}
      <MobileControls
        visible={touchControlsVisible}
        isWaving={isWaving}
        isMounted={isMounted}
        interactPrompt={interactPrompt}
        onJoystickChange={(x, y, active) => {
          viewportRef.current?.setJoystick(x, y, active);
        }}
        onJump={() => {
          viewportRef.current?.triggerJump();
        }}
        onToggleWave={() => {
          viewportRef.current?.toggleWave();
        }}
        onInteract={() => {
          viewportRef.current?.interact();
        }}
      />

      {/* Menú de pausa en partida */}
      <PauseMenuModal
        open={pauseMenuOpen}
        activeMapName={activeMapName}
        onResume={() => setPauseMenuOpen(false)}
        onReset={() => {
          viewportRef.current?.resetPlayer();
          setPauseMenuOpen(false);
        }}
        onOpenSettings={() => {
          setPauseMenuOpen(false);
          setSettingsOpen(true);
        }}
        onChangeMap={() => {
          setPauseMenuOpen(false);
          setDebugOpen(false);
          setView('maps');
        }}
        onBackToMenu={() => {
          setPauseMenuOpen(false);
          setDebugOpen(false);
          setView('menu');
        }}
      />

      {/* Configuración accesible desde el menú en partida */}
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={handleUpdateSettings}
      />

      {/* Modal para inspeccionar y copiar engine.html */}
      <CodeModal
        open={codeModalOpen}
        htmlCode={standaloneHtml}
        onClose={() => setCodeModalOpen(false)}
        onDownload={handleDownloadEngineHtml}
      />
    </main>
  );
}
