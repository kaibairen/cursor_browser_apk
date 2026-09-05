import type { ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type MdBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'quote'; text: string }
  | { type: 'code'; lang?: string; text: string }
  | { type: 'hr' }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'p'; text: string };

export function ChatText({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <View style={styles.stack}>
      {blocks.map((block, index) => (
        <RenderBlock key={`${block.type}-${index}`} block={block} />
      ))}
    </View>
  );
}

function RenderBlock({ block }: { block: MdBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <Text style={block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3}>
          {renderInline(block.text)}
        </Text>
      );
    case 'quote':
      return (
        <View style={styles.quote}>
          <Text style={styles.quoteText}>{renderInline(block.text)}</Text>
        </View>
      );
    case 'code':
      return (
        <ScrollView horizontal style={styles.codeBlock} contentContainerStyle={styles.codeInner}>
          <Text style={styles.codeText}>{block.text}</Text>
        </ScrollView>
      );
    case 'hr':
      return <View style={styles.hr} />;
    case 'list':
      return (
        <View style={styles.stack}>
          {block.items.map((item, index) => (
            <View key={`${index}-${item.slice(0, 16)}`} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.body}>{renderInline(item)}</Text>
            </View>
          ))}
        </View>
      );
    case 'table':
      return <MarkdownTable headers={block.headers} rows={block.rows} />;
    case 'p':
      return <Text style={styles.body}>{renderInline(block.text)}</Text>;
  }
}

function MarkdownTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const width = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const cells = (row: string[]) => Array.from({ length: width }, (_, i) => row[i] ?? '');

  return (
    <ScrollView horizontal style={styles.tableScroll}>
      <View>
        <View style={[styles.tableRow, styles.tableHead]}>
          {cells(headers).map((cell, index) => (
            <View key={`h-${index}`} style={styles.tableCell}>
              <Text style={styles.tableHeadText}>{renderInline(cell)}</Text>
            </View>
          ))}
        </View>
        {rows.map((row, rowIndex) => (
          <View key={`r-${rowIndex}`} style={styles.tableRow}>
            {cells(row).map((cell, index) => (
              <View key={`c-${rowIndex}-${index}`} style={styles.tableCell}>
                <Text style={styles.tableCellText}>{renderInline(cell)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function isTableSep(line: string): boolean {
  return /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);
}

function splitCells(line: string): string[] {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').map((cell) => cell.trim());
}

function parseBlocks(raw: string): MdBlock[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^```/.test(line.trim())) {
      const lang = line.trim().slice(3).trim() || undefined;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i]!.trim())) {
        body.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }

    if (/^\s*([-_*])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!.trim(),
      });
      i += 1;
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1]!)) {
      const headers = splitCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|') && !isTableSep(lines[i]!)) {
        rows.push(splitCells(lines[i]!));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        quote.push(lines[i]!.replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quote.join('\n') });
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && (/^\s*[-*•]\s+/.test(lines[i]!) || /^\s*\d+\.\s+/.test(lines[i]!))) {
        items.push(lines[i]!.replace(/^\s*(?:[-*•]|\d+\.)\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim()) {
      const peek = lines[i]!;
      if (/^```/.test(peek.trim()) || /^(#{1,3})\s+/.test(peek) || /^>\s?/.test(peek)) break;
      if (/^\s*([-_*])\1{2,}\s*$/.test(peek)) break;
      if (peek.trim().startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1]!)) break;
      if (/^\s*[-*•]\s+/.test(peek) || /^\s*\d+\.\s+/.test(peek)) break;
      para.push(peek);
      i += 1;
    }
    blocks.push({ type: 'p', text: para.join('\n') });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/\S+)/g);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text key={index} style={styles.code}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={index} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('http')) {
      return (
        <Text key={index} style={styles.link} onPress={() => void Linking.openURL(part)}>
          {part}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  h1: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  h3: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  bulletRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  bullet: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
    paddingLeft: 10,
  },
  quoteText: { color: colors.muted, fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 },
  codeBlock: {
    backgroundColor: colors.chip,
    borderRadius: 8,
    maxWidth: '100%',
  },
  codeInner: { padding: 10 },
  codeText: { fontFamily: 'monospace', color: colors.text, fontSize: 13, lineHeight: 18 },
  tableScroll: { maxWidth: '100%' },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tableHead: { backgroundColor: colors.chip },
  tableCell: { minWidth: 88, maxWidth: 220, paddingHorizontal: 8, paddingVertical: 8 },
  tableHeadText: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  tableCellText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  code: {
    fontFamily: 'monospace',
    backgroundColor: colors.chip,
    color: colors.text,
    fontSize: 14,
  },
  bold: { fontWeight: '700' },
  link: { color: colors.link },
});
