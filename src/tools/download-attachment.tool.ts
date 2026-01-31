import { downloadAttachment } from "../handlers/upload-attachment.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

const toolName = "download_attachment";
const toolDescription = `Download an attachment from QuickBooks to a local file.

Use get_attachments first to find the attachment ID for an entity.
If destination_path is a directory, the original filename will be used.`;

const toolSchema = z.object({
  attachment_id: z.string().min(1).describe("The QuickBooks attachment ID to download"),
  destination_path: z.string().min(1).describe("Local file path or directory to save the attachment to. Supports ~ for home directory."),
});

const toolHandler = async (args: any) => {
  logToolRequest(toolName, args);
  const startTime = Date.now();

  try {
    const response = await downloadAttachment(args.attachment_id, args.destination_path);

    if (response.isError) {
      logToolResponse(toolName, false, Date.now() - startTime);
      logger.error(`Failed to download attachment: ${response.error}`, undefined, { attachmentId: args.attachment_id });
      return {
        content: [{ type: "text" as const, text: `Error downloading attachment: ${response.error}` }],
      };
    }

    logToolResponse(toolName, true, Date.now() - startTime);
    logger.info("Attachment downloaded successfully", { attachmentId: args.attachment_id, filePath: response.result?.filePath });
    return {
      content: [
        { type: "text" as const, text: `Downloaded attachment to ${response.result?.filePath} (${response.result?.size} bytes)` },
      ],
    };
  } catch (error) {
    logToolResponse(toolName, false, Date.now() - startTime);
    logger.error("Failed to download attachment", error, { attachmentId: args?.attachment_id });
    throw error;
  }
};

export const DownloadAttachmentTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
