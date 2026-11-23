import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Bug,
  Camera,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  Download,
  Eye,
  FolderOpen,
  Gauge,
  Hand,
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
  ThirdPersonViewport,
  ThirdPersonViewportHandle,
} from './components/ThirdPersonViewport';
import { MobileControls } from './components/MobileControls';
import { CodeModal } from './components/CodeModal';
import { generateStandaloneHtml } from './scene/standaloneHtml';
import { CAMERA_VIEWS } from './scene/courseConfig';

export default function App() {
  const viewportRef = useRef<ThirdPersonViewportHandle | null>(null);

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
      if (e.key.toLowerCase() === 'h' && !codeModalOpen) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          setDebugOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [codeModalOpen]);

  const standaloneHtml = useMemo(() => generateStandaloneHtml(), []);

  const handleLoadProgress = useCallback(
    (progress: number, loaded: boolean, error: string | null) => {
      setLoadPct(progress);
      setIsLoaded(loaded);
      setLoadNotice(error);
    },
    []
  );

  const handleStateChange = useCallback(
    (next: {
      animState: CharacterAnimState;
      grounded: boolean;
      viewLabel: string;
      cameraMode: CameraMode;
      freeCam: boolean;
      timeScale: number;
      health: number;
      isWaving: boolean;
      isMounted: boolean;
      vehicleSpeedKmh: number;
      interactPrompt: string | null;
      interactType: InteractTargetType;
      doorOpen: boolean;
      hondaParts: string[];
      fps: number;
      drawCalls: number;
      lastTrigger: string | null;
      saveStatus: string | null;
      testModelStatus: string | null;
    }) => {
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
      setLastTrigger(next.lastTrigger);
      setSaveStatus(next.saveStatus);
      setTestModelStatus(next.testModelStatus);
    },
    []
  );

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([standaloneHtml], {
      type: 'text/html;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'personaje-tercera-persona.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [standaloneHtml]);

  const touchControlsVisible = isTouchDevice || showMobilePreview;
  const isPaused = timeScale === 0;
  const isSlowMo = timeScale > 0 && timeScale < 1;
  const hasRayTarget = interactType === 'door' || interactType === 'motorcycle';

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#cfd9e6] select-none">
      {/* Lienzo 3D aislado a pantalla completa */}
      <ThirdPersonViewport
        ref={viewportRef}
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

      {/* Panel colapsable derecho DEBUG */}
      <aside className="fixed top-4 right-4 z-[25] flex flex-col items-end gap-2">
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
                  {fps} FPS · {drawCalls} draws
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
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 font-medium text-slate-100 transition-colors hover:bg-slate-700"
              >
                <Code2 className="h-3.5 w-3.5" />
                Ver HTML
              </button>

              <button
                type="button"
                onClick={handleDownloadHtml}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 font-medium text-white transition-colors hover:bg-blue-500"
              >
                <Download className="h-3.5 w-3.5" />
                HTML único
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

      {/* Controles táctiles móviles (ocultos automáticamente en PC salvo vista previa) */}
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

      {/* Modal para inspeccionar y copiar el archivo único HTML */}
      <CodeModal
        open={codeModalOpen}
        htmlCode={standaloneHtml}
        onClose={() => setCodeModalOpen(false)}
        onDownload={handleDownloadHtml}
      />
    </main>
  );
}
