import { StyleSheet, Text, View } from 'react-native';
import { toolParts } from '../features/agents/toolCaption';
import { colors, radius } from '../theme';

export function ToolRow({
  name,
  args,
  running,
}: {
  name: string;
  args?: Record<string, unknown>;
  running?: boolean;
}) {
  const parts = toolParts(name, args);
  return (
    <View style={styles.row}>
      <Text style={styles.verb}>
        {parts.verb}
        {running ? '…' : ''}
      </Text>
      {parts.target ? (
        <View style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {parts.target}
          </Text>
        </View>
      ) : null}
      {parts.extra ? <Text style={styles.extra}>{parts.extra}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 22,
  },
  verb: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  chip: {
    backgroundColor: colors.chip,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: '78%',
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  extra: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
});
