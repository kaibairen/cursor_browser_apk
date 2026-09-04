import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthContext';
import { maskApiKey } from '../../features/auth/secureKey';
import { useRepositories } from '../../features/agents/queries';
import type { ConversationMode } from '../../lib/cursor/types';
import { formatTime } from '../../lib/format';
import { usePrefs } from '../../storage/usePrefs';
import { colors, spacing } from '../../theme';
import { Button, Field } from '../../ui/primitives';

export default function SettingsScreen() {
  const { me, apiKey, signOut } = useAuth();
  const { prefs, update } = usePrefs();
  const repos = useRepositories();
  const [branch, setBranch] = useState('main');
  const [envName, setEnvName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!prefs) return;
    setBranch(prefs.defaultBranch);
    setEnvName(prefs.defaultEnvName ?? '');
  }, [prefs]);

  async function persistDefaults(partial: Parameters<typeof update>[0]) {
    await update(partial);
    setSaved('已保存到本机');
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>账号</Text>
      <Text style={styles.body}>{me?.userEmail ?? '已连接 User API Key'}</Text>
      <Text style={styles.meta}>密钥名：{me?.apiKeyName ?? '—'}</Text>
      <Text style={styles.meta}>密钥：{apiKey ? maskApiKey(apiKey) : '—'}</Text>
      <Button title="退出并清除本机密钥" variant="danger" onPress={() => void signOut()} />

      <Text style={styles.title}>默认值</Text>
      <Field label="默认分支" value={branch} onChangeText={setBranch} placeholder="main" />
      <Field label="记住的环境名" value={envName} onChangeText={setEnvName} placeholder="可选" />
      <View style={styles.row}>
        <Text style={styles.body}>默认自动开 PR</Text>
        <Switch
          value={prefs?.defaultAutoCreatePR ?? true}
          onValueChange={(value) => {
            void persistDefaults({ defaultAutoCreatePR: value });
          }}
          trackColor={{ true: colors.accentMuted, false: colors.border }}
          thumbColor={prefs?.defaultAutoCreatePR ? colors.accent : colors.muted}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.body}>默认模式</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="agent"
            variant={prefs?.defaultMode === 'plan' ? 'ghost' : 'primary'}
            onPress={() => void persistDefaults({ defaultMode: 'agent' as ConversationMode })}
          />
          <Button
            title="plan"
            variant={prefs?.defaultMode === 'plan' ? 'primary' : 'ghost'}
            onPress={() => void persistDefaults({ defaultMode: 'plan' as ConversationMode })}
          />
        </View>
      </View>
      <Button
        title="保存默认分支 / 环境名"
        variant="ghost"
        onPress={() => void persistDefaults({ defaultBranch: branch.trim() || 'main', defaultEnvName: envName.trim() || undefined })}
      />
      {saved ? <Text style={styles.ok}>{saved}</Text> : null}

      <Text style={styles.title}>仓库缓存</Text>
      <Text style={styles.meta}>
        GET /v1/repositories 限制 1 次/分钟、30 次/小时。列表会缓存在本机，新建页也可手输 URL。
      </Text>
      <Text style={styles.meta}>
        上次刷新：{prefs?.lastRepoRefreshAt ? formatTime(new Date(prefs.lastRepoRefreshAt).toISOString()) : '尚未刷新'}
      </Text>
      {(repos.data?.items ?? prefs?.cachedRepos ?? []).slice(0, 12).map((item) => (
        <Text key={item.url} style={styles.repo}>
          {item.url}
        </Text>
      ))}
      <Button
        title="刷新仓库列表"
        variant="ghost"
        loading={repos.isFetching}
        onPress={() => {
          void repos.refetch();
        }}
      />
      {repos.isError ? (
        <Text style={styles.error}>{repos.error instanceof Error ? repos.error.message : '刷新失败'}</Text>
      ) : null}

      <Text style={styles.title}>关于</Text>
      <Text style={styles.body}>
        Agents Console 是官方 Cloud Agents API 的个人客户端，不是 cursor.com 套壳。数据与网页、桌面 Cloud 面板是同一账号下的同一批
        bc-... 记录。桌面本地 Agent 需先 Cloud / Move to Cloud 才会出现。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  repo: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  ok: { color: colors.success },
  error: { color: colors.danger },
});
