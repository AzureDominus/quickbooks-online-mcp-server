import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  loadConfigFile,
  loadSecretsFile,
  resolveConfigFiles,
  resetQuickbooksConfigCache,
  writeConfigFile,
} from '../helpers/config.js';
import { logToolRequest, logToolResponse, logger } from '../helpers/logger.js';
import { ToolDefinition } from '../types/tool-definition.js';

const toolName = 'set_profile';
const toolDescription =
  'Set the active QuickBooks profile for future runs by updating defaultProfile and/or .env.';

const toolSchema = z.object({
  profileName: z.string().min(1),
  setDefault: z.boolean().optional().describe('Update config.json defaultProfile.'),
  writeEnv: z.boolean().optional().describe('Update QUICKBOOKS_PROFILE in .env.'),
  envPath: z
    .string()
    .min(1)
    .optional()
    .describe('Path to .env file (defaults to current working directory).'),
});

type ToolInput = z.infer<typeof toolSchema>;

function upsertEnvVar(content: string, key: string, value: string): string {
  const lines = content.split(/\r?\n/);
  let found = false;
  const nextLines = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    nextLines.push(`${key}=${value}`);
  }
  return nextLines.join('\n').replace(/\n?$/, '\n');
}

const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  const typedArgs = args as ToolInput;
  const name = typedArgs.profileName.trim();

  logToolRequest(toolName, { profileName: name });

  try {
    const { configPath, secretsPath } = resolveConfigFiles();
    const configFile = loadConfigFile(configPath) || {};
    const secretsFile = loadSecretsFile(secretsPath) || {};

    const configProfiles = configFile.profiles || {};
    const secretsProfiles = secretsFile.profiles || {};
    const exists = Boolean(configProfiles[name] || secretsProfiles[name]);
    if (!exists) {
      throw new Error(`Profile not found: ${name}`);
    }

    const setDefault = typedArgs.setDefault !== false;
    const writeEnv = typedArgs.writeEnv !== false;

    if (setDefault) {
      configFile.defaultProfile = name;
      writeConfigFile(configPath, configFile);
    }

    let envPath: string | undefined;
    if (writeEnv) {
      envPath = typedArgs.envPath || path.join(process.cwd(), '.env');
      const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
      const updated = upsertEnvVar(existing, 'QUICKBOOKS_PROFILE', name);
      fs.writeFileSync(envPath, updated, { mode: 0o600 });
    }

    resetQuickbooksConfigCache();

    logToolResponse(toolName, true, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            profileName: name,
            setDefault,
            writeEnv,
            envPath: envPath || null,
            configPath,
            note: 'Changes take effect on next server start.',
          }),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to set profile', error);
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

export const SetProfileTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
