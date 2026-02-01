import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';

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

  server.tool(toolDefinition.name, toolDefinition.description, rawShape, toolDefinition.handler);
}
