import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export function ThinkingBlock({
  text,
  done,
  durationMs,
}: {
  text: string;
  done?: boolean;
  durationMs?: number;
}) {
  const [open, setOpen] = useState(!done);

  useEffect(() => {
    if (!done) setOpen(true);
  }, [done]);

  const label = done
    ? durationMs
      ? `已思考 ${Math.max(1, Math.round(durationMs / 1000))}s`
      : '已思考'
    : '思考中…';

  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} hitSlop={8}>
        <Text style={styles.title}>
          {open ? '▾' : '▸'} {label}
        </Text>
      </Pressable>
      {open && text.trim() ? <Text style={styles.body}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  title: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingLeft: spacing.sm },
});
