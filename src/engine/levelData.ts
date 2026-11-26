import {
  DOOR_CONFIG,
  PHYSICS_CONFIG,
  SCENE_COLORS,
  VEHICLE_CONFIG,
} from '../scene/courseConfig';

export interface MapColliderJSON {
  type: 'box' | 'ramp' | 'cylinder';
  pos: [number, number, number];
  rot?: [number, number, number];
  scale: [number, number, number];
  visible?: boolean;
  color?: string | number;
  mass?: number;
}

export interface MapObjectJSON {
  type: 'box' | 'ramp' | 'cylinder' | 'model';
  url?: string;
  pos: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number] | number;
  color?: string | number;
  physics?: boolean;
  mass?: number;
  castShadow?: boolean;
}

export interface MapDoorJSON {
  pos: [number, number, number];
  size?: [number, number, number];
  rot?: number | [number, number, number];
}

export interface MapTriggerJSON {
  id?: string;
  label?: string;
  pos: [number, number, number];
  size: [number, number, number];
  action: 'boost' | 'checkpoint' | 'teleport';
  value?: number | [number, number, number];
  target?: [number, number, number];
  color?: string | number;
  visible?: boolean;
}

export interface MapModelJSON {
  url: string;
  type: 'glb' | 'obj';
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number] | number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface MapJSON {
  id?: string;
  nombre?: string;
  name?: string;
  descripcion?: string;
  dificultad?: string;
  thumbnailColor?: string;
  spawn?: {
    player?: [number, number, number];
    bike?: [number, number, number];
    bikeRotY?: number;
  };
  environment?: {
    bgColor?: string | number;
    fogColor?: string | number;
    fogNear?: number;
    fogFar?: number;
    ambientIntensity?: number;
    dirIntensity?: number;
  };
  ground?: {
    size?: number;
    color?: string | number;
    visible?: boolean;
    physics?: boolean;
  };
  mapModel?: MapModelJSON;
  colliders?: MapColliderJSON[];
  objects?: MapObjectJSON[];
  doors?: MapDoorJSON[];
  triggers?: MapTriggerJSON[];
}

export interface NormalizedMapJSON {
  id: string;
  name: string;
  nombre: string;
  descripcion: string;
  dificultad: string;
  thumbnailColor: string;
  spawn: {
    player: [number, number, number];
    bike: [number, number, number];
    bikeRotY: number;
  };
  environment: {
    bgColor: string | number;
    fogColor: string | number;
    fogNear: number;
    fogFar: number;
    ambientIntensity: number;
    dirIntensity: number;
  };
  ground: {
    size: number;
    color: string | number;
    visible: boolean;
    physics: boolean;
  };
  mapModel: MapModelJSON | null;
  colliders: MapColliderJSON[];
  objects: MapObjectJSON[];
  doors: MapDoorJSON[];
  triggers: MapTriggerJSON[];
}

function asVec3(
  val: unknown,
  fallback: readonly [number, number, number]
): [number, number, number] {
  if (
    Array.isArray(val) &&
    val.length >= 3 &&
    typeof val[0] === 'number' &&
    typeof val[1] === 'number' &&
    typeof val[2] === 'number' &&
    Number.isFinite(val[0]) &&
    Number.isFinite(val[1]) &&
    Number.isFinite(val[2])
  ) {
    return [val[0], val[1], val[2]];
  }
  return [fallback[0], fallback[1], fallback[2]];
}

function asNum(val: unknown, fallback: number): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

function asColor(val: unknown, fallback: string | number): string | number {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  return fallback;
}

export function normalizeMapJSON(raw: unknown): NormalizedMapJSON {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('El JSON del mapa debe ser un objeto válido.');
  }
  const data = raw as Record<string, unknown>;
  const spawnRaw = (data.spawn && typeof data.spawn === 'object' ? data.spawn : {}) as Record<
    string,
    unknown
  >;
  const envRaw = (
    data.environment && typeof data.environment === 'object' ? data.environment : {}
  ) as Record<string, unknown>;
  const groundRaw = (
    data.ground && typeof data.ground === 'object' ? data.ground : {}
  ) as Record<string, unknown>;

  let mapModel: MapModelJSON | null = null;
  if (data.mapModel && typeof data.mapModel === 'object') {
    const mm = data.mapModel as Record<string, unknown>;
    if (typeof mm.url === 'string' && mm.url.trim().length > 0) {
      const modelType = mm.type === 'obj' ? 'obj' : 'glb';
      mapModel = {
        url: mm.url.trim(),
        type: modelType,
        pos: asVec3(mm.pos, [0, 0, 0]),
        rot: asVec3(mm.rot, [0, 0, 0]),
        scale:
          typeof mm.scale === 'number'
            ? mm.scale
            : asVec3(mm.scale, [1, 1, 1]),
        castShadow: typeof mm.castShadow === 'boolean' ? mm.castShadow : false,
        receiveShadow: typeof mm.receiveShadow === 'boolean' ? mm.receiveShadow : true,
      };
    }
  }

  const colliders: MapColliderJSON[] = Array.isArray(data.colliders)
    ? data.colliders
        .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
        .map((c) => ({
          type:
            c.type === 'ramp' || c.type === 'cylinder' ? c.type : 'box',
          pos: asVec3(c.pos, [0, 0.5, 0]),
          rot: asVec3(c.rot, [0, 0, 0]),
          scale: asVec3(c.scale, [2, 1, 2]),
          visible: typeof c.visible === 'boolean' ? c.visible : true,
          color: asColor(c.color, SCENE_COLORS.blockPrimaryHex),
          mass: asNum(c.mass, 0),
        }))
    : [];

  const objects: MapObjectJSON[] = Array.isArray(data.objects)
    ? data.objects
        .filter((o): o is Record<string, unknown> => Boolean(o && typeof o === 'object'))
        .map((o) => ({
          type:
            o.type === 'ramp' || o.type === 'cylinder' || o.type === 'model'
              ? o.type
              : 'box',
          url: typeof o.url === 'string' ? o.url.trim() : undefined,
          pos: asVec3(o.pos, [0, 1, 0]),
          rot: asVec3(o.rot, [0, 0, 0]),
          scale:
            typeof o.scale === 'number'
              ? o.scale
              : asVec3(o.scale, [1, 1, 1]),
          color: asColor(o.color, SCENE_COLORS.blockSecondaryHex),
          physics: typeof o.physics === 'boolean' ? o.physics : false,
          mass: asNum(o.mass, 15),
          castShadow: typeof o.castShadow === 'boolean' ? o.castShadow : true,
        }))
    : [];

  const doors: MapDoorJSON[] = Array.isArray(data.doors)
    ? data.doors
        .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === 'object'))
        .map((d) => ({
          pos: asVec3(d.pos, DOOR_CONFIG.position),
          size: asVec3(d.size, [
            DOOR_CONFIG.openingWidth,
            DOOR_CONFIG.openingHeight,
            DOOR_CONFIG.leafThickness,
          ]),
          rot:
            typeof d.rot === 'number'
              ? d.rot
              : Array.isArray(d.rot)
              ? asVec3(d.rot, [0, 0, 0])
              : 0,
        }))
    : [];

  const triggers: MapTriggerJSON[] = Array.isArray(data.triggers)
    ? data.triggers
        .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
        .map((t, idx) => ({
          id: typeof t.id === 'string' ? t.id : `trigger_${idx + 1}`,
          label: typeof t.label === 'string' ? t.label : undefined,
          pos: asVec3(t.pos, [0, 0.5, 0]),
          size: asVec3(t.size, [2.5, 1.2, 2.5]),
          action:
            t.action === 'checkpoint' || t.action === 'teleport'
              ? t.action
              : 'boost',
          value: Array.isArray(t.value)
            ? asVec3(t.value, [0, 1, 0])
            : asNum(t.value, 6.5),
          target: Array.isArray(t.target)
            ? asVec3(t.target, [0, 1.2, 0])
            : undefined,
          color: asColor(
            t.color,
            t.action === 'checkpoint'
              ? 0x10b981
              : t.action === 'teleport'
              ? 0xa855f7
              : 0x06b6d4
          ),
          visible: typeof t.visible === 'boolean' ? t.visible : true,
        }))
    : [];

  const resolvedName =
    typeof data.nombre === 'string' && data.nombre.trim().length > 0
      ? data.nombre.trim()
      : typeof data.name === 'string' && data.name.trim().length > 0
      ? data.name.trim()
      : 'Mapa Personalizado';

  const resolvedId =
    typeof data.id === 'string' && data.id.trim().length > 0
      ? data.id.trim()
      : resolvedName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '') || 'custom_map';

  return {
    id: resolvedId,
    name: resolvedName,
    nombre: resolvedName,
    descripcion:
      typeof data.descripcion === 'string' && data.descripcion.trim().length > 0
        ? data.descripcion.trim()
        : 'Escenario JSON cargado en el motor 3D.',
    dificultad:
      typeof data.dificultad === 'string' && data.dificultad.trim().length > 0
        ? data.dificultad.trim()
        : 'Media',
    thumbnailColor:
      typeof data.thumbnailColor === 'string' && data.thumbnailColor.trim().length > 0
        ? data.thumbnailColor.trim()
        : '#334155',
    spawn: {
      player: asVec3(spawnRaw.player, PHYSICS_CONFIG.spawnPosition),
      bike: asVec3(spawnRaw.bike, VEHICLE_CONFIG.spawnPosition),
      bikeRotY: asNum(spawnRaw.bikeRotY, VEHICLE_CONFIG.spawnYaw),
    },
    environment: {
      bgColor: asColor(envRaw.bgColor, SCENE_COLORS.skyCss),
      fogColor: asColor(envRaw.fogColor, SCENE_COLORS.skyCss),
      fogNear: asNum(envRaw.fogNear, 28),
      fogFar: asNum(envRaw.fogFar, 92),
      ambientIntensity: asNum(envRaw.ambientIntensity, 0.45),
      dirIntensity: asNum(envRaw.dirIntensity, 1.85),
    },
    ground: {
      size: asNum(groundRaw.size, 220),
      color: asColor(groundRaw.color, SCENE_COLORS.groundHex),
      visible: typeof groundRaw.visible === 'boolean' ? groundRaw.visible : true,
      physics: typeof groundRaw.physics === 'boolean' ? groundRaw.physics : true,
    },
    mapModel,
    colliders,
    objects,
    doors,
    triggers,
  };
}

export const BARRIO_URBANO_MAP: MapJSON = {
  id: 'barrio_urbana',
  nombre: 'Barrio Urbano',
  name: 'Barrio Urbano',
  descripcion:
    'Calles rectas, curvas amplias, casas variadas, pequeñas lomas, puertas interactivas y zonas de impulso.',
  dificultad: 'Fácil',
  thumbnailColor: '#3b82f6',
  spawn: {
    player: [1.4, 0.9, 10.0],
    bike: [-1.8, 0.54, 10.2],
    bikeRotY: 0,
  },
  environment: {
    bgColor: '#dce5f0',
    fogColor: '#dce5f0',
    fogNear: 34,
    fogFar: 118,
    ambientIntensity: 0.48,
    dirIntensity: 1.9,
  },
  ground: {
    size: 240,
    color: '#cbd5e1',
    visible: true,
    physics: true,
  },
  colliders: [
    // Manzana izquierda: casas urbanas variadas
    {
      type: 'box',
      pos: [-13.5, 2.2, 2.0],
      scale: [8.0, 4.4, 10.0],
      visible: true,
      color: '#e2e8f0',
    },
    {
      type: 'box',
      pos: [-13.5, 4.65, 2.0],
      scale: [8.4, 0.5, 10.4],
      visible: true,
      color: '#64748b',
    },
    {
      type: 'box',
      pos: [-14.0, 3.1, -12.0],
      scale: [7.5, 6.2, 8.5],
      visible: true,
      color: '#f1f5f9',
    },
    {
      type: 'box',
      pos: [-14.0, 6.45, -12.0],
      scale: [7.9, 0.5, 8.9],
      visible: true,
      color: '#475569',
    },
    // Manzana derecha: viviendas bajas y acceso a puerta
    {
      type: 'box',
      pos: [13.5, 1.8, 4.0],
      scale: [7.5, 3.6, 8.0],
      visible: true,
      color: '#e2e8f0',
    },
    {
      type: 'box',
      pos: [13.5, 3.8, 4.0],
      scale: [7.9, 0.4, 8.4],
      visible: true,
      color: '#94a3b8',
    },
    {
      type: 'box',
      pos: [14.0, 2.7, -11.5],
      scale: [8.5, 5.4, 9.0],
      visible: true,
      color: '#f8fafc',
    },
    // Lomas urbanas suaves en la avenida
    {
      type: 'ramp',
      pos: [0, 0.48, -14.0],
      rot: [0.14, 0, 0],
      scale: [6.5, 0.24, 6.8],
      visible: true,
      color: '#64748b',
    },
    {
      type: 'box',
      pos: [0, 0.47, -20.2],
      scale: [6.5, 0.94, 6.2],
      visible: true,
      color: '#475569',
    },
    {
      type: 'ramp',
      pos: [0, 0.48, -26.4],
      rot: [-0.14, 0, 0],
      scale: [6.5, 0.24, 6.8],
      visible: true,
      color: '#64748b',
    },
    // Muros de giro amplio al fondo del circuito urbano
    {
      type: 'box',
      pos: [0, 1.5, -42.0],
      scale: [34.0, 3.0, 2.2],
      visible: true,
      color: '#94a3b8',
    },
    // Glorieta / poste de esquina
    {
      type: 'cylinder',
      pos: [16.5, 1.8, -32.0],
      scale: [3.2, 3.6, 3.2],
      visible: true,
      color: '#cbd5e1',
    },
  ],
  objects: [
    // Asfalto visual (sin fricción física para rodadura limpia)
    {
      type: 'box',
      pos: [0, 0.006, -12.0],
      scale: [10.0, 0.012, 56.0],
      color: '#334155',
      physics: false,
      castShadow: false,
    },
    {
      type: 'box',
      pos: [0, 0.007, -34.0],
      scale: [36.0, 0.012, 9.0],
      color: '#334155',
      physics: false,
      castShadow: false,
    },
    // Cajas de obra empujables en la acera
    {
      type: 'box',
      pos: [6.2, 0.45, 2.5],
      rot: [0, 0.15, 0],
      scale: [0.9, 0.9, 0.9],
      color: '#f59e0b',
      physics: true,
      mass: 14,
    },
    {
      type: 'box',
      pos: [6.2, 0.45, 1.3],
      rot: [0, -0.1, 0],
      scale: [0.9, 0.9, 0.9],
      color: '#d97706',
      physics: true,
      mass: 14,
    },
  ],
  doors: [
    {
      pos: [7.5, 0, 5.2],
      size: [1.5, 2.35, 0.1],
      rot: Math.PI / 2,
    },
    {
      pos: [-7.5, 0, -4.0],
      size: [1.5, 2.35, 0.1],
      rot: -Math.PI / 2,
    },
  ],
  triggers: [
    {
      id: 'urbano-boost-avenida',
      label: 'Impulso Avenida Central',
      pos: [0, 0.55, -5.0],
      size: [4.2, 1.2, 2.2],
      action: 'boost',
      value: 7.5,
      color: '#0ea5e9',
      visible: true,
    },
    {
      id: 'urbano-boost-regreso',
      label: 'Impulso Curva Norte',
      pos: [9.5, 0.55, -34.0],
      size: [3.2, 1.2, 4.4],
      action: 'boost',
      value: 6.5,
      color: '#06b6d4',
      visible: true,
    },
    {
      id: 'urbano-checkpoint-loma',
      label: 'Checkpoint Plaza Norte',
      pos: [0, 1.5, -20.2],
      size: [4.4, 1.5, 3.6],
      action: 'checkpoint',
      color: '#10b981',
      visible: true,
    },
  ],
};

export const PARQUE_STUNT_MAP: MapJSON = {
  id: 'parque_stunt',
  nombre: 'Stunt Arena',
  name: 'Stunt Arena',
  descripcion:
    'Rampas de distintos ángulos, puentes elevados, plataformas para caballitos y saltos de prueba extrema.',
  dificultad: 'Media',
  thumbnailColor: '#f59e0b',
  spawn: {
    player: [2.8, 0.9, 13.5],
    bike: [0, 0.54, 13.8],
    bikeRotY: 0,
  },
  environment: {
    bgColor: '#e2e8f0',
    fogColor: '#e2e8f0',
    fogNear: 38,
    fogFar: 130,
    ambientIntensity: 0.48,
    dirIntensity: 1.95,
  },
  ground: {
    size: 260,
    color: '#cbd5e1',
    visible: true,
    physics: true,
  },
  colliders: [
    // Rampa media central
    {
      type: 'ramp',
      pos: [0, 0.8, 0.5],
      rot: [0.25, 0, 0],
      scale: [4.8, 0.28, 6.6],
      visible: true,
      color: '#475569',
    },
    // Plataforma de aterrizaje principal
    {
      type: 'box',
      pos: [0, 1.6, -12.5],
      scale: [6.4, 0.5, 11.5],
      visible: true,
      color: '#334155',
    },
    // Pilares del puente
    {
      type: 'cylinder',
      pos: [-2.4, 0.72, -8.5],
      scale: [0.7, 1.44, 0.7],
      visible: true,
      color: '#94a3b8',
    },
    {
      type: 'cylinder',
      pos: [2.4, 0.72, -8.5],
      scale: [0.7, 1.44, 0.7],
      visible: true,
      color: '#94a3b8',
    },
    // Rampa de bajada del puente
    {
      type: 'ramp',
      pos: [0, 0.8, -21.8],
      rot: [-0.22, 0, 0],
      scale: [5.0, 0.28, 7.4],
      visible: true,
      color: '#475569',
    },
    // Rampa derecha ángulo suave (velocidad / wheelie)
    {
      type: 'ramp',
      pos: [10.5, 0.62, 1.0],
      rot: [0.18, 0, 0],
      scale: [4.2, 0.26, 7.0],
      visible: true,
      color: '#0284c7',
    },
    // Mega rampa izquierda ángulo pronunciado (34°)
    {
      type: 'ramp',
      pos: [-10.5, 1.18, -1.5],
      rot: [0.34, 0, 0],
      scale: [4.4, 0.3, 7.2],
      visible: true,
      color: '#ea580c',
    },
  ],
  objects: [
    // Pista central marcada en suelo
    {
      type: 'box',
      pos: [0, 0.006, 2.0],
      scale: [6.0, 0.012, 34.0],
      color: '#1e293b',
      physics: false,
      castShadow: false,
    },
    // Barrera de cajas físicas arriba del puente
    {
      type: 'box',
      pos: [-1.1, 2.32, -15.5],
      scale: [0.9, 0.9, 0.9],
      color: '#f59e0b',
      physics: true,
      mass: 9,
    },
    {
      type: 'box',
      pos: [0, 2.32, -15.5],
      scale: [0.9, 0.9, 0.9],
      color: '#ef4444',
      physics: true,
      mass: 9,
    },
    {
      type: 'box',
      pos: [1.1, 2.32, -15.5],
      scale: [0.9, 0.9, 0.9],
      color: '#f59e0b',
      physics: true,
      mass: 9,
    },
  ],
  doors: [
    {
      pos: [5.5, 0, 11.0],
      size: [1.6, 2.4, 0.1],
      rot: 0,
    },
  ],
  triggers: [
    {
      id: 'stunt-turbo-central',
      label: 'Turbo Salto Central',
      pos: [0, 0.55, 5.2],
      size: [4.0, 1.2, 2.0],
      action: 'boost',
      value: 10.0,
      color: '#06b6d4',
      visible: true,
    },
    {
      id: 'stunt-checkpoint-puente',
      label: 'Checkpoint Puente',
      pos: [0, 2.45, -11.5],
      size: [4.6, 1.6, 3.2],
      action: 'checkpoint',
      color: '#10b981',
      visible: true,
    },
    {
      id: 'stunt-teleport-retorno',
      label: 'Retorno Arena',
      pos: [0, 0.7, -30.5],
      size: [5.0, 1.5, 3.0],
      action: 'teleport',
      target: [0, 0.9, 14.5],
      color: '#8b5cf6',
      visible: true,
    },
  ],
};

export const CIRCUITO_OFFROAD_MAP: MapJSON = {
  id: 'circuito_offroad',
  nombre: 'Terreno Irregular',
  name: 'Terreno Irregular',
  descripcion:
    'Pista técnica con baches rítmicos, pendientes cruzadas, lomas escalonadas y obstáculos para probar la suspensión.',
  dificultad: 'Difícil',
  thumbnailColor: '#10b981',
  spawn: {
    player: [2.6, 0.9, 14.5],
    bike: [0, 0.54, 14.8],
    bikeRotY: 0,
  },
  environment: {
    bgColor: '#e5e7eb',
    fogColor: '#e5e7eb',
    fogNear: 30,
    fogFar: 108,
    ambientIntensity: 0.46,
    dirIntensity: 1.85,
  },
  ground: {
    size: 240,
    color: '#d6d3d1',
    visible: true,
    physics: true,
  },
  colliders: [
    // Serie de 6 baches rítmicos (whoops) para compresión y rebote de suspensión
    {
      type: 'box',
      pos: [0, 0.14, 7.5],
      rot: [0.16, 0, 0],
      scale: [4.8, 0.28, 1.8],
      visible: true,
      color: '#78716c',
    },
    {
      type: 'box',
      pos: [0, 0.18, 4.2],
      rot: [0.18, 0, 0],
      scale: [4.8, 0.36, 1.9],
      visible: true,
      color: '#57534e',
    },
    {
      type: 'box',
      pos: [0, 0.22, 0.8],
      rot: [-0.15, 0, 0],
      scale: [4.8, 0.42, 2.0],
      visible: true,
      color: '#78716c',
    },
    {
      type: 'box',
      pos: [0, 0.19, -2.6],
      rot: [0.19, 0, 0],
      scale: [4.8, 0.38, 1.9],
      visible: true,
      color: '#57534e',
    },
    {
      type: 'box',
      pos: [0, 0.24, -6.0],
      rot: [-0.16, 0, 0],
      scale: [4.8, 0.46, 2.0],
      visible: true,
      color: '#78716c',
    },
    {
      type: 'box',
      pos: [0, 0.16, -9.4],
      rot: [0.14, 0, 0],
      scale: [4.8, 0.32, 1.8],
      visible: true,
      color: '#57534e',
    },
    // Lomas con peralte lateral (roll + pitch simultáneo)
    {
      type: 'ramp',
      pos: [-7.5, 0.45, -3.5],
      rot: [0.12, 0, 0.16],
      scale: [5.4, 0.3, 8.0],
      visible: true,
      color: '#a8a29e',
    },
    {
      type: 'ramp',
      pos: [7.5, 0.45, -3.5],
      rot: [0.12, 0, -0.16],
      scale: [5.4, 0.3, 8.0],
      visible: true,
      color: '#a8a29e',
    },
    // Meseta escalonada al fondo
    {
      type: 'ramp',
      pos: [0, 0.65, -17.0],
      rot: [0.22, 0, 0],
      scale: [5.5, 0.28, 6.2],
      visible: true,
      color: '#57534e',
    },
    {
      type: 'box',
      pos: [0, 0.68, -23.5],
      scale: [6.2, 1.36, 7.2],
      visible: true,
      color: '#44403c',
    },
    {
      type: 'ramp',
      pos: [0, 0.65, -30.0],
      rot: [-0.2, 0, 0],
      scale: [5.5, 0.28, 6.2],
      visible: true,
      color: '#57534e',
    },
    // Rocas cilíndricas / troncos obstáculo
    {
      type: 'cylinder',
      pos: [-4.2, 0.9, 10.0],
      scale: [1.8, 1.8, 1.8],
      visible: true,
      color: '#78716c',
    },
    {
      type: 'cylinder',
      pos: [4.6, 1.1, -13.0],
      scale: [2.2, 2.2, 2.2],
      visible: true,
      color: '#78716c',
    },
  ],
  objects: [
    {
      type: 'box',
      pos: [-2.8, 0.45, 9.5],
      scale: [0.85, 0.85, 0.85],
      color: '#d97706',
      physics: true,
      mass: 12,
    },
  ],
  doors: [
    {
      pos: [5.0, 0, 12.2],
      size: [1.5, 2.35, 0.1],
      rot: 0,
    },
  ],
  triggers: [
    {
      id: 'offroad-boost-whoops',
      label: 'Impulso Zona Baches',
      pos: [0, 0.55, 11.2],
      size: [4.0, 1.2, 1.8],
      action: 'boost',
      value: 7.0,
      color: '#0ea5e9',
      visible: true,
    },
    {
      id: 'offroad-checkpoint-colina',
      label: 'Checkpoint Cumbre',
      pos: [0, 2.0, -23.5],
      size: [4.5, 1.5, 3.8],
      action: 'checkpoint',
      color: '#10b981',
      visible: true,
    },
  ],
};

export const BUILTIN_MAPS: Record<string, MapJSON> = {
  barrio_urbana: BARRIO_URBANO_MAP,
  parque_stunt: PARQUE_STUNT_MAP,
  circuito_offroad: CIRCUITO_OFFROAD_MAP,
};

export const BUILTIN_MAP_LIST: NormalizedMapJSON[] = [
  normalizeMapJSON(BARRIO_URBANO_MAP),
  normalizeMapJSON(PARQUE_STUNT_MAP),
  normalizeMapJSON(CIRCUITO_OFFROAD_MAP),
];

export const MAP_FILENAMES: Record<string, string> = {
  barrio_urbana: 'barrio_urbana.json',
  parque_stunt: 'parque_stunt.json',
  circuito_offroad: 'circuito_offroad.json',
};

export const DEFAULT_LEVEL_JSON = BARRIO_URBANO_MAP;
