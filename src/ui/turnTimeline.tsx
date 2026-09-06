import { StyleSheet, Text, View } from 'react-native';
import type { TranscriptLine } from '../lib/cursor/sseApply';
import type { Artifact } from '../lib/cursor/types';
import { colors } from '../theme';
import { ChatBody } from './chatBody';
import { ThinkingBlock } from './thinkingBlock';
import { ToolRow } from './toolRow';

export function TurnTimeline({
  lines,
  keptThinking,
  live,
  thinkingDone,
  agentId,
  artifacts,
  onOpenMedia,
}: {
  lines: TranscriptLine[];
  keptThinking?: { text: string; durationMs?: number } | null;
  live?: boolean;
  thinkingDone?: boolean;
  agentId?: string;
  artifacts?: Artifact[];
  onOpenMedia?: (path: string) => void;
}) {
  const streamThinking = lines.find((line) => line.kind === 'thinking');
  const lastAssistantIndex = [...lines].reverse().findIndex((line) => line.kind === 'assistant' && line.text);
  const lastAssistantAt = lastAssistantIndex >= 0 ? lines.length - 1 - lastAssistantIndex : -1;
  const showKept = !streamThinking && Boolean(keptThinking || !thinkingDone);

  return (
    <>
      {showKept ? (
        <ThinkingBlock
          text={keptThinking?.text ?? ''}
          done={thinkingDone}
          durationMs={keptThinking?.durationMs}
          defaultOpen={!thinkingDone}
        />
      ) : null}
      {renderTimeline(lines, live, thinkingDone, lastAssistantAt, agentId, artifacts, onOpenMedia)}
    </>
  );
}

function renderTimeline(
  lines: TranscriptLine[],
  live?: boolean,
  thinkingDone?: boolean,
  lastAssistantAt = -1,
  agentId?: string,
  artifacts?: Artifact[],
  onOpenMedia?: (path: string) => void,
) {
  const nodes = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line?.kind === 'tool') {
      const start = index;
      const group: Extract<TranscriptLine, { kind: 'tool' }>[] = [];
      while (index < lines.length && lines[index]?.kind === 'tool') {
        const tool = lines[index];
        if (tool?.kind === 'tool') group.push(tool);
        index += 1;
      }
      nodes.push(
        <View key={`tools:${start}`} style={styles.tools}>
          {group.map((tool, toolIndex) => (
            <ToolRow
              key={`${tool.callId}-${toolIndex}`}
              name={tool.name}
              args={tool.args}
              running={tool.status !== 'completed'}
            />
          ))}
        </View>,
      );
      continue;
    }
    if (line?.kind === 'thinking') {
      nodes.push(
        <ThinkingBlock
          key={`think:${index}`}
          text={line.text}
          done={Boolean(thinkingDone || line.done)}
          durationMs={line.durationMs}
          defaultOpen={!line.done && !thinkingDone}
        />,
      );
      index += 1;
      continue;
    }
    if (line?.kind === 'assistant' && line.text) {
      nodes.push(
        live && index === lastAssistantAt ? (
          <Text key={`a:${index}`} style={styles.live}>
            {line.text}
            <Text style={styles.caret}>▍</Text>
          </Text>
        ) : (
          <ChatBody
            key={`a:${index}`}
            text={line.text}
            agentId={agentId}
            artifacts={artifacts}
            onOpen={onOpenMedia}
          />
        ),
      );
    }
    index += 1;
  }
  return nodes;
}

const styles = StyleSheet.create({
  tools: { gap: 5, paddingVertical: 2 },
  live: { color: colors.text, fontSize: 16, lineHeight: 24 },
  caret: { color: colors.muted, fontSize: 16, lineHeight: 24 },
});
