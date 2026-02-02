import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadQuickbooksConfig, resetQuickbooksConfigCache } from '../../helpers/config.js';

const ORIGINAL_ENV = { ...process.env };

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

describe('config loader', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetQuickbooksConfigCache();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetQuickbooksConfigCache();
  });

  it('resolves profile config with secrets and env overrides', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbo-config-'));
    const configPath = path.join(tmpDir, 'config.json');
    const secretsPath = path.join(tmpDir, 'secrets.json');

    writeJson(configPath, {
      defaultProfile: 'sandbox-test',
      profiles: {
        'sandbox-test': {
          environment: 'sandbox',
          realmId: '1111111111',
        },
      },
    });

    writeJson(secretsPath, {
      profiles: {
        'sandbox-test': {
          clientId: 'profile-client-id',
          clientSecret: 'profile-client-secret',
          refreshToken: 'profile-refresh-token',
        },
      },
    });

    process.env.QUICKBOOKS_CONFIG_PATH = configPath;
    process.env.QUICKBOOKS_SECRETS_PATH = secretsPath;
    process.env.QUICKBOOKS_PROFILE = 'sandbox-test';
    process.env.QUICKBOOKS_CLIENT_ID = 'env-client-id';

    const config = loadQuickbooksConfig();

    assert.equal(config.profileName, 'sandbox-test');
    assert.equal(config.environment, 'sandbox');
    assert.equal(config.realmId, '1111111111');
    assert.equal(config.clientId, 'env-client-id');
    assert.equal(config.clientSecret, 'profile-client-secret');
    assert.equal(config.refreshToken, 'profile-refresh-token');
    assert.ok(config.tokenPath.includes('sandbox-test.json'));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
