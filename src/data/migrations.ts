/**
 * Schema migrations for persisted state.
 *
 * Pure and dependency-free on purpose, so it can be unit-tested on Windows
 * alongside the domain layer. Migrations are the one piece of storage code
 * where a bug is unrecoverable — it runs against real data that has no backup
 * yet — so it is the piece that most needs tests.
 *
 * Rules:
 *  - Never delete a migration. Someone's phone may still hold version 1.
 *  - Each step upgrades exactly one version and is independently testable.
 *  - Unknown/newer versions are left alone rather than mangled.
 */

/** Bump this whenever the persisted shape changes, and add a step below. */
export const CURRENT_SCHEMA_VERSION = 1;

/** Deliberately loose: persisted data is whatever an older build wrote. */
export interface PersistedShape {
  subscriptions?: unknown[];
  settings?: Record<string, unknown>;
  rates?: unknown;
  [key: string]: unknown;
}

type MigrationStep = (state: PersistedShape) => PersistedShape;

/**
 * `STEPS[n]` upgrades version n to version n+1.
 *
 * Empty today because version 1 is the first shipped schema. The machinery
 * exists now so that the first real schema change is a five-line addition
 * rather than a risky retrofit against data already on the phone.
 */
const STEPS: Record<number, MigrationStep> = {};

export function migrateState(
  persisted: PersistedShape | undefined,
  fromVersion: number,
): PersistedShape {
  if (!persisted || typeof persisted !== 'object') {
    return { subscriptions: [], settings: {} };
  }

  // Newer than we understand: a downgrade. Returning it untouched is safer
  // than guessing at a reverse migration and corrupting real data.
  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    return persisted;
  }

  let state = persisted;
  for (let version = fromVersion; version < CURRENT_SCHEMA_VERSION; version += 1) {
    const step = STEPS[version];
    if (step) {
      state = step(state);
    }
  }
  return state;
}
