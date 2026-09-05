import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export function SettingsChrome({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 8 },
  body: { color: colors.text, fontSize: 16 },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeRow: { flexDirection: 'row', gap: 16 },
  modeOn: { color: colors.text, fontWeight: '700', fontSize: 15 },
  modeOff: { color: colors.muted, fontSize: 15 },
  ok: { color: colors.success },
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  back: { color: colors.text, fontSize: 28, lineHeight: 30, width: 24 },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 16, fontWeight: '600' },
  content: { padding: spacing.md, gap: 12, paddingBottom: 48 },
});
