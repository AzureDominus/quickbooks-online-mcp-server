"""
QuickBooks Online FastMCP Server

MCP server for QuickBooks Online expense management.
Uses FastMCP OAuthProxy with custom QuickBooks realmId handling.
"""
import os
import sys
import asyncio
import signal
from datetime import datetime
from typing import Any

import structlog
from dotenv import load_dotenv
import redis.asyncio as aioredis
from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

from .auth import create_qbo_oauth_proxy
from .tools import register_tools

# Load environment variables
load_dotenv()


def configure_logging():
    """Configure structlog for JSON output in production"""
    log_level = os.getenv("QBO_MCP_LOG_LEVEL", "INFO").upper()
    is_production = os.getenv("QBO_MCP_ENVIRONMENT", "development") == "production"
    
    if is_production:
        processors = [
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ]
    else:
        processors = [
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.dev.ConsoleRenderer()
        ]
    
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    import logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stderr,
        level=getattr(logging, log_level, logging.INFO),
    )
    
    return structlog.get_logger("qbo_mcp")


logger = configure_logging()


def create_server() -> FastMCP:
    """
    Create and configure the FastMCP server.
    
    Returns a fully configured server with:
    - QuickBooksOAuthProxy for OAuth with realmId capture
    - Custom QBOTokenVerifier for opaque token validation
    - All QBO tools registered
    - Health endpoint
    """
    # Create Redis client
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = aioredis.from_url(redis_url)
    
    # Get base URL for OAuth callbacks
    base_url = os.getenv("QBO_MCP_BASE_URL", "http://localhost:8000")
    
    # Create OAuth proxy with custom QuickBooks handling
    auth_proxy, token_verifier = create_qbo_oauth_proxy(
        redis_client=redis_client,
        base_url=base_url,
    )
    
    # Create FastMCP server with OAuth proxy
    mcp = FastMCP(
        name="qbo-mcp-server",
        auth=auth_proxy,
        instructions="""
QuickBooks Online MCP Server for expense management.

Available tools:
- qbo_list_accounts: Find expense categories and payment accounts
- qbo_list_vendors: Search for vendors/payees
- qbo_list_tax_codes: Get available tax codes
- qbo_create_vendor: Create a new vendor
- qbo_search_expenses: Search expense transactions
- qbo_get_expense: Get expense details
- qbo_create_expense: Create new expenses with receipts
- qbo_update_expense: Modify existing expenses
- qbo_attach_receipt: Attach receipt files to expenses

Users must authenticate with QuickBooks Online before using these tools.
""",
    )
    
    # Register all QBO tools
    register_tools(mcp, redis_client)
    
    # Health check endpoint
    @mcp.custom_route("/health", methods=["GET"])
    async def health_endpoint(request: Request) -> JSONResponse:
        """HTTP health check endpoint for container orchestration"""
        status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "0.3.0",
            "redis": "unknown"
        }
        
        try:
            await redis_client.ping()
            status["redis"] = "connected"
        except Exception as e:
            status["redis"] = f"error: {str(e)}"
            status["status"] = "degraded"
        
        status_code = 200 if status["status"] == "healthy" else 503
        return JSONResponse(status, status_code=status_code)
    
    # Health check as MCP resource
    @mcp.resource("health://status")
    async def health_check() -> dict[str, Any]:
        """Health check for MCP clients"""
        status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "0.3.0",
        }
        try:
            await redis_client.ping()
            status["redis"] = "connected"
        except Exception as e:
            status["redis"] = f"error: {str(e)}"
            status["status"] = "degraded"
        return status
    
    logger.info("FastMCP server configured", name=mcp.name, base_url=base_url)
    
    return mcp


# Create server instance
mcp = create_server()


async def main():
    """Run the MCP server with HTTP transport"""
    host = os.getenv("QBO_MCP_HOST", "0.0.0.0")
    port = int(os.getenv("QBO_MCP_PORT", "8000"))
    # MCP path - set to "/" for ChatGPT compatibility, or "/mcp" for standard
    mcp_path = os.getenv("QBO_MCP_PATH", "/mcp")
    
    logger.info("Starting QBO MCP Server", host=host, port=port, path=mcp_path)
    
    shutdown_event = asyncio.Event()
    
    def handle_shutdown(sig):
        logger.info("Received shutdown signal", signal=sig.name)
        shutdown_event.set()
    
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: handle_shutdown(s))
    
    try:
        await mcp.run_async(
            transport="http",
            host=host,
            port=port,
            path=mcp_path,
        )
    except asyncio.CancelledError:
        logger.info("Server shutdown complete")


def run():
    """Entry point for the MCP server"""
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.exception("Server crashed", error=str(e))
        sys.exit(1)


if __name__ == "__main__":
    run()
