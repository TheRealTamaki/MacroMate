// Backup: JSON export to a file, and import with validation + migration.

import * as store from './store.js';
import { keyOf } from './dates.js';

export function downloadBackup() {
  const bundle = store.exportBundle();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `macromate-backup-${keyOf(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return store.bundleSummary(bundle);
}

/** Reads a File, validates it, and returns a bundle already migrated to the current schema. */
export async function readBackupFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!parsed || parsed.app !== 'macromate' || !parsed.data) {
    throw new Error('That does not look like a MacroMate backup.');
  }
  const version = Number(parsed.schemaVersion);
  if (!Number.isFinite(version)) throw new Error('The backup is missing its schema version.');
  if (version > store.SCHEMA_VERSION) {
    throw new Error(`This backup came from a newer version of MacroMate (schema v${version}). Update the app first.`);
  }

  const data = version < store.SCHEMA_VERSION ? store.migrateBundle(parsed.data, version) : parsed.data;
  const bundle = { ...parsed, schemaVersion: store.SCHEMA_VERSION, data };
  return { bundle, summary: store.bundleSummary(bundle) };
}

export function applyBackup(bundle) {
  store.replaceAll(bundle.data);
}

/** Opens the OS file picker and resolves with the chosen File (or null). */
export function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      resolve(file || null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
