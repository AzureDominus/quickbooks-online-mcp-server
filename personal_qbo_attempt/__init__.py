"""
QuickBooks Online FastMCP Server

A MCP server for QuickBooks Online accounting,
providing expense management, vendor lookup, and receipt attachment tools.

Built with FastMCP 2.0 and featuring:
- OAuth 2.0 authentication with custom QuickBooksOAuthProxy
- Custom QBOTokenVerifier for QuickBooks opaque tokens
- Automatic realmId capture from OAuth callback
- Containerized deployment with Docker
"""

__version__ = "0.3.0"

# Lazy imports to avoid triggering server creation on module import
def __getattr__(name):
    if name == "mcp":
        from .server import mcp
        return mcp
    if name == "create_server":
        from .server import create_server
        return create_server
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


from .client import QBOClient, create_qbo_client
from .auth import QuickBooksOAuthProxy, QBOTokenVerifier, create_qbo_oauth_proxy

__all__ = [
    "mcp",
    "create_server",
    "QBOClient",
    "create_qbo_client",
    "QuickBooksOAuthProxy",
    "QBOTokenVerifier",
    "create_qbo_oauth_proxy",
]
