/**
 * Unit Tests: Tool Schema ID Coercion
 *
 * mcporter sometimes supplies numeric IDs; our Zod schemas should accept them
 * and coerce to strings for handler compatibility.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Tool Schema ID Coercion', () => {
  it('GetBillTool should accept numeric id and coerce to string', async () => {
    // Tool modules pull in the QBO client at import-time.
    // Ensure required env vars exist so module import doesn't throw.
    process.env.QUICKBOOKS_CLIENT_ID ??= 'test-client-id';
    process.env.QUICKBOOKS_CLIENT_SECRET ??= 'test-client-secret';

    const { GetBillTool } = await import('../../tools/get-bill.tool.js');

    const result = GetBillTool.schema.safeParse({ id: 123 });
    assert.ok(result.success, `Validation failed: ${JSON.stringify(result.error?.issues)}`);
    assert.equal(result.data.id, '123');
    assert.equal(typeof result.data.id, 'string');
  });
});
