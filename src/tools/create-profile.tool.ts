import { z } from 'zod';
import {
  loadConfigFile,
  loadSecretsFile,
  resolveConfigFiles,
  resetQuickbooksConfigCache,
  writeConfigFile,
  writeSecretsFile,
} from '../helpers/config.js';
import { logToolRequest, logToolResponse, logger } from '../helpers/logger.js';
import { ProfileConfigSchema } from '../types/schemas/config.schema.js';
import { ToolDefinition } from '../types/tool-definition.js';

const toolName = 'create_profile';
const toolDescription =
  'Create or update a QuickBooks profile in config.json. ' +
  'OAuth credentials should be added separately to secrets.json.';

const toolSchema = z.object({
  profileName: z.string().min(1),
  baseProfile: z
    .string()
    .min(1)
    .optional()
    .describe('Optional profile to copy config + client credentials from.'),
  config: ProfileConfigSchema.partial().optional(),
  setDefault: z.boolean().optional(),
  overwrite: z.boolean().optional().describe('Replace existing profile data instead of merging.'),
});

type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  const typedArgs = args as ToolInput;
  logToolRequest(toolName, { profileName: typedArgs.profileName });

  try {
    const { configPath, secretsPath } = resolveConfigFiles();
    const configFile = loadConfigFile(configPath) || {};
    const secretsFile = loadSecretsFile(secretsPath) || {};

    const profiles = configFile.profiles || {};
    const secretsProfiles = secretsFile.profiles || {};

    const name = typedArgs.profileName.trim();
    const baseProfile = typedArgs.baseProfile?.trim();
    const overwrite = typedArgs.overwrite === true;
    const configInput = typedArgs.config || {};

    if (baseProfile && baseProfile === name) {
      throw new Error('baseProfile must be different from profileName.');
    }

    if (baseProfile && profiles[name] && !overwrite) {
      throw new Error(
        `Profile "${name}" already exists. Set overwrite=true or omit baseProfile to merge.`
      );
    }

    let baseConfig = {};
    if (baseProfile) {
      const sourceConfig = profiles[baseProfile];
      if (!sourceConfig) {
        throw new Error(`Base profile not found: ${baseProfile}`);
      }
      baseConfig = sourceConfig;
    }

    const existingConfig = profiles[name] || {};
    const nextConfig = baseProfile
      ? { ...baseConfig, ...configInput }
      : overwrite
        ? { ...configInput }
        : { ...existingConfig, ...configInput };

    profiles[name] = nextConfig;
    configFile.profiles = profiles;
    if (typedArgs.setDefault === true) {
      configFile.defaultProfile = name;
    }

    writeConfigFile(configPath, configFile);
    let copiedSecrets = false;
    if (baseProfile) {
      const baseSecrets = secretsProfiles[baseProfile];
      if (!baseSecrets?.clientId || !baseSecrets?.clientSecret) {
        throw new Error(
          `Base profile "${baseProfile}" is missing clientId/clientSecret in secrets.json.`
        );
      }

      secretsProfiles[name] = {
        clientId: baseSecrets.clientId,
        clientSecret: baseSecrets.clientSecret,
      };
      secretsFile.profiles = secretsProfiles;
      writeSecretsFile(secretsPath, secretsFile);
      copiedSecrets = true;
    }

    resetQuickbooksConfigCache();

    logToolResponse(toolName, true, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            profileName: name,
            baseProfile: baseProfile || null,
            configPath,
            secretsPath,
            defaultProfile: configFile.defaultProfile,
            copiedSecrets,
            note: baseProfile
              ? 'Profile saved. Client credentials copied (refresh token not copied). Re-authenticate to generate tokens.'
              : 'Profile saved. Add clientId/clientSecret/refreshToken to secrets.json if needed. Changes take effect on next server start.',
          }),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to create profile', error);
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

export const CreateProfileTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
