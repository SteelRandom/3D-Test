import {
  COURSE_OBSTACLES,
  CourseObstacle,
  DOOR_CONFIG,
  PHYSICS_CONFIG,
  SCENE_COLORS,
} from '../scene/courseConfig';

export interface LevelJSON {
  version: number;
  name: string;
  skyColor: string;
  ground: {
    size: number;
    color: number;
  };
  spawn: readonly [number, number, number];
  door: {
    position: readonly [number, number, number];
    openingWidth: number;
    openingHeight: number;
    frameThickness: number;
    frameDepth: number;
    leafThickness: number;
  };
  obstacles: CourseObstacle[];
  // Gancho futuro para enemigos, triggers y coleccionables
  entities?: Array<{
    type: string;
    position: [number, number, number];
  }>;
}

export const DEFAULT_LEVEL_JSON: LevelJSON = {
  version: 1,
  name: 'Pista de Pruebas Núcleo 3D',
  skyColor: SCENE_COLORS.skyCss,
  ground: {
    size: 160,
    color: SCENE_COLORS.groundHex,
  },
  spawn: PHYSICS_CONFIG.spawnPosition,
  door: {
    position: DOOR_CONFIG.position,
    openingWidth: DOOR_CONFIG.openingWidth,
    openingHeight: DOOR_CONFIG.openingHeight,
    frameThickness: DOOR_CONFIG.frameThickness,
    frameDepth: DOOR_CONFIG.frameDepth,
    leafThickness: DOOR_CONFIG.leafThickness,
  },
  obstacles: COURSE_OBSTACLES,
  entities: [],
};
