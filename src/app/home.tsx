import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { agentSubtitle, agentTitle, initials, statusGlyph } from '../features/agents/display';
import { pickImages, toPromptImages, type PickedImage } from '../features/agents/images';
import { useAgentList, useCreateAgent, useModels, useRepositories } from '../features/agents/queries';
import { useAuth } from '../features/auth/AuthContext';
import type { AgentListItem, ConversationMode, CreateAgentRequest } from '../lib/cursor/types';
import { dateGroup, dateGroupLabel, formatRelative, type DateGroup } from '../lib/format';
import { usePrefs } from '../storage/usePrefs';
import { colors, spacing } from '../theme';
import { useVoiceInput } from '../features/speech/useVoiceInput';
import { Composer } from '../ui/composer';
import { AvatarButton } from '../ui/primitives';
import { ActionSheet } from '../ui/sheet';

type SourceMode = 'none' | 'repo' | 'env';
type Picker = 'model' | 'source' | null;

const GROUP_ORDER: DateGroup[] = ['today', 'yesterday', 'week', 'older'];

export default function AgentsHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { me } = useAuth();
  const { prefs } = usePrefs();
  const models = useModels();
  const repos = useRepositories();
  const create = useCreateAgent();
  const list = useAgentList({ includeArchived: false, enabled: focused });
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);

  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [source, setSource] = useState<SourceMode>('none');
  const [repoUrl, setRepoUrl] = useState('');
  const [envName, setEnvName] = useState('');
  const [modelId, setModelId] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const voice = useVoiceInput(text, setText);

  useEffect(() => {
    if (!prefs || hydrated) return;
    setRepoUrl(prefs.recentRepos[0] ?? '');
    setEnvName(prefs.defaultEnvName ?? '');
    setModelId(prefs.defaultModelId ?? '');
    setSource(prefs.recentRepos[0] ? 'repo' : prefs.defaultEnvName ? 'env' : 'none');
    setHydrated(true);
  }, [prefs, hydrated]);

  const modelOptions = useMemo(
    () => [
      { id: '', label: '默认模型', hint: '交给 Cloud 选' },
      ...(models.data?.items ?? []).map((item) => ({
        id: item.id,
        label: item.displayName || item.id,
        hint: item.description,
      })),
    ],
    [models.data],
  );

  const modelLabel = useMemo(() => {
    if (!modelId) return '默认模型';
    const match = models.data?.items.find((item) => item.id === modelId);
    return match?.displayName || modelId;
  }, [modelId, models.data]);

  const suggestions = useMemo(() => {
    const recent = prefs?.recentRepos ?? [];
    const cached = (repos.data?.items ?? prefs?.cachedRepos ?? []).map((item) => item.url);
    return [...recent, ...cached.filter((url) => !recent.includes(url))].slice(0, 6);
  }, [prefs, repos.data]);

  const sections = useMemo(() => {
    const filtered = query.trim()
      ? items.filter((item) => agentTitle(item).toLowerCase().includes(query.trim().toLowerCase()))
      : items;
    const buckets = new Map<DateGroup, AgentListItem[]>();
    for (const item of filtered) {
      const group = dateGroup(item.updatedAt);
      const current = buckets.get(group) ?? [];
      current.push(item);
      buckets.set(group, current);
    }
    return GROUP_ORDER.filter((group) => (buckets.get(group) ?? []).length > 0).map((group) => ({
      title: dateGroupLabel(group),
      data: buckets.get(group) ?? [],
    }));
  }, [items, query]);

  async function onSubmit() {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) return;
    const body: Omit<CreateAgentRequest, 'agentId'> = {
      prompt: {
        text: trimmed,
        images: images.length ? await toPromptImages(images) : undefined,
      },
      autoCreatePR: source === 'repo' ? (prefs?.defaultAutoCreatePR ?? true) : undefined,
      mode: (prefs?.defaultMode ?? 'agent') as ConversationMode,
      model: modelId ? { id: modelId } : undefined,
    };
    if (source === 'repo') {
      if (!repoUrl.trim()) {
        setError('先选一个仓库，或改成从零开始');
        return;
      }
      body.repos = [{ url: repoUrl.trim(), startingRef: prefs?.defaultBranch || 'main' }];
    } else if (source === 'env') {
      if (!envName.trim()) {
        setError('填写环境名，或改成从零开始');
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
      setError(err instanceof Error ? err.message : '发送失败');
    }
  }

  const sourceLabel = source === 'repo' ? '指定仓库' : source === 'env' ? '云端环境' : '从零开始';
  const avatar = initials(
    [me?.userFirstName, me?.userLastName].filter(Boolean).join('') || me?.apiKeyName,
    me?.userEmail,
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>Agents</Text>
          <AvatarButton label={avatar} onPress={() => router.push('/settings')} />
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} />
          }
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <Composer
                value={text}
                onChangeText={setText}
                placeholder="让 Agent 构建、修 bug、探索…"
                onSubmit={() => void onSubmit()}
                submitting={create.isPending}
                modelLabel={modelLabel}
                onModelPress={() => setPicker('model')}
                onAttach={() => {
                  void pickImages(images.length)
                    .then((next) => setImages((current) => [...current, ...next]))
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : '无法选择图片'));
                }}
                attachLabel={images.length ? images.map((item) => item.fileName).join(' · ') : undefined}
                listening={voice.listening}
                onMicStart={voice.onMicStart}
                onMicEnd={voice.onMicEnd}
                hint={voice.error ?? undefined}
              >
                <View style={styles.sourceRow}>
                  <Pressable accessibilityRole="button" onPress={() => setPicker('source')} style={styles.sourceChip}>
                    <Text style={styles.sourceText}>{sourceLabel} ▾</Text>
                  </Pressable>
                </View>
                {source === 'repo' ? (
                  <View style={styles.extra}>
                    <TextInput
                      value={repoUrl}
                      onChangeText={setRepoUrl}
                      placeholder="github.com/org/repo"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                      style={styles.extraInput}
                    />
                    <View style={styles.chips}>
                      {suggestions.map((url) => (
                        <Pressable key={url} onPress={() => setRepoUrl(url)} style={styles.miniChip}>
                          <Text style={styles.miniChipText}>{url.replace('https://github.com/', '')}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                {source === 'env' ? (
                  <TextInput
                    value={envName}
                    onChangeText={setEnvName}
                    placeholder="环境名"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    style={styles.extraInput}
                  />
                ) : null}
              </Composer>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{sections[0]?.title ?? '最近'}</Text>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="搜索"
                  placeholderTextColor={colors.muted}
                  style={styles.search}
                />
              </View>
            </View>
          }
          renderSectionHeader={({ section }) =>
            section.title === sections[0]?.title ? null : <Text style={styles.groupTitle}>{section.title}</Text>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/agent/${item.id}`)}>
              <Text style={[styles.glyph, item.status === 'ACTIVE' && styles.live]}>{statusGlyph(item.status)}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {agentTitle(item)}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {agentSubtitle(item)}
                </Text>
              </View>
              {item.status === 'ACTIVE' ? <View style={styles.dot} /> : null}
              <Text style={styles.time}>{formatRelative(item.updatedAt)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            list.isLoading ? (
              <ActivityIndicator color={colors.muted} style={{ marginTop: 24 }} />
            ) : (
              <Text style={styles.empty}>还没有任务。在上面说一句就开始。</Text>
            )
          }
          ListFooterComponent={
            list.isFetchingNextPage ? <ActivityIndicator color={colors.muted} style={{ marginVertical: 16 }} /> : null
          }
        />
      </View>
      <ActionSheet
        visible={picker === 'model'}
        title="选择模型"
        message="只在新建任务时生效。追问会沿用这条任务的模型。"
        items={modelOptions}
        onClose={() => setPicker(null)}
        onSelect={setModelId}
      />
      <ActionSheet
        visible={picker === 'source'}
        title="任务从哪开始"
        items={[
          { id: 'none', label: '从零开始', hint: '不绑仓库' },
          { id: 'repo', label: '指定仓库', hint: '在这个 Git 仓库里改' },
          { id: 'env', label: '云端环境', hint: '用已有 Cloud 环境' },
        ]}
        onClose={() => setPicker(null)}
        onSelect={(id) => setSource(id as SourceMode)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { color: colors.text, fontSize: 18, fontWeight: '600' },
  list: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  headerBlock: { gap: 12, paddingBottom: 8 },
  sourceRow: { flexDirection: 'row' },
  sourceChip: {
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sourceText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  extra: { gap: 8 },
  extraInput: {
    color: colors.text,
    fontSize: 14,
    paddingVertical: 4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniChip: {
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniChipText: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 13 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  search: {
    minWidth: 88,
    textAlign: 'right',
    color: colors.text,
    fontSize: 14,
  },
  groupTitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  glyph: { width: 18, textAlign: 'center', color: colors.muted, fontSize: 14 },
  live: { color: colors.live },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowMeta: { color: colors.muted, fontSize: 13 },
  time: { color: colors.muted, fontSize: 13 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 28, lineHeight: 22 },
});
