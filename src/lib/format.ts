export function formatRelative(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const delta = Date.now() - then;
  if (delta < 45_000) return '刚刚';
  if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))}m`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}

export type DateGroup = 'today' | 'yesterday' | 'week' | 'older';

export function dateGroup(iso?: string): DateGroup {
  if (!iso) return 'older';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'older';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const diff = start.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (diff <= 0) return 'today';
  if (diff <= day) return 'yesterday';
  if (diff <= 6 * day) return 'week';
  return 'older';
}

export function dateGroupLabel(group: DateGroup): string {
  switch (group) {
    case 'today':
      return '今天';
    case 'yesterday':
      return '昨天';
    case 'week':
      return '近 7 天';
    default:
      return '更早';
  }
}

export function formatTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function formatDuration(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
