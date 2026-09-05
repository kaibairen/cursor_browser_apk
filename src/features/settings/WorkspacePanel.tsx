import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import type { ConversationMode } from '../../lib/cursor/types';
import { normalizeRepoUrl, repoShortName } from '../agents/projects';
import { useRepositories } from '../agents/queries';
import { useAuth } from '../auth/AuthContext';
import { usePrefs } from '../../storage/usePrefs';
import { colors } from '../../theme';
import { Button, Field } from '../../ui/primitives';
import { settingsStyles as styles } from '../../ui/settingsChrome';

export function WorkspacePanel() {
  const { signedIn } = useAuth();
  const { prefs, update } = usePrefs();
  const repos = useRepositories();
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [envName, setEnvName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!prefs) return;
    setRepoUrl(prefs.defaultRepoUrl ?? prefs.recentRepos[0] ?? '');
    setBranch(prefs.defaultBranch);
    setEnvName(prefs.defaultEnvName ?? '');
  }, [prefs]);

  async function persist(partial: Parameters<typeof update>[0]) {
    await update(partial);
    setSaved('已保存');
  }

  async function saveDefault() {
    const next = normalizeRepoUrl(repoUrl);
    if (!next) {
      setSaved(null);
      await persist({ defaultRepoUrl: undefined, defaultBranch: branch.trim() || 'main', defaultEnvName: envName.trim() || undefined });
      return;
    }
    await persist({
      defaultRepoUrl: next,
      defaultBranch: branch.trim() || 'main',
      defaultEnvName: envName.trim() || undefined,
    });
  }

  return (
    <>
      <Text style={styles.meta}>这里配置默认仓库。新建对话会用它，也可以在输入框上方临时换一个。</Text>
      <Field
        value={repoUrl}
        onChangeText={setRepoUrl}
        placeholder="默认仓库，例如 github.com/org/repo"
      />
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
      <Button title="保存默认仓库" variant="ghost" onPress={() => void saveDefault()} />
      {saved ? <Text style={styles.ok}>{saved}</Text> : null}

      <Text style={styles.label}>从列表选一个</Text>
      <Text style={styles.meta}>点一下就设为默认仓库。</Text>
      {(repos.data?.items ?? prefs?.cachedRepos ?? []).slice(0, 12).map((item) => {
        const active = normalizeRepoUrl(repoUrl) === normalizeRepoUrl(item.url);
        return (
          <Pressable
            key={item.url}
            accessibilityRole="button"
            onPress={() => {
              setRepoUrl(item.url);
              void persist({ defaultRepoUrl: item.url });
            }}
          >
            <Text style={active ? styles.body : styles.meta}>{repoShortName(item.url)}</Text>
          </Pressable>
        );
      })}
      <Button
        title="刷新仓库"
        variant="ghost"
        disabled={!signedIn}
        loading={repos.isFetching}
        onPress={() => void repos.refetch()}
      />
    </>
  );
}
