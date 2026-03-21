/**
 * Shared claims.json loader with schema migration
 *
 * All consumers that read claims.json should use this helper to ensure
 * the data is migrated to the current schema version before processing.
 *
 * Zero npm dependencies.
 */

import fs from "fs";
import path from "path";
import { checkAndMigrateSchema } from "../compiler/wheat-compiler.js";

/**
 * Load and migrate claims.json from a directory.
 *
 * @param {string} dir - Directory containing claims.json
 * @param {object} [opts] - Options
 * @param {string} [opts.filename='claims.json'] - Claims filename override
 * @returns {{ data: object|null, errors: Array<{code: string, message: string}>, path: string }}
 *   - data: the full claims object (with schema_version, meta, claims) or null if file missing/invalid
 *   - errors: migration errors (empty array on success)
 *   - path: resolved file path
 */
export function loadClaims(dir, opts = {}) {
  const filename = opts.filename || "claims.json";
  const claimsPath = path.join(dir, filename);

  if (!fs.existsSync(claimsPath)) {
    return { data: null, errors: [], path: claimsPath };
  }

  let raw;
  try {
    raw = fs.readFileSync(claimsPath, "utf8");
  } catch (err) {
    return {
      data: null,
      errors: [
        {
          code: "E_READ",
          message: `Failed to read ${filename}: ${err.message}`,
        },
      ],
      path: claimsPath,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      data: null,
      errors: [
        {
          code: "E_PARSE",
          message: `${filename} is not valid JSON: ${err.message}`,
        },
      ],
      path: claimsPath,
    };
  }

  // Run schema migration
  const result = checkAndMigrateSchema(parsed);

  // Write migrated data back to disk so downstream tools that read the file
  // directly (bypassing loadClaims) see the current schema version.
  // Only write if migration actually changed something (avoid unnecessary I/O).
  if (result.errors.length === 0 && result.data) {
    const migrated = JSON.stringify(result.data, null, 2);
    if (migrated !== raw) {
      try {
        fs.writeFileSync(claimsPath, migrated + "\n", "utf8");
      } catch (err) {
        // Non-fatal: migration write-back failure should not block reads.
        // The in-memory data is still correct.
      }
    }
  }

  return {
    data: result.errors.length > 0 ? null : result.data,
    errors: result.errors,
    path: claimsPath,
  };
}
