import type { LevelDef } from '../tilemap';
import { ERA0_LEVEL } from './era0';
import { ERA1_LEVEL } from './era1';

/** The game's levels in order: one per era. Index = era number. */
export const ERA_LEVELS: readonly LevelDef[] = [ERA0_LEVEL, ERA1_LEVEL];
