import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { pickImages, toPromptImages, type PickedImage } from '../../features/agents/images';
import { useCreateAgent, useModels, useRepositories } from '../../features/agents/queries';
import type { ConversationMode, CreateAgentRequest } from '../../lib/cursor/types';
import { usePrefs } from '../../storage/usePrefs';
import { colors, spacing } from '../../theme';
import { Button, Field } from '../../ui/primitives';

type SourceMode = 'repo' | 'env' | 'none';

export default function ComposeScreen() {
  const router = useRouter();
  const { prefs } = usePrefs();
  const models = useModels();
  const repos = useRepositories();
  const create = useCreateAgent();

  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [source, setSource] = useState<SourceMode>('repo');
  const [repoUrl, setRepoUrl] = useState(prefs?.recentRepos[0] ?? '');
  const [startingRef, setStartingRef] = useState(prefs?.defaultBranch ?? 'main');
  const [envName, setEnvName] = useState(prefs?.defaultEnvName ?? '');
  const [autoCreatePR, setAutoCreatePR] = useState(prefs?.defaultAutoCreatePR ?? true);
  const [workOnCurrentBranch, setWorkOnCurrentBranch] = useState(false);
  const [mode, setMode] = useState<ConversationMode>(prefs?.defaultMode ?? 'agent');
  const [modelId, setModelId] = useState(prefs?.defaultModelId ?? '');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!prefs || hydrated) return;
    setRepoUrl(prefs.recentRepos[0] ?? '');
    setStartingRef(prefs.defaultBranch);
    setEnvName(prefs.defaultEnvName ?? '');
    setAutoCreatePR(prefs.defaultAutoCreatePR);
    setMode(prefs.defaultMode);
    setModelId(prefs.defaultModelId ?? '');
    setHydrated(true);
  }, [prefs, hydrated]);

  const suggestions = useMemo(() => {
    const recent = prefs?.recentRepos ?? [];
    const cached = (repos.data?.items ?? prefs?.cachedRepos ?? []).map((item) => item.url);
    return [...recent, ...cached.filter((url) => !recent.includes(url))].slice(0, 8);
  }, [prefs, repos.data]);

  async function onAttach() {
    try {
      const next = await pickImages(images.length);
      setImages((current) => [...current, ...next]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法选择图片');
    }
  }

  async function onSubmit() {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError('请填写任务说明');
      return;
    }
    const body: Omit<CreateAgentRequest, 'agentId'> = {
      prompt: {
        text: trimmed,
        images: images.length ? await toPromptImages(images) : undefined,
      },
      name: name.trim() || undefined,
      autoCreatePR: source === 'repo' ? autoCreatePR : undefined,
      workOnCurrentBranch: source === 'repo' ? workOnCurrentBranch : undefined,
      mode,
      model: modelId ? { id: modelId } : undefined,
    };
    if (source === 'repo') {
      if (!repoUrl.trim()) {
        setError('请填写仓库 URL，或改选环境 / 无仓库');
        return;
      }
      body.repos = [{ url: repoUrl.trim(), startingRef: startingRef.trim() || undefined }];
    } else if (source === 'env') {
      if (!envName.trim()) {
        setError('请填写云端环境名（没有列出接口，需手输并记住）');
        return;
      }
      body.env = { type: 'cloud', name: envName.trim() };
    }

    try {
      const result = await create.mutateAsync(body);
      setText('');
      setImages([]);
      router.push(`/agent/${result.agent.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="任务说明"
          value={text}
          onChangeText={setText}
          placeholder="希望云端 Agent 做什么"
          multiline
          autoCapitalize="sentences"
        />
        <Field label="名称（可选）" value={name} onChangeText={setName} placeholder="留空则由服务端生成" />

        <Text style={styles.section}>来源</Text>
        <View style={styles.chips}>
          <Chip label="仓库" active={source === 'repo'} onPress={() => setSource('repo')} />
          <Chip label="云端环境" active={source === 'env'} onPress={() => setSource('env')} />
          <Chip label="无仓库" active={source === 'none'} onPress={() => setSource('none')} />
        </View>

        {source === 'repo' ? (
          <>
            <Field
              label="仓库 URL"
              value={repoUrl}
              onChangeText={setRepoUrl}
              placeholder="https://github.com/org/repo"
            />
            {suggestions.length > 0 ? (
              <View style={styles.chips}>
                {suggestions.map((url) => (
                  <Chip key={url} label={url.replace('https://github.com/', '')} active={repoUrl === url} onPress={() => setRepoUrl(url)} />
                ))}
              </View>
            ) : null}
            <Field label="startingRef" value={startingRef} onChangeText={setStartingRef} placeholder="main" />
            <ToggleRow label="完成后自动开 PR" value={autoCreatePR} onValueChange={setAutoCreatePR} />
            <ToggleRow label="直接推送到当前分支" value={workOnCurrentBranch} onValueChange={setWorkOnCurrentBranch} />
          </>
        ) : null}

        {source === 'env' ? (
          <Field
            label="环境名"
            value={envName}
            onChangeText={setEnvName}
            placeholder={prefs?.defaultEnvName || '例如 personal-dev'}
          />
        ) : null}

        <Text style={styles.section}>模式</Text>
        <View style={styles.chips}>
          <Chip label="agent" active={mode === 'agent'} onPress={() => setMode('agent')} />
          <Chip label="plan" active={mode === 'plan'} onPress={() => setMode('plan')} />
        </View>

        <Text style={styles.section}>模型（可选，空白=账号默认）</Text>
        <View style={styles.chips}>
          <Chip label="默认" active={!modelId} onPress={() => setModelId('')} />
          {(models.data?.items ?? []).map((model) => (
            <Chip
              key={model.id}
              label={model.displayName || model.id}
              active={modelId === model.id}
              onPress={() => setModelId(model.id)}
            />
          ))}
        </View>

        <Text style={styles.section}>图片（最多 5 张，各 15MB）</Text>
        {images.map((image) => (
          <View key={image.uri} style={styles.imageRow}>
            <Text style={styles.imageName} numberOfLines={1}>
              {image.fileName}
            </Text>
            <Pressable onPress={() => setImages((current) => current.filter((item) => item.uri !== image.uri))}>
              <Text style={styles.remove}>移除</Text>
            </Pressable>
          </View>
        ))}
        <Button title="附加图片" variant="ghost" onPress={() => void onAttach()} disabled={images.length >= 5} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="发送任务" onPress={() => void onSubmit()} loading={create.isPending} disabled={!text.trim()} />
        <Text style={styles.hint}>
          创建成功后，网页和桌面打开同一条 cursor.com/agents/bc-... 即可看到。本机不另存一份对话。
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accentMuted, false: colors.border }}
        thumbColor={value ? colors.accent : colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 48 },
  section: { color: colors.muted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  chipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 13 },
  chipTextActive: { color: colors.text },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: colors.text, fontSize: 15 },
  imageRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  imageName: { color: colors.text, flex: 1 },
  remove: { color: colors.danger },
  error: { color: colors.danger },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
