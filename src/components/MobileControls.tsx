import React, { useRef, useState } from 'react';

interface MobileControlsProps {
  visible: boolean;
  isWaving: boolean;
  isMounted: boolean;
  interactPrompt: string | null;
  onJoystickChange: (x: number, y: number, active: boolean) => void;
  onJump: () => void;
  onToggleWave: () => void;
  onInteract: () => void;
}

const MAX_RADIUS = 40;

export function MobileControls({
  visible,
  isWaving,
  isMounted,
  interactPrompt,
  onJoystickChange,
  onJump,
  onToggleWave,
  onInteract,
}: MobileControlsProps) {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [jumpPressed, setJumpPressed] = useState(false);

  if (!visible) return null;

  const updateFromClient = (clientX: number, clientY: number) => {
    const zone = zoneRef.current;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_RADIUS) {
      dx = (dx / dist) * MAX_RADIUS;
      dy = (dy / dist) * MAX_RADIUS;
    }
    setKnobOffset({ x: dx, y: dy });

    const normX = dx / MAX_RADIUS;
    const normY = dy / MAX_RADIUS;
    const mag = Math.hypot(normX, normY);
    if (mag < 0.06) {
      onJoystickChange(0, 0, true);
    } else {
      onJoystickChange(normX, normY, true);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClient(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    updateFromClient(e.clientX, e.clientY);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystickChange(0, 0, false);
  };

  const handleJumpDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setJumpPressed(true);
    onJump();
  };

  const handleJumpEnd = () => {
    setJumpPressed(false);
  };

  const showContextButton = isMounted || Boolean(interactPrompt);
  const contextLabel = isMounted ? 'BAJAR (E)' : 'USAR (E)';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20"
      aria-label="Controles táctiles"
    >
      {/* Joystick virtual izquierdo */}
      <div
        ref={zoneRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{ touchAction: 'none' }}
        className="pointer-events-auto fixed bottom-6 left-6 flex h-[132px] w-[132px] items-center justify-center rounded-full border-2 border-white/60 bg-slate-900/30 shadow-lg"
        role="slider"
        aria-label="Joystick de movimiento"
        aria-valuetext={`${Math.round(knobOffset.x)}, ${Math.round(knobOffset.y)}`}
      >
        <div
          className="pointer-events-none h-[54px] w-[54px] rounded-full bg-white/95 shadow-md"
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        />
      </div>

      {/* Botones derechos: Interacción contextual (E), Saludo (F) y Salto/Freno */}
      <div className="pointer-events-none fixed right-6 bottom-7 flex flex-col items-end gap-3">
        {showContextButton && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInteract();
            }}
            style={{ touchAction: 'none' }}
            className="pointer-events-auto flex h-12 cursor-pointer items-center justify-center rounded-full border-2 border-white/75 bg-amber-600/95 px-4 text-xs font-bold tracking-wide text-white shadow-lg active:scale-95"
          >
            {contextLabel}
          </button>
        )}

        <div className="flex items-end gap-3">
          {!isMounted && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleWave();
              }}
              style={{ touchAction: 'none' }}
              aria-pressed={isWaving}
              className={`pointer-events-auto flex h-[56px] w-[76px] cursor-pointer items-center justify-center rounded-full border-2 border-white/70 text-xs font-bold text-white shadow-lg transition-transform duration-100 active:scale-95 ${
                isWaving ? 'bg-emerald-600/95' : 'bg-slate-800/85'
              }`}
            >
              SALUDO
            </button>
          )}

          {!isMounted && (
            <button
              type="button"
              onPointerDown={handleJumpDown}
              onPointerUp={handleJumpEnd}
              onPointerCancel={handleJumpEnd}
              onPointerLeave={handleJumpEnd}
              style={{ touchAction: 'none' }}
              aria-label="Saltar"
              className={`pointer-events-auto flex h-[88px] w-[88px] cursor-pointer items-center justify-center rounded-full border-2 border-white/75 text-sm font-bold tracking-wide text-white shadow-lg transition-transform duration-100 ${
                jumpPressed
                  ? 'scale-95 bg-blue-700'
                  : 'bg-blue-600/90 hover:bg-blue-600'
              }`}
            >
              SALTAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
