import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { ChatText } from './chatText';

export type ArtifactView =
  | { status: 'loading'; title: string }
  | { status: 'error'; title: string; message: string }
  | { status: 'markdown'; title: string; text: string }
  | { status: 'image'; title: string; uri: string }
  | { status: 'binary'; title: string; hint: string };

export function ArtifactViewer({
  view,
  onClose,
  onOpenExternal,
}: {
  view: ArtifactView | null;
  onClose: () => void;
  onOpenExternal?: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!view) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.flex, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>关闭</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {view.title}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        {view.status === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.hint}>按 UTF-8 读取，避免浏览器乱码</Text>
          </View>
        ) : null}
        {view.status === 'error' ? (
          <View style={styles.padded}>
            <Text style={styles.error}>{view.message}</Text>
          </View>
        ) : null}
        {view.status === 'markdown' ? (
          <ScrollView contentContainerStyle={styles.padded}>
            <ChatText text={view.text} />
          </ScrollView>
        ) : null}
        {view.status === 'image' ? (
          <ScrollView contentContainerStyle={styles.padded}>
            <Image source={{ uri: view.uri }} style={styles.image} resizeMode="contain" />
          </ScrollView>
        ) : null}
        {view.status === 'binary' ? (
          <View style={styles.padded}>
            <Text style={styles.hint}>{view.hint}</Text>
            {onOpenExternal ? (
              <Pressable accessibilityRole="button" onPress={onOpenExternal} style={styles.external}>
                <Text style={styles.externalText}>用浏览器打开</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  close: { color: colors.text, fontSize: 16, width: 40 },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  padded: { padding: spacing.lg, gap: 12, paddingBottom: 48 },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  image: { width: '100%', minHeight: 240, backgroundColor: colors.chip },
  external: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  externalText: { color: '#fff', fontWeight: '600' },
});
