import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { AgentStatus } from '../lib/cursor/types';
import { colors } from '../theme';
import { statusGlyph } from '../features/agents/display';

export function AgentStatusIcon({ status }: { status: AgentStatus | 'ACTIVE' | 'IDLE' | 'ARCHIVED' | string }) {
  if (status === 'ACTIVE') {
    return (
      <View style={styles.icon} accessibilityLabel="进行中">
        <ActivityIndicator size="small" color={colors.live} />
      </View>
    );
  }
  return <Text style={styles.glyph}>{statusGlyph(status as AgentStatus)}</Text>;
}

export function AgentRowMeta({
  repo,
  additions,
  deletions,
}: {
  repo: string;
  additions?: number;
  deletions?: number;
}) {
  const hasDiff = additions != null || deletions != null;
  return (
    <View style={styles.meta}>
      {hasDiff ? (
        <Text style={styles.diff} numberOfLines={1}>
          <Text style={styles.add}>+{additions ?? 0}</Text>
          <Text style={styles.gap}> </Text>
          <Text style={styles.del}>-{deletions ?? 0}</Text>
        </Text>
      ) : null}
      <Text style={styles.repo} numberOfLines={1}>
        {repo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  glyph: { width: 18, textAlign: 'center', color: colors.muted, fontSize: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  diff: { fontSize: 13, fontWeight: '600' },
  add: { color: colors.success },
  del: { color: colors.danger },
  gap: { fontSize: 13 },
  repo: { color: colors.muted, fontSize: 13, flexShrink: 1 },
});
