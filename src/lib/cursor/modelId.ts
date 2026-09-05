export function readModelId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.modelId === 'string' && row.modelId.trim()) return row.modelId;
  if (typeof row.model === 'string' && row.model.trim()) return row.model;
  if (row.model && typeof row.model === 'object') {
    const id = (row.model as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id;
  }
  return undefined;
}
