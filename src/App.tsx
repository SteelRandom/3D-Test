import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Code2,
  Download,
  Eye,
  Gauge,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Smartphone,
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

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
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
          setDockCollapsed((prev) => !prev);
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
      timeScale: number;
      health: number;
      isWaving: boolean;
      isMounted: boolean;
      vehicleSpeedKmh: number;
      interactPrompt: string | null;
      interactType: InteractTargetType;
      doorOpen: boolean;
    }) => {
      setAnimState(next.animState);
      setGrounded(next.grounded);
      setViewLabel(next.viewLabel);
      setCameraMode(next.cameraMode);
      setTimeScale(next.timeScale);
      setHealth(next.health);
      setIsWaving(next.isWaving);
      setIsMounted(next.isMounted);
      setVehicleSpeedKmh(next.vehicleSpeedKmh);
      setInteractPrompt(next.interactPrompt);
      setInteractType(next.interactType);
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

      {/* Retícula central para EngineRaycaster */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform duration-100 ${
          hasRayTarget
            ? 'h-3 w-3 border-amber-600 bg-amber-400'
            : 'h-2 w-2 border-slate-900/55 bg-white/80'
        }`}
      />

      {/* Cabecera mínima superior izquierda */}
      <header className="pointer-events-none fixed top-4 left-4 z-10 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-900/10 bg-white/85 px-4 py-2.5 text-slate-900 shadow-sm">
        <h1 className="text-sm font-semibold tracking-tight text-slate-900">
          Núcleo Engine 3D · Personaje + Moto + FPS
        </h1>
        <p className="mt-0.5 text-xs text-slate-600">
          WASD mover/conducir · Shift correr · Espacio saltar · E puerta/moto · F saludar · V vista · F2 FPS/TPS · P pausa · L lenta
        </p>
        {loadNotice && (
          <p className="mt-1 text-xs font-medium text-amber-700">
            {loadNotice}
          </p>
        )}
      </header>

      {/* Aviso de interacción del EngineRaycaster (puerta o motocicleta) */}
      {interactPrompt && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-white/15 bg-slate-950/90 px-4 py-2 text-xs font-semibold text-white shadow-lg"
        >
          {interactPrompt}
        </div>
      )}

      {/* Pantalla de carga inicial del GLB */}
      {!isLoaded && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#cfd9e6] text-slate-900"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium">
            Cargando Soldier.glb (<span className="tabular-nums">{loadPct}%</span>)...
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

      {/* Dock inferior colapsable */}
      <div
        className={`fixed bottom-4 left-1/2 z-[25] flex max-w-[min(1160px,95vw)] -translate-x-1/2 flex-col items-center transition-transform duration-200 ${
          dockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
        }`}
      >
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="flex cursor-pointer items-center gap-1 rounded-t-lg border border-b-0 border-white/15 bg-slate-950/90 px-3 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-900"
          aria-expanded={!dockCollapsed}
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Mostrar controles
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Ocultar controles
            </>
          )}
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-950/90 px-3.5 py-2 text-xs text-slate-100 shadow-xl">
          <div className="font-mono flex items-center gap-2 px-1.5 text-slate-300 tabular-nums">
            <span className="font-medium text-white">
              {animState}
              {isWaving ? ' + Wave' : ''}
            </span>
            <span aria-hidden="true">·</span>
            {isMounted ? (
              <span className="text-sky-300">Moto {vehicleSpeedKmh} km/h</span>
            ) : (
              <span>{grounded ? 'En suelo' : 'En aire'}</span>
            )}
            <span aria-hidden="true">·</span>
            <span>HP {health}</span>
            <span aria-hidden="true">·</span>
            <span className={isPaused ? 'text-amber-400' : isSlowMo ? 'text-sky-400' : 'text-slate-300'}>
              {isPaused ? 'PAUSA' : `${timeScale}x`}
            </span>
          </div>

          <div className="h-4 w-px bg-white/15" aria-hidden="true" />

          <button
            type="button"
            onClick={() => viewportRef.current?.toggleCameraMode()}
            aria-pressed={cameraMode === 'FPS'}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
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
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
              isPaused
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {isPaused ? 'Reanudar (P)' : 'Pausa (P)'}
          </button>

          <button
            type="button"
            onClick={() => viewportRef.current?.toggleSlowMotion()}
            aria-pressed={isSlowMo}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
              isSlowMo
                ? 'bg-sky-600 text-white hover:bg-sky-500'
                : 'bg-slate-800 text-slate-100 hover:bg-slate-700'
            }`}
          >
            <Gauge className="h-3.5 w-3.5" />
            Lenta 0.2x (L)
          </button>

          {!isMounted && (
            <button
              type="button"
              onClick={() => viewportRef.current?.toggleWave()}
              aria-pressed={isWaving}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
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
            onClick={() => viewportRef.current?.cycleCameraView()}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Camera className="h-3.5 w-3.5" />
            Vista: {viewLabel}
          </button>

          <button
            type="button"
            onClick={() => viewportRef.current?.resetPlayer()}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reiniciar
          </button>

          {!isTouchDevice && (
            <button
              type="button"
              onClick={() => setShowMobilePreview((v) => !v)}
              aria-pressed={showMobilePreview}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
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
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            <Code2 className="h-3.5 w-3.5" />
            Ver HTML único
          </button>

          <button
            type="button"
            onClick={handleDownloadHtml}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar HTML
          </button>
        </div>
      </div>

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
