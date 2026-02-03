/**
 * Global test setup
 *
 * This module is preloaded via `node --import` (see package.json scripts).
 * It hardens the test suite so it does not depend on:
 * - a developer's real ~/.config/quickbooks-mcp
 * - a developer's local .env file
 * - any host machine OAuth credentials or tokens
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Ensure dotenv never reads a developer's local .env during tests.
// ---------------------------------------------------------------------------
process.env.QUICKBOOKS_DISABLE_DOTENV = '1';

// ---------------------------------------------------------------------------
// Force the test suite into a known-safe sandbox configuration.
// ---------------------------------------------------------------------------
process.env.QUICKBOOKS_PROFILE = process.env.QUICKBOOKS_PROFILE || 'test-sandbox';
process.env.QUICKBOOKS_ENVIRONMENT = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';

// Default: never allow production writes during tests.
// (Our write guard requires BOTH config flag + env flag. Keep env flag off.)

// ---------------------------------------------------------------------------
// Prevent tests from reading/writing real user config or tokens.
// ---------------------------------------------------------------------------
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qbo-mcp-tests-'));

const fakeHome = path.join(tmpRoot, 'home');
const fakeXdgConfig = path.join(tmpRoot, 'xdg-config');
const fakeXdgCache = path.join(tmpRoot, 'xdg-cache');

fs.mkdirSync(fakeHome, { recursive: true });
fs.mkdirSync(fakeXdgConfig, { recursive: true });
fs.mkdirSync(fakeXdgCache, { recursive: true });

process.env.HOME = fakeHome;
process.env.XDG_CONFIG_HOME = fakeXdgConfig;
process.env.XDG_CACHE_HOME = fakeXdgCache;

// ---------------------------------------------------------------------------
// Point config/secrets to repo-local fixtures.
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// src/tests -> repoRoot
const repoRoot = path.resolve(__dirname, '../..');
const fixturesDir = path.join(repoRoot, 'src', 'tests', 'fixtures');

process.env.QUICKBOOKS_CONFIG_PATH =
  process.env.QUICKBOOKS_CONFIG_PATH || path.join(fixturesDir, 'config.json');
process.env.QUICKBOOKS_SECRETS_PATH =
  process.env.QUICKBOOKS_SECRETS_PATH || path.join(fixturesDir, 'secrets.json');

// Ensure integration tests don't accidentally run using developer env vars.
// (Integration tests check *env vars*, not config files.)
for (const key of [
  'QUICKBOOKS_CLIENT_ID',
  'QUICKBOOKS_CLIENT_SECRET',
  'QUICKBOOKS_REFRESH_TOKEN',
  'QUICKBOOKS_REALM_ID',
]) {
  if (process.env[key]) {
    delete process.env[key];
  }
}
