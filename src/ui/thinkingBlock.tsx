import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function ThinkingBlock({
  text,
  done,
  durationMs,
  defaultOpen,
}: {
  text: string;
  done?: boolean;
  durationMs?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? !done);

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
  wrap: { gap: 6, alignSelf: 'stretch' },
  title: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
