export const SOLDIER_MODEL_URL =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb';

export const HONDA_OBJ_URL =
  'https://raw.githubusercontent.com/SteelRandom/3D-Test/refs/heads/main/honda_cb_750_four_TS_00.obj';

export const HONDA_MTL_URL =
  'https://raw.githubusercontent.com/SteelRandom/3D-Test/refs/heads/main/honda_cb_750_four_TS_00.mtl';

export const MOTORCYCLE_MODEL_URL = HONDA_OBJ_URL;

export const SCENE_COLORS = {
  skyHex: 0xcfd9e6,
  skyCss: '#cfd9e6',
  groundHex: 0xd4d8de,
  blockPrimaryHex: 0xb6bec9,
  blockSecondaryHex: 0x9aa4b2,
  rampHex: 0xa5aebc,
  cylinderHex: 0xaeb7c4,
  doorFrameHex: 0x64748b,
  doorLeafHex: 0x475569,
  doorHandleHex: 0xe2e8f0,
} as const;

export const PHYSICS_CONFIG = {
  fixedTimeStep: 1 / 60,
  gravity: -9.81,
  playerMass: 70,
  capsuleRadius: 0.35,
  capsuleCylinderHeight: 1.0,
  coyoteMaxTime: 0.1,
  walkSpeed: 3.6,
  runSpeed: 6.8,
  groundAccel: 34.0,
  airAccel: 14.0,
  groundDamping: 12.0,
  airDamping: 1.8,
  stopVelocityThreshold: 0.15,
  jumpVelocity: 5,
  spawnPosition: [0, 0.9, 0] as const,
} as const;

export const VEHICLE_CONFIG = {
  spawnPosition: [-3.4, 0.52, 2.2] as const,
  spawnYaw: 0.35,
  mass: 210,
  boxSize: [0.76, 1.04, 2.0] as const,
  maxForwardSpeed: 24.0,
  maxReverseSpeed: 4.5,
  accel: 9.2,
  brakeDecel: 11.5,
  rollingDamping: 0.36,
  aeroDrag: 0.012,
  steerSpeed: 2.25,
  wheelRadius: 0.31,
  interactDistance: 4.2,
  wheelieMinSpeed: 2.8,
  wheelieSafeDeg: 40,
  wheelieCriticalDeg: 51,
  crashDeltaSpeed: 11.0,
} as const;

export const DOOR_CONFIG = {
  position: [3.2, 0, -2.5] as const,
  openingWidth: 1.4,
  openingHeight: 2.3,
  frameThickness: 0.16,
  frameDepth: 0.26,
  leafThickness: 0.1,
  interactDistance: 4.0,
} as const;

export interface CameraViewPreset {
  id: string;
  label: string;
  distance: number;
  pitch: number;
  shoulderOffsetX: number;
  targetHeight: number;
  fov: number;
}

export const CAMERA_VIEWS: CameraViewPreset[] = [
  {
    id: 'standard',
    label: 'Estándar',
    distance: 5.4,
    pitch: 0.32,
    shoulderOffsetX: 0,
    targetHeight: 1.35,
    fov: 58,
  },
  {
    id: 'tactical',
    label: 'Táctica',
    distance: 3.1,
    pitch: 0.2,
    shoulderOffsetX: 0.65,
    targetHeight: 1.48,
    fov: 54,
  },
  {
    id: 'wide',
    label: 'Panorámica',
    distance: 8.0,
    pitch: 0.48,
    shoulderOffsetX: 0,
    targetHeight: 1.5,
    fov: 62,
  },
];

export type CourseObstacle =
  | {
      id: string;
      shape: 'box';
      position: [number, number, number];
      size: [number, number, number];
      rotationEuler?: [number, number, number];
      variant: 'block' | 'platform' | 'ramp';
    }
  | {
      id: 'tall-cylinder';
      shape: 'cylinder';
      position: [number, number, number];
      radiusTop: number;
      radiusBottom: number;
      height: number;
      segments?: number;
      rotationEuler?: [number, number, number];
    };

// Escenario limpio con únicamente los 4 obstáculos de prueba solicitados
export const COURSE_OBSTACLES: CourseObstacle[] = [
  // 1. Cubo bajo para saltar
  {
    id: 'low-jump-cube',
    shape: 'box',
    position: [-2.6, 0.3, -4.0],
    size: [2.2, 0.6, 2.2],
    variant: 'block',
  },
  // 2. Rampa inclinada conectada al suelo (+Z) y a la plataforma elevada (-Z)
  {
    id: 'inclined-ramp',
    shape: 'box',
    position: [0, 0.526, -5.81],
    size: [2.8, 0.24, 5.4],
    rotationEuler: [0.24, 0, 0],
    variant: 'ramp',
  },
  // 3. Plataforma elevada
  {
    id: 'elevated-platform',
    shape: 'box',
    position: [0, 0.64, -10.2],
    size: [3.6, 1.28, 3.6],
    variant: 'platform',
  },
  // 4. Cilindro alto
  {
    id: 'tall-cylinder',
    shape: 'cylinder',
    position: [-5.5, 1.5, -6.5],
    radiusTop: 0.85,
    radiusBottom: 0.85,
    height: 3.0,
    segments: 24,
  },
];
