import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Button({ title, onPress, disabled, loading, variant = 'primary' }: ButtonProps) {
  const bg =
    variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.surface : colors.accent;
  const fg = variant === 'ghost' ? colors.text : '#fff';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor: bg, opacity: disabled || loading ? 0.5 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  secureTextEntry,
  autoCapitalize = 'none',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

export function Badge({ label, tone = 'idle' }: { label: string; tone?: 'active' | 'idle' | 'error' | 'done' }) {
  const map = {
    active: colors.accent,
    idle: colors.muted,
    error: colors.danger,
    done: colors.success,
  } as const;
  return (
    <View style={[styles.badge, { borderColor: map[tone] }]}>
      <Text style={[styles.badgeText, { color: map[tone] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
