import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { checkWriteGuard } from './write-guard.js';

const mutatingPrefixes = ['create_', 'update_', 'delete_', 'upload_'];

function isMutatingTool(toolName: string): boolean {
  return mutatingPrefixes.some((prefix) => toolName.startsWith(prefix));
}

export function RegisterTool<T extends z.ZodType<any, any>>(
  server: McpServer,
  toolDefinition: ToolDefinition<T>
) {
  // Get the raw shape from the Zod object schema
  // The MCP SDK expects ZodRawShape, not a wrapper object
  const schema = toolDefinition.schema;

  // If schema is a ZodObject, extract its shape; otherwise pass the schema's shape
  const rawShape =
    schema instanceof z.ZodObject
      ? (schema as z.ZodObject<z.ZodRawShape>).shape
      : { input: schema };

  const handler = toolDefinition.handler as (
    args: Record<string, unknown>,
    extra?: unknown
  ) => Promise<unknown> | unknown;
  const wrappedHandler = async (args: Record<string, unknown>, extra?: unknown) => {
    if (isMutatingTool(toolDefinition.name)) {
      const guard = checkWriteGuard();
      if (!guard.allowed) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                isError: true,
                error: guard.reason,
                environment: guard.environment,
                profileName: guard.profileName,
              }),
            },
          ],
        };
      }
    }

    return handler(args, extra);
  };

  server.tool(
    toolDefinition.name,
    toolDefinition.description,
    rawShape,
    wrappedHandler as typeof toolDefinition.handler
  );
}
