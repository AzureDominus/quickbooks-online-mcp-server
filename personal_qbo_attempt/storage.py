"""
Storage utilities for QuickBooks Online MCP Server.

Provides idempotency tracking for expense creation to prevent duplicates.
Token and realm storage is handled by auth.py via the QuickBooksOAuthProxy.
"""
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class IdempotencyStore:
    """
    Redis-backed idempotency store for expense creation.
    
    Tracks idempotency keys to prevent duplicate expense creation
    when retrying failed requests.
    """
    
    KEY_PREFIX = "qbo:idempotency:"
    DEFAULT_TTL_DAYS = 30
    
    def __init__(self, redis_client):
        """
        Args:
            redis_client: An async Redis client (redis.asyncio.Redis)
        """
        self.redis = redis_client
    
    def _key(self, idempotency_key: str) -> str:
        return f"{self.KEY_PREFIX}{idempotency_key}"
    
    async def check(self, idempotency_key: str) -> str | None:
        """
        Check if idempotency key exists.
        
        Returns expense_id if found, None otherwise.
        """
        key = self._key(idempotency_key)
        data = await self.redis.get(key)
        if data:
            try:
                parsed = json.loads(data.decode() if isinstance(data, bytes) else data)
                return parsed.get("expense_id")
            except json.JSONDecodeError:
                return None
        return None
    
    async def store(
        self,
        idempotency_key: str,
        expense_id: str,
        ttl_days: int | None = None
    ) -> None:
        """
        Store idempotency key -> expense_id mapping with TTL.
        """
        key = self._key(idempotency_key)
        ttl = (ttl_days or self.DEFAULT_TTL_DAYS) * 86400
        data = {
            "expense_id": expense_id,
            "created_at": datetime.utcnow().isoformat()
        }
        await self.redis.setex(key, ttl, json.dumps(data))
        logger.debug(f"Stored idempotency key {idempotency_key} -> {expense_id}")
