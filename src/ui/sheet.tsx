import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

export type SheetItem = {
  id: string;
  label: string;
  hint?: string;
  destructive?: boolean;
};

export function ActionSheet({
  visible,
  title,
  message,
  items,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  items: SheetItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {items.map((item) => {
              const selected = selectedId !== undefined && item.id === selectedId;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    onSelect(item.id);
                  }}
                  style={styles.row}
                >
                  <Text style={[styles.label, item.destructive && styles.danger, selected && styles.selected]}>
                    {selected ? '✓ ' : ''}
                    {item.label}
                  </Text>
                  {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 18, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', paddingHorizontal: 4 },
  message: { color: colors.muted, fontSize: 14, lineHeight: 20, paddingHorizontal: 4, paddingBottom: 8 },
  list: { maxHeight: 420 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 4,
  },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  danger: { color: colors.danger },
  selected: { color: colors.text },
  cancel: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
