import { createQuickbooksVendor } from "../handlers/create-quickbooks-vendor.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";
import { checkIdempotency, storeIdempotency } from "../helpers/idempotency.js";

const toolName = "create-vendor";
const toolDescription = `Create a vendor in QuickBooks Online.

REQUIRED FIELDS:
- DisplayName: Unique display name for the vendor (required)

OPTIONAL FIELDS:
- GivenName: First name
- FamilyName: Last name
- CompanyName: Company/business name
- PrimaryEmailAddr: Primary email address (object with Address field)
- PrimaryPhone: Primary phone number (object with FreeFormNumber field)
- BillAddr: Billing address (Line1, City, Country, CountrySubDivisionCode, PostalCode)

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original vendor ID is returned`;

const toolSchema = z.object({
  vendor: z.object({
    DisplayName: z.string(),
    GivenName: z.string().optional(),
    FamilyName: z.string().optional(),
    CompanyName: z.string().optional(),
    PrimaryEmailAddr: z.object({
      Address: z.string().optional(),
    }).optional(),
    PrimaryPhone: z.object({
      FreeFormNumber: z.string().optional(),
    }).optional(),
    BillAddr: z.object({
      Line1: z.string().optional(),
      City: z.string().optional(),
      Country: z.string().optional(),
      CountrySubDivisionCode: z.string().optional(),
      PostalCode: z.string().optional(),
    }).optional(),
  }),
  idempotencyKey: z.string().optional().describe("Optional key to prevent duplicate vendor creation on retry"),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  const typedArgs = args as ToolInput;
  const input = typedArgs.vendor;
  const idempotencyKey = typedArgs.idempotencyKey;
  
  logToolRequest(toolName, { DisplayName: input?.DisplayName, idempotencyKey });

  try {
    // Check idempotency first
    const existingId = checkIdempotency(idempotencyKey);
    if (existingId) {
      logger.info('Idempotency hit - returning cached result', {
        idempotencyKey,
        existingId,
      });
      
      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Vendor already exists (idempotent):` },
          { type: "text" as const, text: JSON.stringify({ Id: existingId, wasIdempotent: true }) },
        ],
      };
    }

    const response = await createQuickbooksVendor(input);

    if (response.isError) {
      logger.error('Failed to create vendor', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating vendor: ${response.error}`,
          },
        ],
      };
    }

    const vendor = response.result;

    // Store idempotency result
    if (vendor?.Id && idempotencyKey) {
      storeIdempotency(idempotencyKey, vendor.Id, 'Vendor');
      logger.info('Idempotency miss - stored new result', {
        idempotencyKey,
        vendorId: vendor.Id,
      });
    }

    logger.info('Vendor created successfully', {
      vendorId: vendor?.Id,
      displayName: vendor?.DisplayName,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Vendor created successfully:` },
        { type: "text" as const, text: JSON.stringify(vendor, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in create-vendor', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const CreateVendorTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 