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

function tick(value: string): string {
  return `\`${clip(value)}\``;
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

function pathLabel(args: Record<string, unknown>): string {
  const path = firstString(args, ['path', 'target_file', 'file_path', 'file', 'uri']);
  return path ? fileName(path) : '';
}

export function readToolArgs(payload: unknown): Record<string, unknown> | undefined {
  const row = asRecord(payload);
  if (!row) return undefined;
  const nested = asRecord(row.toolCall) ?? asRecord(row.update);
  const raw = row.args ?? row.input ?? row.params ?? nested?.args ?? nested?.input;
  const args = asRecord(raw);
  const result = asRecord(row.result);
  const success = asRecord(result?.success);
  const merged = { ...success, ...args };
  return Object.keys(merged).length ? merged : undefined;
}

export function toolCaption(name: string, args?: unknown): string {
  const record = asRecord(args) ?? {};
  const path = pathLabel(record);
  const pattern = firstString(record, ['pattern', 'query', 'search', 'regex', 'glob_pattern', 'glob']);
  const command = firstString(record, ['command', 'cmd']);
  const url = firstString(record, ['url']);
  const range = lineRange(record);
  const kind = name.trim() || 'tool';

  if (/^read(_file)?$/i.test(kind) || kind === 'Read') {
    if (path && range) return `Read ${tick(path)} ${range}`;
    if (path) return `Read ${tick(path)}`;
    return 'Read';
  }
  if (/^write(_file)?$/i.test(kind) || kind === 'Write') {
    return path ? `Wrote ${tick(path)}` : 'Wrote';
  }
  if (/edit|strreplace|apply_patch/i.test(kind)) {
    return path ? `Edited ${tick(path)}` : 'Edited';
  }
  if (/grep/i.test(kind)) {
    if (pattern && path) return `Grepped ${tick(pattern)} in ${tick(path)}`;
    if (pattern) return `Grepped ${tick(pattern)}`;
    return 'Grep';
  }
  if (/glob/i.test(kind)) return pattern ? `Found ${tick(pattern)}` : 'Glob';
  if (/web_search|websearch/i.test(kind)) return pattern ? `Searched web ${tick(pattern)}` : 'Searched web';
  if (/web_fetch|webfetch/i.test(kind)) return url ? `Fetched ${tick(clip(url, 40))}` : 'Fetched';
  if (/terminal|shell/i.test(kind)) return command ? `Ran ${tick(command)}` : 'Shell';
  if (/codebase_search/i.test(kind)) return pattern ? `Searched ${tick(pattern)}` : 'Searched code';
  if (/list_dir|listdir/i.test(kind)) return path ? `Listed ${tick(path)}` : 'Listed';
  if (/^mcp$/i.test(kind)) {
    const tool = firstString(record, ['toolName', 'tool', 'name']);
    return tool ? `MCP ${tick(tool)}` : 'MCP';
  }
  if (/^task$/i.test(kind)) {
    const title = firstString(record, ['description', 'title', 'prompt']) || pattern;
    return title ? `Task ${tick(title)}` : 'Task';
  }
  if (/await/i.test(kind)) return 'Waited';
  if (/delete/i.test(kind)) return path ? `Deleted ${tick(path)}` : 'Deleted';
  if (path) return `${kind} ${tick(path)}`;
  if (pattern) return `${kind} ${tick(pattern)}`;
  return kind.replaceAll('_', ' ');
}
