import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function ChatText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <View style={styles.stack}>
      {blocks.map((block, index) => (
        <Block key={`${index}-${block.slice(0, 12)}`} text={block.trim()} />
      ))}
    </View>
  );
}

function Block({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  const isList = lines.every((line) => !line.trim() || /^[-*•]\s+/.test(line.trim()));
  if (isList) {
    return (
      <View style={styles.stack}>
        {lines
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, index) => (
            <View key={`${index}-${line}`} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.body}>{renderInline(line.replace(/^[-*•]\s+/, ''))}</Text>
            </View>
          ))}
      </View>
    );
  }
  return <Text style={styles.body}>{renderInline(text)}</Text>;
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
  bulletRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  bullet: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  code: {
    fontFamily: 'monospace',
    backgroundColor: colors.chip,
    color: colors.text,
    fontSize: 14,
  },
  bold: { fontWeight: '700' },
  link: { color: colors.link },
});
