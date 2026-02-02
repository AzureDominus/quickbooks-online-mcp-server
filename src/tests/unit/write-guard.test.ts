import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkWriteGuard } from '../../helpers/write-guard.js';
import { resetQuickbooksConfigCache } from '../../helpers/config.js';

const ORIGINAL_ENV = { ...process.env };

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('write guard', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetQuickbooksConfigCache();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetQuickbooksConfigCache();
  });

  it('blocks production writes without explicit allow flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbo-guard-'));
    const configPath = path.join(tmpDir, 'config.json');

    writeJson(configPath, {
      defaultProfile: 'production-main',
      profiles: {
        'production-main': {
          environment: 'production',
          allowProductionWrites: true,
        },
      },
    });

    process.env.QUICKBOOKS_CONFIG_PATH = configPath;

    const guard = checkWriteGuard();
    assert.equal(guard.allowed, false);
    assert.equal(guard.environment, 'production');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('allows production writes only with profile and env flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbo-guard-'));
    const configPath = path.join(tmpDir, 'config.json');

    writeJson(configPath, {
      defaultProfile: 'production-main',
      profiles: {
        'production-main': {
          environment: 'production',
          allowProductionWrites: true,
        },
      },
    });

    process.env.QUICKBOOKS_CONFIG_PATH = configPath;
    process.env.QUICKBOOKS_ALLOW_PRODUCTION_WRITES = '1';

    const guard = checkWriteGuard();
    assert.equal(guard.allowed, true);
    assert.equal(guard.environment, 'production');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
