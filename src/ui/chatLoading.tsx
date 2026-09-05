import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export function ChatLoading({
  label = '加载对话…',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <View
      style={[styles.wrap, compact ? styles.compact : null]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: spacing.xl,
  },
  compact: { paddingVertical: 8, alignItems: 'flex-start' },
  label: { color: colors.muted, fontSize: 13 },
});
