import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../features/auth/AuthContext';
import { colors, spacing } from '../theme';
import { Button, Field } from '../ui/primitives';

export default function SetupScreen() {
  const { signIn, error: bootError } = useAuth();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法验证密钥');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Agents</Text>
        <Text style={styles.title}>用同一批云端任务</Text>
        <Text style={styles.body}>粘贴 User API Key。只存在这台手机上，和网页、桌面 Cloud 是同一个账号。</Text>
        <Field value={key} onChangeText={setKey} placeholder="粘贴 API Key" secureTextEntry />
        {error || bootError ? <Text style={styles.error}>{error || bootError}</Text> : null}
        <Button title="进入" onPress={() => void onSubmit()} loading={busy} disabled={!key.trim()} />
        <Text style={styles.hint}>Dashboard → Integrations → User API Keys</Text>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingTop: 72,
  },
  kicker: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  hint: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 14 },
});
