export type ToolParts = {
  verb: string;
  target?: string;
  extra?: string;
};

function fileName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function clip(value: string, max = 56): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function lineRange(args: Record<string, unknown>): string {
  const start = firstNumber(args, ['offset', 'start_line', 'startLine', 'line']);
  const end = firstNumber(args, ['end_line', 'endLine']);
  const limit = firstNumber(args, ['limit']);
  if (start != null && end != null) return `L${start}-${end}`;
  if (start != null && limit != null) return `L${start}-${start + Math.max(1, limit) - 1}`;
  if (start != null) return `L${start}`;
  return '';
}

function looksLikePath(value: string): boolean {
  return /\/|\\|\.[a-z0-9]{1,8}$/i.test(value);
}

function isGenericName(name: string): boolean {
  return !name || /^(tool|mcp|unknown)$/i.test(name);
}

function resolveKind(name: string, record: Record<string, unknown>): string {
  if (!isGenericName(name)) return name;
  if (looksLikePath(name)) return 'read_file';
  const path = firstString(record, ['path', 'target_file', 'file_path', 'file', 'uri']);
  const pattern = firstString(record, ['pattern', 'query', 'search', 'regex', 'glob_pattern', 'glob']);
  const command = firstString(record, ['command', 'cmd']);
  const url = firstString(record, ['url']);
  if (command) return 'run_terminal_cmd';
  if (url) return 'WebFetch';
  if (pattern && path) return 'grep';
  if (pattern) return /https?:| /.test(pattern) ? 'web_search' : 'grep';
  if (path) return 'read_file';
  return 'read_file';
}

function pathLabel(name: string, args: Record<string, unknown>): string {
  const path = firstString(args, ['path', 'target_file', 'file_path', 'file', 'uri']);
  if (path) return fileName(path);
  if (looksLikePath(name)) return fileName(name);
  return '';
}

export function readToolArgs(payload: unknown): Record<string, unknown> | undefined {
  const row = asRecord(payload);
  if (!row) return undefined;
  const nested = asRecord(row.toolCall) ?? asRecord(row.update);
  const raw = row.args ?? row.input ?? row.params ?? nested?.args ?? nested?.input;
  const args = typeof raw === 'string' && raw.trim() ? { path: raw.trim() } : asRecord(raw);
  const result = asRecord(row.result);
  const success = asRecord(result?.success);
  const merged = { ...success, ...args };
  return Object.keys(merged).length ? merged : undefined;
}

export function toolParts(name: string, args?: unknown): ToolParts {
  const record = asRecord(args) ?? {};
  const kind = resolveKind(name.trim(), record);
  const path = pathLabel(name, record);
  const pattern = firstString(record, ['pattern', 'query', 'search', 'regex', 'glob_pattern', 'glob']);
  const command = firstString(record, ['command', 'cmd']);
  const url = firstString(record, ['url']);
  const range = lineRange(record);

  if (/^read(_file)?$/i.test(kind) || kind === 'Read') {
    return { verb: 'Read', target: path || undefined, extra: range || undefined };
  }
  if (/^write(_file)?$/i.test(kind) || kind === 'Write') {
    return { verb: 'Wrote', target: path || undefined };
  }
  if (/edit|strreplace|apply_patch/i.test(kind)) {
    return { verb: 'Edited', target: path || undefined };
  }
  if (/grep/i.test(kind)) {
    return {
      verb: 'Grepped',
      target: pattern ? clip(pattern) : undefined,
      extra: path ? `in ${path}` : undefined,
    };
  }
  if (/glob/i.test(kind)) {
    return { verb: 'Found', target: pattern ? clip(pattern) : undefined };
  }
  if (/web_search|websearch/i.test(kind)) {
    return { verb: 'Searched web', target: pattern ? clip(pattern) : undefined };
  }
  if (/web_fetch|webfetch/i.test(kind)) {
    return { verb: 'Fetched', target: url ? clip(url, 40) : undefined };
  }
  if (/terminal|shell/i.test(kind)) {
    return { verb: 'Ran', target: command ? clip(command) : undefined };
  }
  if (/codebase_search/i.test(kind)) {
    return { verb: 'Searched', target: pattern ? clip(pattern) : undefined };
  }
  if (/list_dir|listdir/i.test(kind)) {
    return { verb: 'Listed', target: path || undefined };
  }
  if (/^mcp$/i.test(kind)) {
    const tool = firstString(record, ['toolName', 'tool']);
    return { verb: 'MCP', target: tool || path || undefined };
  }
  if (/^task$/i.test(kind)) {
    const title = firstString(record, ['description', 'title', 'prompt']) || pattern;
    return { verb: 'Task', target: title ? clip(title) : undefined };
  }
  if (/await/i.test(kind)) return { verb: 'Waited' };
  if (/delete/i.test(kind)) return { verb: 'Deleted', target: path || undefined };
  return {
    verb: kind.replaceAll('_', ' '),
    target: path || (pattern ? clip(pattern) : undefined),
  };
}

export function toolCaption(name: string, args?: unknown): string {
  const parts = toolParts(name, args);
  return [parts.verb, parts.target, parts.extra].filter(Boolean).join(' ');
}
