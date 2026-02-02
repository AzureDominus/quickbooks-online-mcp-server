/**
 * Create tool output helpers
 *
 * Goal: allow non-breaking, opt-in consistent envelopes for create_* tools.
 *
 * Default behavior (format undefined or 'raw') preserves existing output:
 * - Success returns the created entity directly
 * - Idempotency hits return { Id, wasIdempotent: true }
 */

export type CreateResponseFormat = 'raw' | 'envelope';

function inferId(entity: unknown): string | null {
  if (!entity || typeof entity !== 'object') return null;

  const anyEntity = entity as any;

  // QBO style
  if (typeof anyEntity.Id === 'string' && anyEntity.Id.length > 0) return anyEntity.Id;
  // Normalized style (e.g. purchase transform)
  if (typeof anyEntity.id === 'string' && anyEntity.id.length > 0) return anyEntity.id;

  return null;
}

export function buildCreateToolPayload<T>(opts: {
  entityType: string;
  entity?: T | null;
  id?: string | null;
  wasIdempotent: boolean;
  format?: CreateResponseFormat;
}): unknown {
  const format = opts.format ?? 'raw';

  // Preserve the repo's historical idempotency-hit payload for raw format.
  if (format === 'raw' && opts.wasIdempotent) {
    return {
      Id: opts.id ?? inferId(opts.entity) ?? null,
      wasIdempotent: true,
    };
  }

  if (format === 'raw') {
    return opts.entity ?? null;
  }

  // Envelope format
  const id = opts.id ?? inferId(opts.entity);

  return {
    entityType: opts.entityType,
    entity: opts.entity ?? null,
    meta: {
      id,
      wasIdempotent: opts.wasIdempotent,
    },
  };
}
