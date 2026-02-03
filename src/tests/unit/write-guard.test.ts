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

  it('allows non-production operations by default', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbo-guard-'));
    const configPath = path.join(tmpDir, 'config.json');

    writeJson(configPath, {
      defaultProfile: 'sandbox-main',
      profiles: {
        'sandbox-main': {
          environment: 'sandbox',
        },
      },
    });

    process.env.QUICKBOOKS_CONFIG_PATH = configPath;
    process.env.QUICKBOOKS_PROFILE = 'sandbox-main';
    delete process.env.QUICKBOOKS_ENVIRONMENT;

    const createGuard = checkWriteGuard('create');
    const deleteGuard = checkWriteGuard('delete');
    assert.equal(createGuard.allowed, true);
    assert.equal(deleteGuard.allowed, true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('blocks production creates without allow flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbo-guard-'));
    const configPath = path.join(tmpDir, 'config.json');

    writeJson(configPath, {
      defaultProfile: 'production-main',
      profiles: {
        'production-main': {
          environment: 'production',
          allowProductionCreates: true,
        },
      },
    });

    process.env.QUICKBOOKS_CONFIG_PATH = configPath;
    process.env.QUICKBOOKS_PROFILE = 'production-main';
    delete process.env.QUICKBOOKS_ENVIRONMENT;

    const guard = checkWriteGuard('create');
    assert.equal(guard.allowed, false);
    assert.equal(guard.environment, 'production');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('allows production creates with profile flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbo-guard-'));
    const configPath = path.join(tmpDir, 'config.json');

    writeJson(configPath, {
      defaultProfile: 'production-main',
      profiles: {
        'production-main': {
          environment: 'production',
          allowProductionCreates: true,
        },
      },
    });

    process.env.QUICKBOOKS_CONFIG_PATH = configPath;
    process.env.QUICKBOOKS_PROFILE = 'production-main';
    delete process.env.QUICKBOOKS_ENVIRONMENT;
    const guard = checkWriteGuard('create');
    assert.equal(guard.allowed, true);
    assert.equal(guard.environment, 'production');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('blocks production deletes without allow flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbo-guard-'));
    const configPath = path.join(tmpDir, 'config.json');

    writeJson(configPath, {
      defaultProfile: 'production-main',
      profiles: {
        'production-main': {
          environment: 'production',
          allowProductionDeletes: true,
        },
      },
    });

    process.env.QUICKBOOKS_CONFIG_PATH = configPath;
    process.env.QUICKBOOKS_PROFILE = 'production-main';
    delete process.env.QUICKBOOKS_ENVIRONMENT;

    const guard = checkWriteGuard('delete');
    assert.equal(guard.allowed, false);
    assert.equal(guard.environment, 'production');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('allows production deletes with profile flag', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbo-guard-'));
    const configPath = path.join(tmpDir, 'config.json');

    writeJson(configPath, {
      defaultProfile: 'production-main',
      profiles: {
        'production-main': {
          environment: 'production',
          allowProductionDeletes: true,
        },
      },
    });

    process.env.QUICKBOOKS_CONFIG_PATH = configPath;
    process.env.QUICKBOOKS_PROFILE = 'production-main';
    delete process.env.QUICKBOOKS_ENVIRONMENT;
    const guard = checkWriteGuard('delete');
    assert.equal(guard.allowed, true);
    assert.equal(guard.environment, 'production');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Legacy allowProductionWrites support removed.
});
