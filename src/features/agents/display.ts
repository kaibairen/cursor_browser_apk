import type { AgentListItem, AgentStatus } from '../../lib/cursor/types';

export function agentTitle(item: Pick<AgentListItem, 'name' | 'id'>): string {
  return item.name?.trim() || '未命名任务';
}

export function agentSubtitle(item: AgentListItem, projectTitle?: string): string {
  if (projectTitle && projectTitle !== '未绑定仓库') return projectTitle;
  if (item.env?.name) return item.env.name;
  if (item.repos?.[0]?.url) {
    return item.repos[0].url.replace(/^https?:\/\/(github\.com\/)?/, '');
  }
  if (item.env?.type && item.env.type !== 'cloud') return item.env.type;
  return '未绑定仓库';
}

export function initials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || '我';
  return source.slice(0, 2);
}

export function toolLabel(name: string): string {
  const map: Record<string, string> = {
    read_file: '读文件',
    Read: '读文件',
    write_file: '写文件',
    Write: '写文件',
    edit_file: '改文件',
    Edit: '改文件',
    apply_patch: '改代码',
    StrReplace: '改代码',
    run_terminal_cmd: '运行命令',
    Shell: '运行命令',
    grep: '搜索',
    Grep: '搜索',
    glob: '找文件',
    Glob: '找文件',
    list_dir: '列目录',
    codebase_search: '搜代码',
    web_search: '搜网页',
    WebSearch: '搜网页',
    WebFetch: '抓网页',
    Task: '子任务',
    AwaitShell: '等待',
    Delete: '删文件',
    call_mcp_tool: '工具',
    CallMcpTool: '工具',
    mcp: '工具',
  };
  const trimmed = name.trim();
  if (!trimmed || trimmed === 'tool') return '工具';
  return map[trimmed] ?? trimmed.replaceAll('_', ' ');
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
