export type QualityPreset = 'low' | 'medium' | 'high';
export type ControlMode = 'auto' | 'touch' | 'pc';

export interface EngineSettings {
  quality: QualityPreset;
  controls: ControlMode;
  cameraSensitivity: number;
  audioVolume: number;
}

export const SETTINGS_STORAGE_KEY = 'engine_settings_v1';
export const SELECTED_MAP_STORAGE_KEY = 'engine_selected_map_v1';
export const CUSTOM_MAPS_STORAGE_KEY = 'engine_custom_maps_v1';

export function getDefaultEngineSettings(): EngineSettings {
  const isCoarse =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0);
  return {
    quality: isCoarse ? 'low' : 'medium',
    controls: 'auto',
    cameraSensitivity: 1.0,
    audioVolume: 0.8,
  };
}

export function normalizeEngineSettings(raw: unknown): EngineSettings {
  const defaults = getDefaultEngineSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;

  const quality: QualityPreset =
    obj.quality === 'low' || obj.quality === 'medium' || obj.quality === 'high'
      ? obj.quality
      : defaults.quality;

  const controls: ControlMode =
    obj.controls === 'auto' || obj.controls === 'touch' || obj.controls === 'pc'
      ? obj.controls
      : defaults.controls;

  const sensRaw =
    typeof obj.cameraSensitivity === 'number' && Number.isFinite(obj.cameraSensitivity)
      ? obj.cameraSensitivity
      : defaults.cameraSensitivity;
  const cameraSensitivity = Math.max(0.3, Math.min(2.5, Number(sensRaw.toFixed(2))));

  const volRaw =
    typeof obj.audioVolume === 'number' && Number.isFinite(obj.audioVolume)
      ? obj.audioVolume
      : defaults.audioVolume;
  const audioVolume = Math.max(0, Math.min(1, Number(volRaw.toFixed(2))));

  return {
    quality,
    controls,
    cameraSensitivity,
    audioVolume,
  };
}

export function loadEngineSettings(): EngineSettings {
  if (typeof window === 'undefined') return getDefaultEngineSettings();
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return getDefaultEngineSettings();
    return normalizeEngineSettings(JSON.parse(raw));
  } catch {
    return getDefaultEngineSettings();
  }
}

export function saveEngineSettings(settings: EngineSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeEngineSettings(settings))
    );
  } catch {
    // noop
  }
}
