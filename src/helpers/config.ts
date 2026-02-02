import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ConfigFile,
  ConfigFileSchema,
  ProfileConfig,
  ProfileSecrets,
  SecretsFile,
  SecretsFileSchema,
} from '../types/schemas/config.schema.js';

// In normal usage we load .env from the current working directory.
// Tests should be deterministic and must not implicitly depend on a developer's
// local .env file, so the test suite can set QUICKBOOKS_DISABLE_DOTENV=1.
if (process.env.QUICKBOOKS_DISABLE_DOTENV !== '1') {
  dotenv.config();
}

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.config', 'quickbooks-mcp', 'config.json');
const DEFAULT_SECRETS_PATH = path.join(os.homedir(), '.config', 'quickbooks-mcp', 'secrets.json');
const DEFAULT_TOKEN_PATH = path.join(os.homedir(), '.config', 'quickbooks-mcp', 'tokens.json');

export interface ResolvedQuickbooksConfig {
  profileName?: string;
  profileSource: 'env' | 'config' | 'none';
  configPath: string;
  secretsPath: string;
  environment: 'sandbox' | 'production';
  realmId?: string;
  companyName?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  oauthPort: number;
  redirectUri: string;
  timeoutMs: number;
  tokenPath: string;
  idempotencyStoragePath?: string;
  logLevel?: string;
  allowProductionWrites: boolean;
}

let cachedConfig: ResolvedQuickbooksConfig | null = null;

function readJsonFileIfExists(filePath: string): unknown | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function expandHome(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function resolveProfileName(config: ConfigFile | null): {
  name?: string;
  source: 'env' | 'config' | 'none';
} {
  const envProfile = process.env.QUICKBOOKS_PROFILE?.trim();
  if (envProfile) {
    return { name: envProfile, source: 'env' };
  }
  const defaultProfile = config?.defaultProfile?.trim();
  if (defaultProfile) {
    return { name: defaultProfile, source: 'config' };
  }
  return { name: undefined, source: 'none' };
}

function getProfileConfig(
  profileName: string | undefined,
  config: ConfigFile | null
): ProfileConfig {
  if (!profileName) {
    return {};
  }
  const profiles = config?.profiles || {};
  const profile = profiles[profileName];
  if (!profile) {
    throw new Error(`Profile not found in config: ${profileName}`);
  }
  return profile;
}

function getProfileSecrets(
  profileName: string | undefined,
  secrets: SecretsFile | null
): ProfileSecrets {
  if (!profileName) {
    return {};
  }
  const profiles = secrets?.profiles || {};
  return profiles[profileName] || {};
}

function resolveTokenPath(profileName: string | undefined, profile: ProfileConfig): string {
  const envTokenPath = process.env.QUICKBOOKS_TOKEN_PATH;
  if (envTokenPath) {
    return expandHome(envTokenPath);
  }
  if (profile.tokenPath) {
    return expandHome(profile.tokenPath);
  }
  if (profileName) {
    return path.join(os.homedir(), '.config', 'quickbooks-mcp', 'tokens', `${profileName}.json`);
  }
  return DEFAULT_TOKEN_PATH;
}

function resolveConfigFiles(): { configPath: string; secretsPath: string } {
  const configPath = expandHome(process.env.QUICKBOOKS_CONFIG_PATH || DEFAULT_CONFIG_PATH);
  const secretsPath = expandHome(process.env.QUICKBOOKS_SECRETS_PATH || DEFAULT_SECRETS_PATH);
  return { configPath, secretsPath };
}

function loadConfigFile(configPath: string): ConfigFile | null {
  const raw = readJsonFileIfExists(configPath);
  if (!raw) {
    return null;
  }
  return ConfigFileSchema.parse(raw);
}

function loadSecretsFile(secretsPath: string): SecretsFile | null {
  const raw = readJsonFileIfExists(secretsPath);
  if (!raw) {
    return null;
  }
  return SecretsFileSchema.parse(raw);
}

export function loadQuickbooksConfig(): ResolvedQuickbooksConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const { configPath, secretsPath } = resolveConfigFiles();
  const configFile = loadConfigFile(configPath);
  const secretsFile = loadSecretsFile(secretsPath);

  const { name: profileName, source: profileSource } = resolveProfileName(configFile);
  const profileConfig = getProfileConfig(profileName, configFile);
  const profileSecrets = getProfileSecrets(profileName, secretsFile);

  const environment =
    (process.env.QUICKBOOKS_ENVIRONMENT as 'sandbox' | 'production' | undefined) ||
    profileConfig.environment ||
    'sandbox';

  const realmId = process.env.QUICKBOOKS_REALM_ID || profileConfig.realmId;
  const companyName = profileConfig.companyName;

  const clientId = process.env.QUICKBOOKS_CLIENT_ID || profileSecrets.clientId;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || profileSecrets.clientSecret;
  const refreshToken = process.env.QUICKBOOKS_REFRESH_TOKEN || profileSecrets.refreshToken;

  const oauthPort =
    parseNumber(process.env.QUICKBOOKS_OAUTH_PORT) || profileConfig.oauthPort || 8765;
  const timeoutMs =
    parseNumber(process.env.QUICKBOOKS_TIMEOUT_MS) || profileConfig.timeoutMs || 30000;
  const tokenPath = resolveTokenPath(profileName, profileConfig);
  const idempotencyStoragePath =
    process.env.IDEMPOTENCY_STORAGE_PATH || profileConfig.idempotencyStoragePath;
  const logLevel = process.env.LOG_LEVEL || profileConfig.logLevel;

  const allowProductionWrites =
    profileConfig.allowProductionWrites === true &&
    process.env.QUICKBOOKS_ALLOW_PRODUCTION_WRITES === '1';

  cachedConfig = {
    profileName,
    profileSource,
    configPath,
    secretsPath,
    environment,
    realmId,
    companyName,
    clientId,
    clientSecret,
    refreshToken,
    oauthPort,
    redirectUri: `http://localhost:${oauthPort}/callback`,
    timeoutMs,
    tokenPath,
    idempotencyStoragePath,
    logLevel,
    allowProductionWrites,
  };

  return cachedConfig;
}

export function getPublicConfig(config: ResolvedQuickbooksConfig): {
  profileName?: string;
  profileSource: 'env' | 'config' | 'none';
  environment: string;
  realmId?: string;
  companyName?: string;
  oauthPort: number;
  timeoutMs: number;
  tokenPath: string;
  idempotencyStoragePath?: string;
  logLevel?: string;
  allowProductionWrites: boolean;
  configPath: string;
  secretsPath: string;
} {
  return {
    profileName: config.profileName,
    profileSource: config.profileSource,
    environment: config.environment,
    realmId: config.realmId,
    companyName: config.companyName,
    oauthPort: config.oauthPort,
    timeoutMs: config.timeoutMs,
    tokenPath: config.tokenPath,
    idempotencyStoragePath: config.idempotencyStoragePath,
    logLevel: config.logLevel,
    allowProductionWrites: config.allowProductionWrites,
    configPath: config.configPath,
    secretsPath: config.secretsPath,
  };
}

export function resetQuickbooksConfigCache(): void {
  cachedConfig = null;
}
