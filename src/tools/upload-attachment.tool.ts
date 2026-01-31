import { uploadAttachment } from "../handlers/upload-attachment.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "upload_attachment";
const toolDescription = `Upload a file attachment (receipt, document) to a QuickBooks entity.

Supports: Purchase (expense), Invoice, Bill, Estimate, etc.
Supported file types: JPEG, PNG, GIF, TIFF, PDF

Use this to attach receipts to expenses after creating them.`;

const toolSchema = z.object({
  file_path: z.string().min(1).describe("Path to the file to upload (supports ~ for home directory)"),
  entity_type: z.enum(["Purchase", "Invoice", "Bill", "Estimate", "Vendor", "Customer", "JournalEntry"])
    .describe("QuickBooks entity type to attach to"),
  entity_id: z.string().min(1).describe("ID of the entity to attach the file to"),
});

const toolHandler = async ({ params }: any) => {
  const response = await uploadAttachment({
    filePath: params.file_path,
    entityType: params.entity_type,
    entityId: params.entity_id,
  });

  if (response.isError) {
    return {
      content: [{ type: "text" as const, text: `Error uploading attachment: ${response.error}` }],
    };
  }

  return {
    content: [
      { type: "text" as const, text: `Attachment uploaded successfully:` },
      { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
    ],
  };
};

export const UploadAttachmentTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
