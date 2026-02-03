import { z } from 'zod';
import { loadConfigFile, loadSecretsFile, resolveConfigFiles } from '../helpers/config.js';
import { logToolRequest, logToolResponse, logger } from '../helpers/logger.js';
import { ToolDefinition } from '../types/tool-definition.js';

const toolName = 'list_profiles';
const toolDescription =
  'List available QuickBooks profiles from config/secrets files, including the default profile.';

const toolSchema = z.object({});

const toolHandler = async (_args: Record<string, unknown>) => {
  const startTime = Date.now();
  logToolRequest(toolName, {});

  try {
    const { configPath, secretsPath } = resolveConfigFiles();
    const config = loadConfigFile(configPath) || {};
    const secrets = loadSecretsFile(secretsPath) || {};

    const configProfiles = config.profiles || {};
    const secretProfiles = secrets.profiles || {};
    const profileNames = Array.from(
      new Set([...Object.keys(configProfiles), ...Object.keys(secretProfiles)])
    ).sort();

    const profiles: Record<string, unknown> = {};
    for (const name of profileNames) {
      const configProfile = configProfiles[name] || {};
      const secretProfile = secretProfiles[name] || {};

      const hasClientId = Boolean(secretProfile.clientId);
      const hasClientSecret = Boolean(secretProfile.clientSecret);
      const hasRefreshToken = Boolean(secretProfile.refreshToken);

      let secretsLocation: 'secrets' | 'none' = 'none';
      const inSecrets = hasClientId || hasClientSecret || hasRefreshToken;
      if (inSecrets) secretsLocation = 'secrets';

      profiles[name] = {
        config: {
          environment: configProfile.environment,
          realmId: configProfile.realmId,
          companyName: configProfile.companyName,
          oauthPort: configProfile.oauthPort,
          redirectUri: configProfile.redirectUri,
          tokenPath: configProfile.tokenPath,
          idempotencyStoragePath: configProfile.idempotencyStoragePath,
          timeoutMs: configProfile.timeoutMs,
          logLevel: configProfile.logLevel,
          allowProductionCreates: configProfile.allowProductionCreates,
          allowProductionDeletes: configProfile.allowProductionDeletes,
        },
        secrets: {
          hasClientId,
          hasClientSecret,
          hasRefreshToken,
          location: secretsLocation,
        },
      };
    }

    logToolResponse(toolName, true, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            defaultProfile: config.defaultProfile,
            envProfile: process.env.QUICKBOOKS_PROFILE || null,
            configPath,
            secretsPath,
            profiles,
          }),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to list profiles', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            isError: true,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
    };
  }
};

export const ListProfilesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
