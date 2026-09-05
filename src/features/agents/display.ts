import type { AgentListItem, AgentStatus } from '../../lib/cursor/types';

export function agentTitle(item: Pick<AgentListItem, 'name' | 'id'>): string {
  return item.name?.trim() || '未命名任务';
}

export function agentSubtitle(item: AgentListItem): string {
  if (item.env?.name) return item.env.name;
  if (item.env?.type && item.env.type !== 'cloud') return item.env.type;
  return 'Cloud';
}

export function initials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || '我';
  return source.slice(0, 2);
}

export function toolLabel(name: string): string {
  const map: Record<string, string> = {
    read_file: '读文件',
    write_file: '写文件',
    edit_file: '改文件',
    apply_patch: '改代码',
    run_terminal_cmd: '运行命令',
    grep: '搜索',
    glob: '找文件',
    list_dir: '列目录',
    codebase_search: '搜代码',
    web_search: '搜网页',
    mcp: '工具',
  };
  return map[name] ?? name.replaceAll('_', ' ');
}

export function fileName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function statusGlyph(status: AgentStatus): string {
  switch (status) {
    case 'ACTIVE':
      return '●';
    case 'IDLE':
      return '✓';
    case 'ARCHIVED':
      return '◌';
    default:
      return '·';
  }
}
