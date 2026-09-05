import { Text } from 'react-native';
import { toolLabel } from '../features/agents/display';
import type { TranscriptLine } from '../lib/cursor/sseApply';
import { colors } from '../theme';
import { ChatText } from './chatText';
import { ThinkingBlock } from './thinkingBlock';

export function TurnTimeline({
  lines,
  keptThinking,
  live,
  thinkingDone,
}: {
  lines: TranscriptLine[];
  keptThinking?: { text: string; durationMs?: number } | null;
  live?: boolean;
  thinkingDone?: boolean;
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
      {lines.map((line, index) => {
        if (line.kind === 'thinking') {
          return (
            <ThinkingBlock
              key={`think:${index}`}
              text={line.text}
              done={Boolean(thinkingDone || line.done)}
              durationMs={line.durationMs}
              defaultOpen={!line.done && !thinkingDone}
            />
          );
        }
        if (line.kind === 'tool') {
          return (
            <Text key={`${line.callId}-${index}`} style={{ color: colors.muted, fontSize: 13 }}>
              {toolLabel(line.name)}
              {line.status === 'completed' ? ' · 完成' : '…'}
            </Text>
          );
        }
        if (!line.text) return null;
        if (live && index === lastAssistantAt) {
          return (
            <Text key={`a:${index}`} style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
              {line.text}
              <Text style={{ color: colors.muted }}>▍</Text>
            </Text>
          );
        }
        return <ChatText key={`a:${index}`} text={line.text} />;
      })}
    </>
  );
}
