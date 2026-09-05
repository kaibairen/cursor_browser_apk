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
import {
  groupByProject,
  normalizeRepoUrl,
  projectOf,
  repoShortName,
  useHydrateAgentProjects,
} from '../features/agents/projects';
import { useAgentList, useCreateAgent, useModels, useRepositories } from '../features/agents/queries';
import { useAuth } from '../features/auth/AuthContext';
import { accountName } from '../features/settings/identity';
import type { ConversationMode, CreateAgentRequest } from '../lib/cursor/types';
import { formatRelative } from '../lib/format';
import { usePrefs } from '../storage/usePrefs';
import { colors, spacing } from '../theme';
import { useVoiceInput } from '../features/speech/useVoiceInput';
import { Composer } from '../ui/composer';
import { AccountMenuPopover, SETTINGS_HREF } from '../ui/accountMenu';
import { AvatarButton } from '../ui/primitives';
import { ActionSheet } from '../ui/sheet';

type Picker = 'model' | 'repo' | null;

export default function AgentsHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { me, signOut } = useAuth();
  const { prefs } = usePrefs();
  const models = useModels();
  const repos = useRepositories();
  const create = useCreateAgent();
  const list = useAgentList({ includeArchived: false, enabled: focused });
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);

  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [envName, setEnvName] = useState('');
  const [modelId, setModelId] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const voice = useVoiceInput(text, setText);
  const projects = useHydrateAgentProjects(items);

  useEffect(() => {
    if (!prefs || hydrated) return;
    setRepoUrl(prefs.recentRepos[0] ?? '');
    setEnvName('');
    setModelId(prefs.defaultModelId ?? '');
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

  const repoOptions = useMemo(() => {
    const recent = prefs?.recentRepos ?? [];
    const cached = (repos.data?.items ?? prefs?.cachedRepos ?? []).map((item) => item.url);
    const urls = [...recent, ...cached.filter((url) => !recent.includes(url))].slice(0, 12);
    const options = [
      { id: '', label: '从零开始', hint: '不绑仓库' },
      ...urls.map((url) => ({ id: url, label: repoShortName(url), hint: url })),
    ];
    if (prefs?.defaultEnvName) {
      options.push({ id: `env:${prefs.defaultEnvName}`, label: prefs.defaultEnvName, hint: '云端环境' });
    }
    return options;
  }, [prefs, repos.data]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((item) => {
          const project = projectOf(item, projects);
          return (
            agentTitle(item).toLowerCase().includes(q) ||
            project.title.toLowerCase().includes(q)
          );
        })
      : items;
    return groupByProject(filtered, (item) => projectOf(item, projects));
  }, [items, query, projects]);

  async function onSubmit() {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) return;
    const body: Omit<CreateAgentRequest, 'agentId'> = {
      prompt: {
        text: trimmed,
        images: images.length ? await toPromptImages(images) : undefined,
      },
      autoCreatePR: repoUrl.trim() ? (prefs?.defaultAutoCreatePR ?? true) : undefined,
      mode: (prefs?.defaultMode ?? 'agent') as ConversationMode,
      model: modelId ? { id: modelId } : undefined,
    };
    if (envName.trim()) {
      body.env = { type: 'cloud', name: envName.trim() };
    } else if (repoUrl.trim()) {
      body.repos = [{ url: normalizeRepoUrl(repoUrl), startingRef: prefs?.defaultBranch || 'main' }];
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

  const repoLabel = envName.trim() ? envName.trim() : repoUrl.trim() ? repoShortName(repoUrl) : '从零开始';
  const avatar = initials(
    [me?.userFirstName, me?.userLastName].filter(Boolean).join('') || me?.apiKeyName,
    me?.userEmail,
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>Agents</Text>
          <AvatarButton label={avatar} onPress={() => setMenuOpen(true)} />
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
                repoLabel={repoLabel}
                onRepoPress={() => setPicker('repo')}
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
              />
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
                  {agentSubtitle(item, projectOf(item, projects).title)}
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
        visible={picker === 'repo'}
        title="这次用哪个仓库"
        message="只对这一条对话生效。列表会按项目分开。"
        items={repoOptions}
        onClose={() => setPicker(null)}
        onSelect={(id) => {
          if (id.startsWith('env:')) {
            setEnvName(id.slice(4));
            setRepoUrl('');
            return;
          }
          setEnvName('');
          setRepoUrl(id);
        }}
      />
      <AccountMenuPopover
        visible={menuOpen}
        name={accountName(me)}
        email={me?.userEmail ?? ''}
        onClose={() => setMenuOpen(false)}
        onItem={(id) => {
          setMenuOpen(false);
          if (id === 'logout') {
            void signOut();
            return;
          }
          router.push(SETTINGS_HREF[id]);
        }}
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
