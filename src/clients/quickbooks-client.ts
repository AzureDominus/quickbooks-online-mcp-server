import crypto from 'crypto';
import dotenv from 'dotenv';
import QuickBooks from 'node-quickbooks';
import OAuthClient from 'intuit-oauth';
import http from 'http';
import fs from 'fs';
import path from 'path';
import open from 'open';
import os from 'os';
import { logger } from '../helpers/logger.js';
import { withRetry, withCallbackRetry, RetryOptions } from '../helpers/retry.js';
import { encrypt, decrypt, isEncrypted } from '../helpers/encryption.js';
import { qboCircuitBreaker } from '../helpers/circuit-breaker.js';

dotenv.config();

const client_id = process.env.QUICKBOOKS_CLIENT_ID;
const client_secret = process.env.QUICKBOOKS_CLIENT_SECRET;
const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox';
const oauth_port = parseInt(process.env.QUICKBOOKS_OAUTH_PORT || '8765', 10);
const redirect_uri = `http://localhost:${oauth_port}/callback`;

// Request timeout configuration
const QUICKBOOKS_TIMEOUT_MS = parseInt(process.env.QUICKBOOKS_TIMEOUT_MS || '30000', 10);

// Token storage path - configurable via env var, defaults to ~/.config/quickbooks-mcp/tokens.json
const TOKEN_STORAGE_PATH =
  process.env.QUICKBOOKS_TOKEN_PATH ||
  path.join(os.homedir(), '.config', 'quickbooks-mcp', 'tokens.json');

interface StoredTokens {
  refresh_token: string;
  realm_id: string;
  environment: string;
}

function loadStoredTokens(): StoredTokens | null {
  try {
    if (fs.existsSync(TOKEN_STORAGE_PATH)) {
      const fileContent = fs.readFileSync(TOKEN_STORAGE_PATH, 'utf-8');
      let data: StoredTokens;

      // Check if the file contains encrypted data
      if (isEncrypted(fileContent)) {
        // Decrypt the entire token file
        const decrypted = decrypt(fileContent);
        data = JSON.parse(decrypted);
      } else {
        // Legacy plaintext format - parse and migrate to encrypted
        data = JSON.parse(fileContent);
        // Re-save with encryption (migration)
        if (data.refresh_token && data.realm_id) {
          logger.info('Migrating plaintext tokens to encrypted format');
          saveTokens(data);
        }
      }

      // Only use stored tokens if environment matches
      if (data.environment === environment) {
        return data;
      }
    }
  } catch (e) {
    // Ignore errors, will trigger new OAuth flow
    logger.warn('Failed to load stored tokens', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return null;
}

function saveTokens(tokens: StoredTokens): void {
  try {
    const tokenDir = path.dirname(TOKEN_STORAGE_PATH);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
    // Encrypt the token data before writing to disk
    const encrypted = encrypt(JSON.stringify(tokens));
    fs.writeFileSync(TOKEN_STORAGE_PATH, encrypted, { mode: 0o600 });
  } catch (e) {
    logger.error('Failed to save tokens', e instanceof Error ? e : new Error(String(e)));
  }
}

// Load stored tokens, fall back to env vars
const storedTokens = loadStoredTokens();
const refresh_token = storedTokens?.refresh_token || process.env.QUICKBOOKS_REFRESH_TOKEN;
const realm_id = storedTokens?.realm_id || process.env.QUICKBOOKS_REALM_ID;

// Only throw error if client_id or client_secret is missing
if (!client_id || !client_secret || !redirect_uri) {
  throw Error('Client ID, Client Secret and Redirect URI must be set in environment variables');
}

class QuickbooksClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private refreshToken?: string;
  private realmId?: string;
  private readonly environment: string;
  private accessToken?: string;
  private accessTokenExpiry?: Date;
  private quickbooksInstance?: QuickBooks;
  private oauthClient: OAuthClient;
  private isAuthenticating: boolean = false;
  private redirectUri: string;
  private oauthState: string | null = null;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    refreshToken?: string;
    realmId?: string;
    environment: string;
    redirectUri: string;
  }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.refreshToken = config.refreshToken;
    this.realmId = config.realmId;
    this.environment = config.environment;
    this.redirectUri = config.redirectUri;
    this.oauthClient = new OAuthClient({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      environment: this.environment,
      redirectUri: this.redirectUri,
    });
  }

  private async startOAuthFlow(): Promise<void> {
    if (this.isAuthenticating) {
      return;
    }

    this.isAuthenticating = true;
    const port = oauth_port;

    return new Promise((resolve, reject) => {
      // Create temporary server for OAuth callback
      const server = http.createServer(async (req, res) => {
        if (req.url?.startsWith('/callback')) {
          // Validate state parameter to prevent CSRF attacks
          const url = new URL(req.url, `http://localhost:${port}`);
          const returnedState = url.searchParams.get('state');
          if (returnedState !== this.oauthState) {
            logger.error('OAuth state mismatch - possible CSRF attack', { returnedState });
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  font-family: Arial, sans-serif;
                  background-color: #fff0f0;
                ">
                  <h2 style="color: #d32f2f;">Invalid state parameter</h2>
                  <p>OAuth flow rejected due to potential CSRF attack.</p>
                </body>
              </html>
            `);
            server.close();
            this.isAuthenticating = false;
            this.oauthState = null;
            reject(new Error('OAuth state mismatch - possible CSRF attack'));
            return;
          }
          // Clear state after validation
          this.oauthState = null;

          try {
            const response = await this.oauthClient.createToken(req.url);
            const tokens = response.token;

            // Save tokens
            this.refreshToken = tokens.refresh_token;
            this.realmId = tokens.realmId;
            this.saveTokensToEnv();

            // Send success response
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  font-family: Arial, sans-serif;
                  background-color: #f5f5f5;
                ">
                  <h2 style="color: #2E8B57;">✓ Successfully connected to QuickBooks!</h2>
                  <p>You can close this window now.</p>
                </body>
              </html>
            `);

            // Close server after a short delay
            setTimeout(() => {
              server.close();
              this.isAuthenticating = false;
              resolve();
            }, 1000);
          } catch (error) {
            logger.error(
              'OAuth token creation failed',
              error instanceof Error ? error : new Error(String(error))
            );
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  font-family: Arial, sans-serif;
                  background-color: #fff0f0;
                ">
                  <h2 style="color: #d32f2f;">Error connecting to QuickBooks</h2>
                  <p>Please check the console for more details.</p>
                </body>
              </html>
            `);
            this.isAuthenticating = false;
            reject(error);
          }
        }
      });

      // Start server
      server.listen(port, async () => {
        // Generate cryptographic random state for CSRF protection
        this.oauthState = crypto.randomBytes(32).toString('hex');

        // Generate authorization URL with proper type assertion
        const authUri = this.oauthClient
          .authorizeUri({
            scope: [OAuthClient.scopes.Accounting as string],
            state: this.oauthState,
          })
          .toString();

        // Print auth URL so it can be opened manually (headless-friendly)
        logger.info(
          'QuickBooks OAuth URL (open this in a browser on the same machine or via SSH tunnel)',
          {
            authUri,
          }
        );
        // Also print to stderr for easy copy/paste
        console.error('QuickBooks OAuth URL:', authUri);

        // Try to open browser automatically, but don't crash if we're headless
        try {
          await open(authUri);
        } catch (e) {
          logger.warn('Failed to auto-open browser. Open the URL manually.', {
            authUri,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });

      // Handle server errors
      server.on('error', (error) => {
        logger.error(
          'OAuth callback server error',
          error instanceof Error ? error : new Error(String(error))
        );
        this.isAuthenticating = false;
        reject(error);
      });
    });
  }

  private saveTokensToEnv(): void {
    if (this.refreshToken && this.realmId) {
      saveTokens({
        refresh_token: this.refreshToken,
        realm_id: this.realmId,
        environment: this.environment,
      });
    }
  }

  async refreshAccessToken(): Promise<{ access_token: string; expires_in: number }> {
    if (!this.refreshToken) {
      await this.startOAuthFlow();

      // Verify we have a refresh token after OAuth flow
      if (!this.refreshToken) {
        throw new Error('Failed to obtain refresh token from OAuth flow');
      }
    }

    try {
      // Wrap token refresh with retry logic for transient failures
      const authResponse = await withRetry(
        async () => this.oauthClient.refreshUsingToken(this.refreshToken!),
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          retryableStatuses: [429, 500, 502, 503, 504],
        }
      );

      this.accessToken = authResponse.token.access_token;

      // Update refresh token if a new one was provided (OAuth may rotate tokens)
      const tokenData = authResponse.token as any;
      if (tokenData.refresh_token) {
        this.refreshToken = tokenData.refresh_token;
        this.saveTokensToEnv();
      }

      // Calculate expiry time
      const expiresIn = authResponse.token.expires_in || 3600; // Default to 1 hour
      this.accessTokenExpiry = new Date(Date.now() + expiresIn * 1000);

      return {
        access_token: this.accessToken,
        expires_in: expiresIn,
      };
    } catch (error: any) {
      // Detect expired or revoked refresh token errors
      const isExpiredOrRevoked = this.isTokenExpiredOrRevokedError(error);

      if (isExpiredOrRevoked) {
        logger.warn('Refresh token expired or revoked, clearing tokens and initiating re-auth', {
          errorMessage: error.message,
          errorCode: error.code || error.statusCode,
        });

        // Clear invalid tokens
        this.clearTokens();

        // Attempt to start new OAuth flow
        await this.startOAuthFlow();

        // Verify we got new tokens
        if (!this.refreshToken) {
          throw new Error(
            'Re-authentication required: Your QuickBooks authorization has expired. ' +
              'Please complete the OAuth flow to continue.'
          );
        }

        // Retry with new tokens
        return this.refreshAccessToken();
      }

      throw new Error(`Failed to refresh QuickBooks token: ${error.message}`);
    }
  }

  /**
   * Check if an error indicates the refresh token is expired or revoked
   */
  private isTokenExpiredOrRevokedError(error: any): boolean {
    // OAuth 2.0 error codes for invalid/expired tokens
    const errorCode = error.code || error.error || '';
    const statusCode = error.statusCode || error.status;
    const errorMessage = (error.message || '').toLowerCase();
    const errorDescription = (error.error_description || '').toLowerCase();

    // Check for specific OAuth error codes
    const invalidTokenCodes = [
      'invalid_grant',
      'invalid_token',
      'token_expired',
      'token_revoked',
      'access_denied',
    ];

    if (invalidTokenCodes.includes(errorCode.toLowerCase())) {
      return true;
    }

    // Check for 401 Unauthorized (token issues)
    if (statusCode === 401) {
      return true;
    }

    // Check error message patterns
    const expiredPatterns = [
      'expired',
      'revoked',
      'invalid refresh token',
      'refresh token is invalid',
      'token has been revoked',
      'authorization code has expired',
    ];

    for (const pattern of expiredPatterns) {
      if (errorMessage.includes(pattern) || errorDescription.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clear stored tokens (used when tokens are expired/revoked)
   */
  private clearTokens(): void {
    this.refreshToken = undefined;
    this.accessToken = undefined;
    this.accessTokenExpiry = undefined;
    this.quickbooksInstance = undefined;

    // Remove token file
    try {
      if (fs.existsSync(TOKEN_STORAGE_PATH)) {
        fs.unlinkSync(TOKEN_STORAGE_PATH);
        logger.info('Cleared stored tokens', { tokenPath: TOKEN_STORAGE_PATH });
      }
    } catch (e) {
      logger.warn('Failed to clear token file', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Check if the client is currently authenticated with valid tokens
   */
  isAuthenticated(): boolean {
    const now = new Date();
    return !!(this.accessToken && this.accessTokenExpiry && this.accessTokenExpiry > now);
  }

  /**
   * Check if refresh token is available
   */
  hasRefreshToken(): boolean {
    return !!this.refreshToken;
  }

  async authenticate() {
    if (!this.refreshToken || !this.realmId) {
      await this.startOAuthFlow();

      // Verify we have both tokens after OAuth flow
      if (!this.refreshToken || !this.realmId) {
        throw new Error('Failed to obtain required tokens from OAuth flow');
      }
    }

    // Check if token exists and is still valid
    const now = new Date();
    if (!this.accessToken || !this.accessTokenExpiry || this.accessTokenExpiry <= now) {
      const tokenResponse = await this.refreshAccessToken();
      this.accessToken = tokenResponse.access_token;
    }

    // At this point we know all tokens are available
    // Use non-null assertion since we validated above
    const accessToken = this.accessToken!;

    this.quickbooksInstance = new QuickBooks(
      this.clientId,
      this.clientSecret,
      accessToken,
      false, // no token secret for OAuth 2.0
      this.realmId!, // Safe to use ! here as we checked above
      this.environment === 'sandbox', // use the sandbox?
      false, // debug?
      null, // minor version
      '2.0', // oauth version
      this.refreshToken
    );

    return this.quickbooksInstance;
  }

  getQuickbooks() {
    if (!this.quickbooksInstance) {
      throw new Error('Quickbooks not authenticated. Call authenticate() first');
    }
    return this.quickbooksInstance;
  }

  /**
   * Execute a QuickBooks API call with retry logic, timeout, and circuit breaker
   * Wraps callback-style SDK methods with exponential backoff retry
   *
   * @param callbackFn - Function that accepts the SDK callback
   * @param options - Optional retry configuration
   * @returns Promise resolving with the API result
   *
   * @example
   * const result = await quickbooksClient.executeWithRetry<Purchase>(
   *   (cb) => quickbooks.getPurchase(id, cb)
   * );
   */
  async executeWithRetry<T>(
    callbackFn: (callback: (err: any, result: T) => void) => void,
    options?: RetryOptions
  ): Promise<T> {
    // Wrap with circuit breaker
    return qboCircuitBreaker.execute(async () => {
      // Create a promise that wraps the callback with timeout
      const withTimeout = new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`QuickBooks API request timed out after ${QUICKBOOKS_TIMEOUT_MS}ms`));
        }, QUICKBOOKS_TIMEOUT_MS);

        withCallbackRetry<T>(callbackFn, options)
          .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });

      return withTimeout;
    });
  }

  /**
   * Get the configured timeout in milliseconds
   */
  getTimeoutMs(): number {
    return QUICKBOOKS_TIMEOUT_MS;
  }
}

export const quickbooksClient = new QuickbooksClient({
  clientId: client_id,
  clientSecret: client_secret,
  refreshToken: refresh_token,
  realmId: realm_id,
  environment: environment,
  redirectUri: redirect_uri,
});
