import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import type { ConversationMode } from '../../lib/cursor/types';
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
  const [branch, setBranch] = useState('main');
  const [envName, setEnvName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!prefs) return;
    setBranch(prefs.defaultBranch);
    setEnvName(prefs.defaultEnvName ?? '');
  }, [prefs]);

  async function persist(partial: Parameters<typeof update>[0]) {
    await update(partial);
    setSaved('已保存');
  }

  return (
    <>
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
        onPress={() =>
          void persist({ defaultBranch: branch.trim() || 'main', defaultEnvName: envName.trim() || undefined })
        }
      />
      {saved ? <Text style={styles.ok}>{saved}</Text> : null}

      <Text style={styles.label}>仓库列表</Text>
      <Text style={styles.meta}>偶尔刷新即可，平时可以手输地址。</Text>
      {(repos.data?.items ?? prefs?.cachedRepos ?? []).slice(0, 8).map((item) => (
        <Text key={item.url} style={styles.meta}>
          {item.url.replace('https://github.com/', '')}
        </Text>
      ))}
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
