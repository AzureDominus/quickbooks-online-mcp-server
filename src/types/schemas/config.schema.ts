import { z } from 'zod';

export const ProfileConfigSchema = z
  .object({
    environment: z.enum(['sandbox', 'production']).optional(),
    realmId: z.string().min(1).optional(),
    companyName: z.string().min(1).optional(),
    redirectUri: z.string().min(1).optional(),
    oauthPort: z.number().int().positive().optional(),
    tokenPath: z.string().min(1).optional(),
    idempotencyStoragePath: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
    logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),
    allowProductionCreates: z.boolean().optional(),
    allowProductionDeletes: z.boolean().optional(),
  })
  .strict();

export const ConfigFileSchema = z
  .object({
    defaultProfile: z.string().min(1).optional(),
    profiles: z.record(ProfileConfigSchema).optional(),
  })
  .strict();

export const ProfileSecretsSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    clientSecret: z.string().min(1).optional(),
    refreshToken: z.string().min(1).optional(),
  })
  .strict();

export const SecretsFileSchema = z
  .object({
    profiles: z.record(ProfileSecretsSchema).optional(),
  })
  .strict();

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;
export type ConfigFile = z.infer<typeof ConfigFileSchema>;
export type ProfileSecrets = z.infer<typeof ProfileSecretsSchema>;
export type SecretsFile = z.infer<typeof SecretsFileSchema>;
