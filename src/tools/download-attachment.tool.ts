import { downloadAttachment } from "../handlers/upload-attachment.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "download_attachment";
const toolDescription = `Download an attachment from QuickBooks to a local file.

Use get_attachments first to find the attachment ID for an entity.
If destination_path is a directory, the original filename will be used.`;

const toolSchema = z.object({
  attachment_id: z.string().min(1).describe("The QuickBooks attachment ID to download"),
  destination_path: z.string().min(1).describe("Local file path or directory to save the attachment to. Supports ~ for home directory."),
});

const toolHandler = async ({ params }: any) => {
  const response = await downloadAttachment(params.attachment_id, params.destination_path);

  if (response.isError) {
    return {
      content: [{ type: "text" as const, text: `Error downloading attachment: ${response.error}` }],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Downloaded attachment to ${response.result?.filePath} (${response.result?.size} bytes)` },
    ],
  };
};

export const DownloadAttachmentTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
