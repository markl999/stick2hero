import type { LevelDef } from '../tilemap';
import { ERA0_LEVEL } from './era0';
import { ERA1_LEVEL } from './era1';
import { ERA2_LEVEL } from './era2';

/** The game's levels in order: one per era. Index = era number. */
export const ERA_LEVELS: readonly LevelDef[] = [ERA0_LEVEL, ERA1_LEVEL, ERA2_LEVEL];
