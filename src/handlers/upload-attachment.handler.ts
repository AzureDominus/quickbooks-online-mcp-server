import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import fs from "fs";
import path from "path";

/**
 * Supported MIME types for QuickBooks attachments
 */
const SUPPORTED_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".pdf": "application/pdf",
};

export interface UploadAttachmentInput {
  /** Path to the file to upload */
  filePath: string;
  /** Entity type to attach to (e.g., "Purchase", "Invoice", "Bill") */
  entityType: string;
  /** Entity ID to attach to */
  entityId: string;
}

/**
 * Upload an attachment to QuickBooks Online and link it to an entity
 */
export async function uploadAttachment(
  input: UploadAttachmentInput
): Promise<ToolResponse<any>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    // Resolve and validate file path
    const resolvedPath = path.resolve(input.filePath.replace(/^~/, process.env.HOME || ""));
    
    if (!fs.existsSync(resolvedPath)) {
      return {
        result: null,
        isError: true,
        error: `File not found: ${input.filePath}`,
      };
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return {
        result: null,
        isError: true,
        error: `Not a file: ${input.filePath}`,
      };
    }

    // Get filename and detect MIME type
    const filename = path.basename(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeType = SUPPORTED_MIME_TYPES[ext];

    if (!mimeType) {
      return {
        result: null,
        isError: true,
        error: `Unsupported file type: ${ext}. Supported types: ${Object.keys(SUPPORTED_MIME_TYPES).join(", ")}`,
      };
    }

    // Read file
    const fileBuffer = fs.readFileSync(resolvedPath);

    // Upload using node-quickbooks upload method
    return new Promise((resolve) => {
      (quickbooks as any).upload(
        filename,
        mimeType,
        fileBuffer,
        input.entityType,
        input.entityId,
        (err: any, response: any) => {
          if (err) {
            resolve({
              result: null,
              isError: true,
              error: formatError(err),
            });
          } else {
            // Extract attachment ID from response
            const attachableResponse = response?.AttachableResponse || [];
            const attachable = attachableResponse[0]?.Attachable || response;
            
            resolve({
              result: {
                id: attachable?.Id,
                fileName: filename,
                contentType: mimeType,
                size: stats.size,
                entityType: input.entityType,
                entityId: input.entityId,
              },
              isError: false,
              error: null,
            });
          }
        }
      );
    });
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}

/**
 * Get attachments for an entity
 */
export async function getAttachments(
  entityType: string,
  entityId: string
): Promise<ToolResponse<any[]>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    return new Promise((resolve) => {
      const query = `SELECT * FROM Attachable WHERE AttachableRef.EntityRef.Type = '${entityType}' AND AttachableRef.EntityRef.value = '${entityId}'`;
      
      (quickbooks as any).findAttachables(
        { query },
        (err: any, response: any) => {
          if (err) {
            resolve({
              result: null,
              isError: true,
              error: formatError(err),
            });
          } else {
            const attachables = response?.QueryResponse?.Attachable || [];
            resolve({
              result: attachables.map((a: any) => ({
                id: a.Id,
                fileName: a.FileName,
                contentType: a.ContentType,
                size: a.Size,
                tempDownloadUri: a.TempDownloadUri,
              })),
              isError: false,
              error: null,
            });
          }
        }
      );
    });
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
