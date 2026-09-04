import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../features/auth/AuthContext';
import { colors, spacing } from '../theme';
import { Button, Field } from '../ui/primitives';

export default function SetupScreen() {
  const { signIn } = useAuth();
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
        <Text style={styles.title}>Agents Console</Text>
        <Text style={styles.body}>
          这是官方 Cloud Agents API 的个人控制台，和 cursor.com/agents、桌面 Cloud 面板共用同一账号。密钥只保存在本机，不会上传到本应用服务器。
        </Text>
        <Text style={styles.body}>
          在 Dashboard → Integrations → User API Keys 创建密钥后粘贴到这里。不要把密钥写进仓库或聊天。
        </Text>
        <Field
          label="User API Key"
          value={key}
          onChangeText={setKey}
          placeholder="key_..."
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="验证并进入" onPress={onSubmit} loading={busy} disabled={!key.trim()} />
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
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
});
