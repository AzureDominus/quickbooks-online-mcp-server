import { loadQuickbooksConfig } from './config.js';

export interface WriteGuardResult {
  allowed: boolean;
  reason?: string;
  environment: 'sandbox' | 'production';
  profileName?: string;
}

export function checkWriteGuard(): WriteGuardResult {
  const config = loadQuickbooksConfig();
  if (config.environment === 'production' && !config.allowProductionWrites) {
    return {
      allowed: false,
      reason:
        'Writes are blocked in production. Set allowProductionWrites=true in the profile and QUICKBOOKS_ALLOW_PRODUCTION_WRITES=1 to proceed.',
      environment: config.environment,
      profileName: config.profileName,
    };
  }

  return {
    allowed: true,
    environment: config.environment,
    profileName: config.profileName,
  };
}
