import type { ModelInfo } from '../../lib/cursor/types';

export function modelDisplayName(id: string | undefined, items?: ModelInfo[]): string {
  if (!id) return '';
  return items?.find((item) => item.id === id)?.displayName || id;
}

export function defaultCatalogModelId(items?: ModelInfo[]): string {
  if (!items?.length) return '';
  const flagged = items.find((item) => item.variants?.some((variant) => variant.isDefault));
  return flagged?.id ?? items[0]?.id ?? '';
}

export function resolveStoredModelId(
  stored: string | undefined,
  fallback: string | undefined,
  items?: ModelInfo[],
): string {
  return stored || fallback || defaultCatalogModelId(items);
}
