import { loadQuickbooksConfig } from './config.js';

export type WriteOperation = 'create' | 'delete';

export interface WriteGuardResult {
  allowed: boolean;
  reason?: string;
  environment: 'sandbox' | 'production';
  profileName?: string;
  operation: WriteOperation;
}

export function checkWriteGuard(operation: WriteOperation): WriteGuardResult {
  const config = loadQuickbooksConfig();
  if (config.environment === 'production') {
    if (operation === 'create' && !config.allowProductionCreates) {
      return {
        allowed: false,
        reason:
          'Create/update/upload operations are blocked in production. Set allowProductionCreates=true in the profile to proceed.',
        environment: config.environment,
        profileName: config.profileName,
        operation,
      };
    }
    if (operation === 'delete' && !config.allowProductionDeletes) {
      return {
        allowed: false,
        reason:
          'Delete operations are blocked in production. Set allowProductionDeletes=true in the profile to proceed.',
        environment: config.environment,
        profileName: config.profileName,
        operation,
      };
    }
  }

  return {
    allowed: true,
    environment: config.environment,
    profileName: config.profileName,
    operation,
  };
}
