import { FEATURE_IDS, FEATURES, type Era, type FeatureId } from './features';

/**
 * The post-game Feature Menu (PRD §6): every feature you've collected, by era, each one
 * switchable. An era's heading switches its whole group, so "the last level in Era 0
 * graphics" is a few presses.
 */
export type FeatureRow = { kind: 'era'; era: Era } | { kind: 'feature'; id: FeatureId };

export function featureRows(owned: ReadonlySet<FeatureId>): FeatureRow[] {
  const rows: FeatureRow[] = [];
  let era: Era | null = null;
  for (const id of FEATURE_IDS) {
    if (!owned.has(id)) continue;
    if (FEATURES[id].era !== era) {
      era = FEATURES[id].era;
      rows.push({ kind: 'era', era });
    }
    rows.push({ kind: 'feature', id });
  }
  return rows;
}

export function eraFeatures(owned: ReadonlySet<FeatureId>, era: Era): FeatureId[] {
  return FEATURE_IDS.filter((id) => owned.has(id) && FEATURES[id].era === era);
}

/**
 * What selecting a row switches: a feature flips; an era heading turns its whole group off
 * if any of it is on, otherwise all on.
 */
export function toggleRow(
  row: FeatureRow,
  owned: ReadonlySet<FeatureId>,
  isOn: (id: FeatureId) => boolean,
): { id: FeatureId; on: boolean }[] {
  if (row.kind === 'feature') return [{ id: row.id, on: !isOn(row.id) }];
  const group = eraFeatures(owned, row.era);
  const on = !group.some(isOn);
  return group.map((id) => ({ id, on }));
}

/** H:MM:SS (or M:SS under an hour). */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
