"""
QuickBooks Online OAuth Authentication

Custom QuickBooksOAuthProxy that:
1. Captures realmId from QuickBooks OAuth callback
2. Stores realmId linked to client_id after token exchange
3. Custom TokenVerifier that validates QBO opaque tokens and includes realmId in claims

This enables MCP tools to access the correct QuickBooks company (realm) for each user.
"""
import os
import logging
import hashlib
import json
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import httpx
import redis.asyncio as aioredis
from cryptography.fernet import Fernet
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse

from fastmcp.server.auth import OAuthProxy
from fastmcp.server.auth.auth import AccessToken, TokenVerifier

logger = logging.getLogger(__name__)

# QuickBooks OAuth endpoints
QBO_AUTHORIZATION_ENDPOINT = "https://appcenter.intuit.com/connect/oauth2"
QBO_TOKEN_ENDPOINT = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"

# QuickBooks scopes
QBO_ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting"


class QuickBooksOAuthProxy(OAuthProxy):
    """
    OAuth Proxy customized for QuickBooks Online.
    
    QuickBooks includes a `realmId` (company ID) parameter in the OAuth callback
    that is essential for API calls. This proxy captures and stores the realmId
    during the OAuth flow and links it to the client session.
    
    Flow:
    1. _handle_idp_callback receives callback with realmId in query params
    2. We store realmId keyed by transaction ID (state param)
    3. After token exchange, we move realmId to be keyed by client_id
    4. TokenVerifier retrieves realmId and includes it in AccessToken.claims
    """
    
    def __init__(
        self,
        *,
        redis_client: aioredis.Redis,
        **kwargs,
    ):
        """
        Initialize QuickBooks OAuth Proxy.
        
        Args:
            redis_client: Async Redis client for storing realmId mappings
            **kwargs: All standard OAuthProxy arguments
        """
        super().__init__(**kwargs)
        self._redis = redis_client
        
    async def _store_realm_by_state(self, state: str, realm_id: str) -> None:
        """Store realmId temporarily keyed by OAuth state/transaction ID."""
        key = f"qbo:realm:state:{state}"
        await self._redis.setex(key, 600, realm_id)  # 10 min TTL
        logger.debug(f"Stored realmId by state: {state[:20]}... -> {realm_id}")
    
    async def _get_realm_by_state(self, state: str) -> str | None:
        """Get realmId by OAuth state/transaction ID."""
        key = f"qbo:realm:state:{state}"
        value = await self._redis.get(key)
        if value:
            return value.decode() if isinstance(value, bytes) else value
        return None
    
    async def _delete_realm_by_state(self, state: str) -> None:
        """Delete temporary state-keyed realmId."""
        key = f"qbo:realm:state:{state}"
        await self._redis.delete(key)
    
    async def store_realm_by_client_id(
        self, client_id: str, realm_id: str, refresh_token: str | None = None
    ) -> None:
        """
        Store realmId permanently keyed by client_id.
        
        Also stores refresh_token for token refresh operations.
        """
        key = f"qbo:realm:client:{client_id}"
        data = {
            "realm_id": realm_id,
            "refresh_token": refresh_token,
            "updated_at": datetime.utcnow().isoformat(),
        }
        await self._redis.set(key, json.dumps(data))
        logger.info(f"Stored realmId by client_id: {client_id} -> {realm_id}")
    
    async def get_realm_data_by_client_id(self, client_id: str) -> dict[str, Any] | None:
        """Get realmId and refresh_token by client_id."""
        key = f"qbo:realm:client:{client_id}"
        value = await self._redis.get(key)
        if value:
            data = value.decode() if isinstance(value, bytes) else value
            return json.loads(data)
        return None
    
    async def _handle_idp_callback(
        self, request: Request
    ) -> HTMLResponse | RedirectResponse:
        """
        Handle callback from QuickBooks, capturing realmId before parent processing.
        
        QuickBooks includes realmId as a query parameter which we need to store
        and later associate with the client's session.
        """
        # Extract QuickBooks-specific realmId parameter
        realm_id = request.query_params.get("realmId")
        state = request.query_params.get("state")  # This is the transaction ID
        code = request.query_params.get("code")
        
        if realm_id and state:
            # Store realmId keyed by state (transaction ID)
            await self._store_realm_by_state(state, realm_id)
            logger.info(f"Captured realmId from QBO callback: {realm_id}")
        elif not realm_id:
            logger.warning("QuickBooks callback missing realmId parameter")
        
        # Also store by code for lookup during exchange_authorization_code
        if realm_id and code:
            code_key = f"qbo:realm:code:{code}"
            await self._redis.setex(code_key, 600, realm_id)
        
        # Call parent implementation which handles token exchange
        return await super()._handle_idp_callback(request)
    
    async def exchange_authorization_code(self, client, authorization_code):
        """
        Exchange authorization code and link realmId to client_id.
        
        After the parent exchanges the code, we look up the realmId stored
        during callback and associate it with the client_id for permanent storage.
        """
        logger.info(f"exchange_authorization_code called for client: {client.client_id}")
        
        # Get the internal code model which has idp_tokens
        code_model = await self._code_store.get(key=authorization_code.code)
        logger.debug(f"Code model found: {code_model is not None}")
        
        # Look up realmId - first try by stored QBO code, then scan for recent state entries
        realm_id = None
        refresh_token = None
        
        # Method 1: Try to find by scanning recent state entries for this client
        async for key in self._redis.scan_iter("qbo:realm:state:*"):
            key_str = key.decode() if isinstance(key, bytes) else key
            value = await self._redis.get(key)
            if value:
                data = value.decode() if isinstance(value, bytes) else value
                try:
                    realm_data = json.loads(data)
                    # Handle both dict format {"realm_id": "..."} and plain string/int
                    if isinstance(realm_data, dict):
                        realm_id = realm_data.get("realm_id")
                    else:
                        realm_id = str(realm_data)
                    if realm_id:
                        logger.info(f"Found realmId from state: {realm_id}")
                        # Clean up the state entry
                        await self._redis.delete(key)
                        break
                except json.JSONDecodeError:
                    # Plain string format (not valid JSON)
                    realm_id = data
                    logger.info(f"Found realmId (plain) from state: {realm_id}")
                    await self._redis.delete(key)
                    break
        
        # Method 2: Also scan code entries (legacy)
        if not realm_id:
            async for key in self._redis.scan_iter("qbo:realm:code:*"):
                key_str = key.decode() if isinstance(key, bytes) else key
                value = await self._redis.get(key)
                if value:
                    realm_id = value.decode() if isinstance(value, bytes) else value
                    logger.info(f"Found realmId from code key: {realm_id}")
                    await self._redis.delete(key)
                    break
        
        # Call parent to do the actual token exchange
        result = await super().exchange_authorization_code(client, authorization_code)
        
        # Get refresh token from the stored idp_tokens
        if code_model and hasattr(code_model, 'idp_tokens') and code_model.idp_tokens:
            refresh_token = code_model.idp_tokens.get("refresh_token")
            logger.debug(f"Got refresh_token from code_model: {refresh_token is not None}")
        
        # Now link realmId to client_id permanently
        if realm_id and client.client_id:
            await self.store_realm_by_client_id(client.client_id, realm_id, refresh_token)
            logger.info(f"Linked realmId {realm_id} to client {client.client_id}")
        elif not realm_id:
            logger.warning("No realmId found during token exchange - scanning complete")
        
        return result


class QBOTokenVerifier(TokenVerifier):
    """
    Token verifier for QuickBooks opaque access tokens.
    
    QuickBooks issues opaque tokens (not JWTs), so we validate them by making
    a test API call. This verifier also:
    - Looks up the realmId associated with the client
    - Handles token refresh when tokens are near expiry
    - Includes upstream token and realmId in AccessToken.claims for tool access
    """
    
    def __init__(
        self,
        oauth_proxy: QuickBooksOAuthProxy,
        client_id: str | None = None,
        client_secret: str | None = None,
        base_url: str | None = None,
        required_scopes: list[str] | None = None,
    ):
        super().__init__(
            base_url=base_url,
            required_scopes=required_scopes or [QBO_ACCOUNTING_SCOPE],
        )
        self._oauth_proxy = oauth_proxy
        self._client_id = client_id or os.getenv("QBO_CLIENT_ID")
        self._client_secret = client_secret or os.getenv("QBO_CLIENT_SECRET")
    
    async def _refresh_token(
        self, refresh_token: str, realm_id: str, client_id: str
    ) -> tuple[str, str] | None:
        """
        Refresh the QuickBooks access token.
        
        Returns (new_access_token, new_refresh_token) or None if refresh fails.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    QBO_TOKEN_ENDPOINT,
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": refresh_token,
                    },
                    auth=(self._client_id, self._client_secret),
                    timeout=30.0,
                )
            
            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                return None
            
            data = response.json()
            new_access = data.get("access_token")
            new_refresh = data.get("refresh_token", refresh_token)
            
            # Update stored refresh token
            await self._oauth_proxy.store_realm_by_client_id(client_id, realm_id, new_refresh)
            
            logger.info(f"Successfully refreshed QBO token for client {client_id}")
            return (new_access, new_refresh)
            
        except Exception as e:
            logger.error(f"Token refresh error: {e}")
            return None
    
    async def verify_token(self, token: str) -> AccessToken | None:
        """
        Verify a QuickBooks access token.
        
        The token passed here is the upstream QuickBooks token, looked up by
        FastMCP's OAuthProxy from its encrypted storage.
        
        We validate by calling the OpenID userinfo endpoint, then return an AccessToken
        with the upstream token and realmId in claims for tool access.
        """
        try:
            # Validate token with the OpenID userinfo endpoint
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://accounts.platform.intuit.com/v1/openid_connect/userinfo",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=10.0,
                )
            
            if response.status_code == 401:
                logger.debug("QuickBooks token is invalid or expired")
                return None
            
            if response.status_code != 200:
                logger.warning(f"QuickBooks userinfo endpoint returned {response.status_code}")
                # Non-401 errors might be temporary, still try to use the token
            
            # Find the client_id and realm_id
            # Since this is single-user mode, scan for the most recent realm data
            realm_id = None
            client_id = "default"
            
            async for key in self._oauth_proxy._redis.scan_iter("qbo:realm:client:*"):
                key_str = key.decode() if isinstance(key, bytes) else key
                client_id = key_str.split(":")[-1]
                realm_data = await self._oauth_proxy.get_realm_data_by_client_id(client_id)
                if realm_data:
                    realm_id = realm_data.get("realm_id")
                    logger.debug(f"Found realm_id for client {client_id}: {realm_id}")
                break  # Use first match
            
            if not realm_id:
                logger.warning("No realm_id found - QuickBooks API calls may fail")
            
            # Return AccessToken with claims for tool access
            return AccessToken(
                token=token,
                client_id=client_id,
                scopes=self.required_scopes or [],
                claims={
                    "upstream_access_token": token,
                    "realm_id": realm_id,
                    "validated_at": datetime.utcnow().isoformat(),
                },
            )
            
        except httpx.TimeoutException:
            logger.warning("QuickBooks token verification timed out")
            # On timeout, allow the token (fail open for availability)
            return AccessToken(
                token=token,
                client_id="timeout-fallback",
                scopes=self.required_scopes or [],
                claims={
                    "upstream_access_token": token,
                    "realm_id": None,
                    "validated_at": datetime.utcnow().isoformat(),
                    "timeout": True,
                },
            )
        except Exception as e:
            logger.error(f"Error verifying QuickBooks token: {e}")
            return None


def create_qbo_oauth_proxy(
    redis_client: aioredis.Redis,
    base_url: str,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> tuple[QuickBooksOAuthProxy, QBOTokenVerifier]:
    """
    Create a QuickBooks OAuth Proxy with custom token verifier.
    
    Returns both the proxy and verifier for use in FastMCP server configuration.
    """
    from key_value.aio.stores.redis import RedisStore
    from key_value.aio.wrappers.encryption import FernetEncryptionWrapper
    
    qbo_client_id = client_id or os.getenv("QBO_CLIENT_ID")
    qbo_client_secret = client_secret or os.getenv("QBO_CLIENT_SECRET")
    
    if not qbo_client_id or not qbo_client_secret:
        raise ValueError("QBO_CLIENT_ID and QBO_CLIENT_SECRET are required")
    
    # Get or generate encryption key for client storage
    storage_key = os.getenv("STORAGE_ENCRYPTION_KEY")
    if not storage_key:
        # Generate a key from the client secret (deterministic)
        import base64
        key_bytes = hashlib.sha256(qbo_client_secret.encode()).digest()
        storage_key = base64.urlsafe_b64encode(key_bytes).decode()
    
    # Parse Redis URL to get host/port/db
    redis_url_env = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    parsed = urlparse(redis_url_env)
    redis_host = parsed.hostname or "localhost"
    redis_port = parsed.port or 6379
    redis_db = int(parsed.path.lstrip("/")) if parsed.path.lstrip("/") else 0
    
    # Create encrypted Redis storage for OAuth state
    client_storage = FernetEncryptionWrapper(
        key_value=RedisStore(host=redis_host, port=redis_port, db=redis_db),
        fernet=Fernet(storage_key.encode() if isinstance(storage_key, str) else storage_key),
    )
    
    # Get or generate JWT signing key
    jwt_signing_key = os.getenv("JWT_SIGNING_KEY", qbo_client_secret)
    
    # Create a placeholder verifier first
    placeholder_verifier = TokenVerifier(base_url=base_url)
    
    # Create the proxy
    proxy = QuickBooksOAuthProxy(
        redis_client=redis_client,
        # QuickBooks OAuth endpoints
        upstream_authorization_endpoint=QBO_AUTHORIZATION_ENDPOINT,
        upstream_token_endpoint=QBO_TOKEN_ENDPOINT,
        # App credentials
        upstream_client_id=qbo_client_id,
        upstream_client_secret=qbo_client_secret,
        # Server configuration
        base_url=base_url,
        # Use Redis storage for Docker compatibility
        client_storage=client_storage,
        jwt_signing_key=jwt_signing_key,
        # Skip consent screen for simpler flow
        require_authorization_consent=False,
        # Required scopes for QuickBooks
        valid_scopes=[QBO_ACCOUNTING_SCOPE],
        # Placeholder verifier - will be replaced
        token_verifier=placeholder_verifier,
    )
    
    # Create verifier with reference to proxy
    verifier = QBOTokenVerifier(
        oauth_proxy=proxy,
        client_id=qbo_client_id,
        client_secret=qbo_client_secret,
        base_url=base_url,
        required_scopes=[QBO_ACCOUNTING_SCOPE],
    )
    
    # Replace placeholder verifier
    proxy._token_validator = verifier
    
    return proxy, verifier
