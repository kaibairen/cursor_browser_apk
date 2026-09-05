import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type ComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmit: () => void;
  submitting?: boolean;
  modelLabel: string;
  onModelPress?: () => void;
  repoLabel?: string;
  onRepoPress?: () => void;
  onAttach?: () => void;
  attachLabel?: string;
  hint?: string;
  listening?: boolean;
  onMicStart?: () => void;
  onMicEnd?: () => void;
  children?: ReactNode;
};

function MicIcon({ color }: { color: string }) {
  return (
    <View style={styles.micGlyph} accessibilityElementsHidden>
      <View style={[styles.micHead, { borderColor: color }]} />
      <View style={[styles.micArc, { borderColor: color }]} />
      <View style={[styles.micStem, { backgroundColor: color }]} />
    </View>
  );
}

export function Composer({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  submitting,
  modelLabel,
  onModelPress,
  repoLabel,
  onRepoPress,
  onAttach,
  attachLabel,
  hint,
  listening,
  onMicStart,
  onMicEnd,
  children,
}: ComposerProps) {
  function submit() {
    if (!value.trim() || submitting) return;
    onSubmit();
  }

  return (
    <View style={styles.card}>
      {children}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={listening ? '正在听…松手结束' : placeholder}
        placeholderTextColor={colors.muted}
        multiline
        autoCapitalize="sentences"
        autoCorrect
        editable={!submitting}
        style={styles.input}
      />
      {attachLabel ? <Text style={styles.attachHint}>{attachLabel}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          onPress={onAttach}
          disabled={!onAttach}
          style={[styles.plus, { opacity: onAttach ? 1 : 0.45 }]}
          hitSlop={8}
        >
          <Text style={styles.plusText}>+</Text>
        </Pressable>
        {onRepoPress ? (
          <Pressable accessibilityRole="button" onPress={onRepoPress} style={styles.chip} hitSlop={8}>
            <Text style={styles.chipText} numberOfLines={1}>
              {repoLabel} ▾
            </Text>
          </Pressable>
        ) : null}
        {onModelPress ? (
          <Pressable accessibilityRole="button" onPress={onModelPress} style={styles.chip} hitSlop={8}>
            <Text style={styles.chipText} numberOfLines={1}>
              {modelLabel} ▾
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.modelLocked} numberOfLines={1}>
            {modelLabel}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="按住说话"
          onPressIn={onMicStart}
          onPressOut={onMicEnd}
          disabled={!onMicStart}
          style={[styles.mic, listening && styles.micLive, { opacity: onMicStart ? 1 : 0.45 }]}
          hitSlop={8}
        >
          <MicIcon color={listening ? colors.danger : colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          style={[styles.send, { opacity: value.trim() && !submitting ? 1 : 0.35 }]}
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
  hint: { color: colors.muted, fontSize: 12, lineHeight: 16 },
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
  chip: { maxWidth: 140, paddingVertical: 4 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  modelLocked: { maxWidth: 140, color: colors.muted, fontSize: 13, fontWeight: '500' },
  mic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micLive: { backgroundColor: '#fee2e2' },
  micGlyph: { width: 16, height: 18, alignItems: 'center' },
  micHead: {
    width: 8,
    height: 11,
    borderRadius: 4,
    borderWidth: 1.6,
  },
  micArc: {
    width: 12,
    height: 6,
    marginTop: -1,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 1.6,
    borderTopWidth: 0,
  },
  micStem: { width: 1.6, height: 3, marginTop: 1, borderRadius: 1 },
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
