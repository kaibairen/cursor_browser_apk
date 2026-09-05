import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type ComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmit: () => void;
  submitting?: boolean;
  disabled?: boolean;
  modelLabel: string;
  onModelPress?: () => void;
  onAttach?: () => void;
  attachLabel?: string;
  children?: React.ReactNode;
};

export function Composer({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  submitting,
  disabled,
  modelLabel,
  onModelPress,
  onAttach,
  attachLabel,
  children,
}: ComposerProps) {
  const canSend = Boolean(value.trim()) && !submitting && !disabled;

  return (
    <View style={styles.card}>
      {children}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        autoCapitalize="sentences"
        autoCorrect
        editable={!disabled}
        style={styles.input}
      />
      {attachLabel ? <Text style={styles.attachHint}>{attachLabel}</Text> : null}
      <View style={styles.toolbar}>
        <Pressable onPress={onAttach} style={styles.plus} hitSlop={8}>
          <Text style={styles.plusText}>+</Text>
        </Pressable>
        <Pressable onPress={onModelPress} style={styles.model} hitSlop={8}>
          <Text style={styles.modelText} numberOfLines={1}>
            {modelLabel} ▾
          </Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onSubmit}
          disabled={!canSend}
          style={[styles.send, { opacity: canSend ? 1 : 0.35 }]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>↑</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  input: {
    minHeight: 72,
    maxHeight: 160,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
    paddingTop: 6,
  },
  attachHint: { color: colors.muted, fontSize: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  plus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { color: colors.text, fontSize: 18, lineHeight: 20, fontWeight: '500' },
  model: { maxWidth: 180, paddingVertical: 4 },
  modelText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
