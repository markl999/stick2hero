import type { LevelDef } from '../tilemap';
import { ERA0_LEVEL } from './era0';
import { ERA1_LEVEL } from './era1';
import { ERA2_LEVEL } from './era2';
import { ERA3_LEVEL } from './era3';
import { ERA4_LEVEL } from './era4';
import { ERA5_LEVEL } from './era5';

/** The game's levels in order: one per era. Index = era number. */
export const ERA_LEVELS: readonly LevelDef[] = [
  ERA0_LEVEL,
  ERA1_LEVEL,
  ERA2_LEVEL,
  ERA3_LEVEL,
  ERA4_LEVEL,
  ERA5_LEVEL,
];
