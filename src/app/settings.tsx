import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRepositories } from '../features/agents/queries';
import { useAuth } from '../features/auth/AuthContext';
import { maskApiKey } from '../features/auth/secureKey';
import type { ConversationMode } from '../lib/cursor/types';
import { usePrefs } from '../storage/usePrefs';
import { colors, spacing } from '../theme';
import { Button, Field } from '../ui/primitives';
import { iatConfigured, readIatCredentials, writeIatCredentials } from '../features/speech/credentials';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { me, apiKey, signOut } = useAuth();
  const { prefs, update } = usePrefs();
  const repos = useRepositories();
  const [branch, setBranch] = useState('main');
  const [envName, setEnvName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [appId, setAppId] = useState('');
  const [xfKey, setXfKey] = useState('');
  const [xfSecret, setXfSecret] = useState('');
  const [xfReady, setXfReady] = useState(false);

  useEffect(() => {
    if (!prefs) return;
    setBranch(prefs.defaultBranch);
    setEnvName(prefs.defaultEnvName ?? '');
  }, [prefs]);

  useEffect(() => {
    void readIatCredentials().then((creds) => {
      if (!creds) return;
      setAppId(creds.appId);
      setXfKey(creds.apiKey);
      setXfSecret(creds.apiSecret);
      setXfReady(true);
    });
  }, []);

  async function persist(partial: Parameters<typeof update>[0]) {
    await update(partial);
    setSaved('已保存');
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 4 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>设置</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>账号</Text>
        <Text style={styles.body}>{me?.userEmail ?? me?.apiKeyName ?? '已连接'}</Text>
        <Text style={styles.meta}>密钥 {apiKey ? maskApiKey(apiKey) : '—'}</Text>
        <Button title="退出" variant="ghost" onPress={() => void signOut()} />

        <Text style={styles.label}>默认仓库</Text>
        <Field value={branch} onChangeText={setBranch} placeholder="默认分支，例如 main" />
        <Field value={envName} onChangeText={setEnvName} placeholder="记住的环境名（可选）" />
        <View style={styles.row}>
          <Text style={styles.body}>做完自动开 PR</Text>
          <Switch
            value={prefs?.defaultAutoCreatePR ?? true}
            onValueChange={(value) => void persist({ defaultAutoCreatePR: value })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.body}>默认模式</Text>
          <View style={styles.modeRow}>
            <Pressable onPress={() => void persist({ defaultMode: 'agent' as ConversationMode })}>
              <Text style={prefs?.defaultMode !== 'plan' ? styles.modeOn : styles.modeOff}>直接做</Text>
            </Pressable>
            <Pressable onPress={() => void persist({ defaultMode: 'plan' as ConversationMode })}>
              <Text style={prefs?.defaultMode === 'plan' ? styles.modeOn : styles.modeOff}>先计划</Text>
            </Pressable>
          </View>
        </View>
        <Button
          title="保存"
          variant="ghost"
          onPress={() => void persist({ defaultBranch: branch.trim() || 'main', defaultEnvName: envName.trim() || undefined })}
        />
        {saved ? <Text style={styles.ok}>{saved}</Text> : null}

        <Text style={styles.label}>语音听写（讯飞）</Text>
        <Text style={styles.meta}>
          按住作曲家里的「语音」说话。密钥只存在这台设备上。要开通「语音听写（流式版）」，Spark Lite 聊天接口不能转文字。
        </Text>
        <Field value={appId} onChangeText={setAppId} placeholder="APPID" />
        <Field value={xfKey} onChangeText={setXfKey} placeholder="APIKey" />
        <Field value={xfSecret} onChangeText={setXfSecret} placeholder="APISecret" secureTextEntry />
        <Button
          title={xfReady ? '更新听写密钥' : '保存听写密钥'}
          variant="ghost"
          disabled={!iatConfigured({ appId, apiKey: xfKey, apiSecret: xfSecret })}
          onPress={() => {
            void writeIatCredentials({ appId, apiKey: xfKey, apiSecret: xfSecret }).then(() => {
              setXfReady(true);
              setSaved('听写密钥已保存');
            });
          }}
        />

        <Text style={styles.label}>仓库列表</Text>
        <Text style={styles.meta}>偶尔刷新即可，平时可以手输地址。</Text>
        {(repos.data?.items ?? prefs?.cachedRepos ?? []).slice(0, 8).map((item) => (
          <Text key={item.url} style={styles.meta}>
            {item.url.replace('https://github.com/', '')}
          </Text>
        ))}
        <Button title="刷新仓库" variant="ghost" loading={repos.isFetching} onPress={() => void repos.refetch()} />

        <Text style={styles.label}>关于</Text>
        <Text style={styles.meta}>
          和网页、桌面 Cloud 是同一批任务。本地 Agent 要先移到 Cloud 才会出现。
        </Text>
      </ScrollView>
    </View>
  );
}

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
  label: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 8 },
  body: { color: colors.text, fontSize: 16 },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeRow: { flexDirection: 'row', gap: 16 },
  modeOn: { color: colors.text, fontWeight: '700', fontSize: 15 },
  modeOff: { color: colors.muted, fontSize: 15 },
  ok: { color: colors.success },
});
