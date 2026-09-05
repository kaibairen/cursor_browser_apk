import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '../../lib/nav';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fileName } from '../../features/agents/display';
import { repoShortName } from '../../features/agents/projects';
import { pickImages, toPromptImages, type PickedImage } from '../../features/agents/images';
import {
  isBusyError,
  useAgent,
  useArchiveAgent,
  useArtifacts,
  useCancelRun,
  useConversation,
  useCreateFollowUp,
  useDeleteAgent,
  useDownloadArtifact,
  useModels,
  useRun,
  useRuns,
  useUsage,
} from '../../features/agents/queries';
import { useRunStream } from '../../features/agents/useRunStream';
import {
  fetchArtifactUtf8,
  isOpenableArtifactPath,
  isTextArtifactPath,
  playbackUri,
} from '../../lib/cursor/client';
import { artifactMediaKind, assignChatMedia, ownerUserIndex } from '../../lib/cursor/artifactPath';
import { isTerminalRun, type ConversationMessage } from '../../lib/cursor/types';
import { formatBytes } from '../../lib/format';
import { colors, spacing } from '../../theme';
import {
  countUserTexts,
  isUserMessage,
  lastAssistantAfter,
  lastUserIndex,
  mergeConversation,
} from '../../features/agents/conversationView';
import { ArtifactViewer, type ArtifactView } from '../../ui/artifactViewer';
import { ChatLoading } from '../../ui/chatLoading';
import { ChatArtifactMedia } from '../../ui/chatArtifactMedia';
import { ChatText } from '../../ui/chatText';
import { TurnTimeline } from '../../ui/turnTimeline';
import { UserBubble } from '../../ui/userBubble';
import { Composer } from '../../ui/composer';
import { githubHttpsUrl, openExternal } from '../../ui/openUrl';
import { Segmented } from '../../ui/primitives';
import { ActionSheet } from '../../ui/sheet';
import { useVoiceInput } from '../../features/speech/useVoiceInput';
import { useNetworkDown } from '../../features/agents/useNetworkDown';
import { modelDisplayName, resolveStoredModelId } from '../../features/agents/models';
import { loadPrefs, rememberAgentModel } from '../../storage/prefs';
import { useQueryClient } from '@tanstack/react-query';

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const agentId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const goBack = useSafeBack('/home');
  const insets = useSafeAreaInsets();

  const agentQuery = useAgent(agentId);
  const agent = agentQuery.data;
  const latestRunId = agent?.latestRunId;
  const runQuery = useRun(agentId, latestRunId, true);
  const run = runQuery.data;
  const stream = useRunStream(agentId, latestRunId, run?.status);
  const runDone = Boolean(run && isTerminalRun(run.status));
  const live = Boolean((run && !isTerminalRun(run.status)) || (stream.live && !runDone));
  const conversation = useConversation(agentId, live);
  const proxyDown = useNetworkDown();
  const followUp = useCreateFollowUp(agentId);
  const cancel = useCancelRun(agentId);
  const archive = useArchiveAgent(agentId);
  const remove = useDeleteAgent();
  const usage = useUsage(agentId);
  const artifacts = useArtifacts(agentId, { live });
  const runs = useRuns(agentId);
  const download = useDownloadArtifact(agentId);
  const models = useModels();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'chat' | 'diff'>('chat');
  const [prompt, setPrompt] = useState('');
  const [pendingUsers, setPendingUsers] = useState<{ id: string; text: string; images?: PickedImage[] }[]>([]);
  const [keptThinking, setKeptThinking] = useState<{ text: string; durationMs?: number } | null>(null);
  const thinkingStarted = useRef<number | null>(null);
  const [modelId, setModelId] = useState('');
  const [modelPicker, setModelPicker] = useState(false);
  const modelReady = useRef(false);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [artifactView, setArtifactView] = useState<ArtifactView | null>(null);
  const [binaryUrl, setBinaryUrl] = useState<string | null>(null);
  const voice = useVoiceInput(prompt, setPrompt);
  const scrollRef = useRef<ScrollView>(null);
  const historyHold = useRef<ConversationMessage[]>([]);

  useEffect(() => {
    if (conversation.isFetching) return;
    const messages = conversation.data?.messages ?? [];
    if (!messages.length) return;
    setPendingUsers((current) => {
      const confirmed = countUserTexts(messages, { confirmedOnly: true });
      const seen = new Map<string, number>();
      return current.filter((item) => {
        const next = (seen.get(item.text) ?? 0) + 1;
        seen.set(item.text, next);
        return next > (confirmed.get(item.text) ?? 0);
      });
    });
  }, [conversation.data?.messages, conversation.isFetching]);

  useEffect(() => {
    modelReady.current = false;
    setModelId('');
    historyHold.current = [];
  }, [agentId]);

  useEffect(() => {
    const apiModel = agent?.model?.id || run?.model?.id;
    if (apiModel && apiModel !== modelId) {
      setModelId(apiModel);
      modelReady.current = true;
      if (agentId) void rememberAgentModel(agentId, apiModel);
      return;
    }
    if (modelReady.current && modelId) return;
    let cancelled = false;
    void loadPrefs().then((prefs) => {
      if (cancelled) return;
      const next = resolveStoredModelId(
        apiModel || prefs.agentProjects?.[agentId]?.modelId,
        prefs.defaultModelId,
        models.data?.items,
      );
      if (!next) return;
      setModelId(next);
      modelReady.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [agentId, agent?.model?.id, run?.model?.id, modelId, models.data?.items]);

  useEffect(() => {
    if (!(live || followUp.isPending)) return;
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [live, followUp.isPending, stream.lines, conversation.data?.messages?.length, pendingUsers.length]);

  useEffect(() => {
    const stored = queryClient.getQueryData<{ text: string; durationMs?: number }>(['thinking', agentId]);
    setKeptThinking(stored ?? null);
    thinkingStarted.current = stored ? thinkingStarted.current ?? Date.now() : null;
  }, [agentId, queryClient]);

  useEffect(() => {
    if (!run || isTerminalRun(run.status)) return;
    thinkingStarted.current = thinkingStarted.current ?? Date.now();
    setKeptThinking((current) => current ?? { text: '' });
  }, [run, run?.id, run?.status]);

  useEffect(() => {
    const thinking = [...stream.lines].reverse().find((line) => line.kind === 'thinking');
    if (!thinking || thinking.kind !== 'thinking') return;
    const durationMs =
      thinking.durationMs ??
      (thinking.done && thinkingStarted.current ? Date.now() - thinkingStarted.current : undefined);
    setKeptThinking({ text: thinking.text, durationMs });
  }, [stream.lines]);

  useEffect(() => {
    if (live || followUp.isPending || !keptThinking || keptThinking.durationMs != null) return;
    if (!thinkingStarted.current) return;
    const durationMs = Date.now() - thinkingStarted.current;
    setKeptThinking((current) => (current ? { ...current, durationMs } : current));
  }, [followUp.isPending, keptThinking, live]);

  useEffect(() => {
    if (!keptThinking || !agentId) return;
    queryClient.setQueryData(['thinking', agentId], keptThinking);
  }, [agentId, keptThinking, queryClient]);

  const usageText = useMemo(() => {
    if (!usage.data) return '还没拉到用量。';
    const total = usage.data.totalUsage;
    return `一共 ${total.totalTokens.toLocaleString()} tokens\n输入 ${total.inputTokens.toLocaleString()} · 输出 ${total.outputTokens.toLocaleString()}`;
  }, [usage.data]);

  async function onFollowUp() {
    setError(null);
    const text = prompt.trim();
    if (!text) return;
    const pendingId = `pending-${Date.now()}`;
    const keptImages = images;
    setPendingUsers((current) => [...current, { id: pendingId, text, images: keptImages }]);
    thinkingStarted.current = Date.now();
    setKeptThinking({ text: '' });
    setPrompt('');
    setImages([]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    try {
      await followUp.mutateAsync({
        prompt: { text, images: keptImages.length ? await toPromptImages(keptImages) : undefined },
        model: modelId ? { id: modelId } : undefined,
      });
    } catch (err) {
      setPendingUsers((current) => current.filter((item) => item.id !== pendingId));
      setKeptThinking(null);
      thinkingStarted.current = null;
      setPrompt(text);
      setImages(keptImages);
      if (isBusyError(err)) {
        setError('先点停止，再发下一条。');
        return;
      }
      setError(err instanceof Error ? err.message : '发送失败');
    }
  }

  async function openArtifact(path: string) {
    const title = fileName(path);
    setBinaryUrl(null);
    setArtifactView({ status: 'loading', title });
    try {
      const file = await download.mutateAsync(path);
      const media = artifactMediaKind(path);
      if (media) {
        setArtifactView({ status: media, title, uri: playbackUri(media, file.url) });
        return;
      }
      if (isTextArtifactPath(path)) {
        const text = await fetchArtifactUtf8(file.url);
        setArtifactView({ status: 'markdown', title, text });
        return;
      }
      setBinaryUrl(file.url);
      setArtifactView({
        status: 'binary',
        title,
        hint: '这种文件没法在应用里预览，会打开系统浏览器。',
      });
    } catch (err) {
      setArtifactView({
        status: 'error',
        title,
        message: err instanceof Error ? err.message : '无法打开文件',
      });
    }
  }

  if (agentQuery.isError && !agent) {
    return (
      <View style={[styles.padded, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={goBack}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.error}>
          {agentQuery.error instanceof Error ? agentQuery.error.message : '加载失败'}
        </Text>
      </View>
    );
  }

  const serverMessages = conversation.data?.messages ?? [];
  const incoming = mergeConversation(
    serverMessages,
    pendingUsers.map((item) => ({ id: item.id, type: 'user_message', text: item.text })),
  );
  const history = mergeConversation(incoming, historyHold.current);
  if (
    history.length > historyHold.current.length ||
    history.filter((item) => !isUserMessage(item)).length >=
      historyHold.current.filter((item) => !isUserMessage(item)).length
  ) {
    historyHold.current = history;
  }
  const hasLocalSend = pendingUsers.length > 0;
  const hasUser = history.some(isUserMessage);
  const conversationReady = conversation.isSuccess || conversation.isError;
  const showChatSpinner = !hasLocalSend && history.length === 0 && conversation.isLoading;
  const streamAssistant = stream.lines.find((line) => line.kind === 'assistant' && line.text);
  const streamThinking = stream.lines.find((line) => line.kind === 'thinking');
  const thinkingBusy =
    streamThinking?.kind === 'thinking' && Boolean(streamThinking.text) && !streamThinking.done;
  const showLiveAssistant = Boolean(streamAssistant) || (stream.live && hasUser);
  const waitingForFirstToken =
    !runDone && hasUser && (stream.live || followUp.isPending) && !streamAssistant && !thinkingBusy;
  const thinkingDone =
    runDone ||
    Boolean(keptThinking && !live && !followUp.isPending) ||
    (streamThinking?.kind === 'thinking' && streamThinking.done);
  const showThinking =
    Boolean(keptThinking) ||
    waitingForFirstToken ||
    streamThinking?.kind === 'thinking' ||
    (!runDone && stream.live && hasUser) ||
    followUp.isPending;
  const latestUserIndex = lastUserIndex(history);
  const latestAssistantIndex = lastAssistantAfter(history, latestUserIndex);
  const chatEmpty =
    !showChatSpinner &&
    conversationReady &&
    !conversation.isError &&
    history.length === 0 &&
    stream.lines.length === 0 &&
    !run?.result;
  const conversationError =
    conversation.isError && conversation.error instanceof Error ? conversation.error.message : null;
  const agentRefreshError =
    agentQuery.isError && agent && agentQuery.error instanceof Error ? agentQuery.error.message : null;
  const machineHint =
    chatEmpty && agent?.env?.type === 'machine'
      ? '这条任务跑在本机 worker 上。公开 Cloud API 读不到 Remote Control 对话。'
      : null;
  const showResultFallback =
    conversationReady &&
    !showLiveAssistant &&
    !history.some((item) => !isUserMessage(item)) &&
    Boolean(run?.result);
  const moreItems = [
    { id: 'web', label: '在浏览器打开', hint: '打开网页上的同一条任务' },
    ...(live && latestRunId ? [{ id: 'stop', label: '停止这一轮', hint: '取消当前正在写的回复' }] : []),
    {
      id: 'archive',
      label: agent?.status === 'ARCHIVED' ? '取消归档' : '归档',
      hint: agent?.status === 'ARCHIVED' ? '重新出现在列表里' : '从列表里收起来',
    },
    { id: 'usage', label: '用量', hint: usage.data ? `${usage.data.totalUsage.totalTokens.toLocaleString()} tokens` : '看这轮花了多少' },
    { id: 'delete', label: '删除', hint: '删掉后不能恢复', destructive: true },
  ];
  const pendingById = new Map(pendingUsers.map((item) => [item.id, item]));
  const chatMedia = assignChatMedia(artifacts.data?.items ?? [], history, runs.data?.items ?? []);
  const mediaByUser = chatMedia.byUserIndex ?? {};
  const orphanMedia = chatMedia.orphan ?? chatMedia.leftover ?? [];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.flex, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={goBack} hitSlop={12}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {agent?.name || '任务'}
            </Text>
            <Text style={styles.project} numberOfLines={1}>
              {agent?.repos?.[0]?.url
                ? repoShortName(agent.repos[0].url)
                : agent?.env?.name || '未绑定仓库'}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setMenuOpen(true)} hitSlop={12}>
            <Text style={styles.more}>•••</Text>
          </Pressable>
        </View>
        <View style={styles.tabs}>
          <Segmented
            value={tab}
            onChange={(next) => setTab(next as 'chat' | 'diff')}
            options={[
              { id: 'chat', label: 'Chat' },
              { id: 'diff', label: 'Diff' },
            ]}
          />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'chat' ? (
            <View style={styles.chat}>
              {showChatSpinner && stream.lines.length === 0 && !keptThinking ? (
                <ChatLoading label="加载对话…" />
              ) : null}
              {proxyDown ? (
                <Text style={styles.meta}>网页代理断了，正在重连。连上后会一次拉齐已完成的回复。</Text>
              ) : null}
              {agentRefreshError ? <Text style={styles.error}>{agentRefreshError}</Text> : null}
              {conversationError ? <Text style={styles.error}>{conversationError}</Text> : null}
              {stream.streamError ? <Text style={styles.error}>{stream.streamError}</Text> : null}
              {machineHint ? <Text style={styles.meta}>{machineHint}</Text> : null}
              {chatEmpty ? (
                <Text style={styles.meta}>{live ? '等第一段回复。' : '还没有文字结果。'}</Text>
              ) : null}
              {!showChatSpinner
                ? history.map((item, index) => {
                    const hideHistoryAssistant =
                      Boolean(streamAssistant) && !isUserMessage(item) && index === latestAssistantIndex;
                    if (hideHistoryAssistant) return null;
                    if (isUserMessage(item)) {
                      const next = history[index + 1];
                      const nextIsHiddenAssistant =
                        Boolean(next) &&
                        !isUserMessage(next) &&
                        Boolean(streamAssistant) &&
                        index + 1 === latestAssistantIndex;
                      const showMediaHere =
                        (!next || isUserMessage(next) || nextIsHiddenAssistant) &&
                        !(showResultFallback && index === latestUserIndex);
                      return (
                        <View key={`u:${index}:${item.text}`} style={styles.turn}>
                          <UserBubble text={item.text} images={pendingById.get(item.id)?.images} />
                          {index === latestUserIndex ? (
                            <TurnTimeline
                              lines={stream.lines}
                              keptThinking={keptThinking}
                              live={stream.live && !runDone}
                              thinkingDone={thinkingDone && !thinkingBusy}
                            />
                          ) : null}
                          {showMediaHere ? (
                            <ChatArtifactMedia
                              agentId={agentId ?? ''}
                              items={mediaByUser[index] ?? []}
                              onOpen={(path) => void openArtifact(path)}
                            />
                          ) : null}
                        </View>
                      );
                    }
                    const owner = ownerUserIndex(history, index);
                    const next = history[index + 1];
                    const showMediaHere = !next || isUserMessage(next);
                    return (
                      <View key={`a:${index}:${item.id}`} style={styles.turn}>
                        <ChatText text={item.text} />
                        {showMediaHere ? (
                          <ChatArtifactMedia
                            agentId={agentId ?? ''}
                            items={mediaByUser[owner] ?? []}
                            onOpen={(path) => void openArtifact(path)}
                          />
                        ) : null}
                      </View>
                    );
                  })
                : null}
              {(!showChatSpinner && latestUserIndex < 0) ||
              (showChatSpinner && (stream.lines.length > 0 || Boolean(keptThinking))) ? (
                <>
                  <TurnTimeline
                    lines={stream.lines}
                    keptThinking={showThinking ? keptThinking : null}
                    live={stream.live && !runDone}
                    thinkingDone={thinkingDone && !thinkingBusy}
                  />
                  <ChatArtifactMedia
                    agentId={agentId ?? ''}
                    items={orphanMedia}
                    onOpen={(path) => void openArtifact(path)}
                  />
                </>
              ) : null}
              {!showChatSpinner && showResultFallback && run?.result ? <ChatText text={run.result} /> : null}
              {!showChatSpinner && showResultFallback && latestUserIndex >= 0 ? (
                <ChatArtifactMedia
                  agentId={agentId ?? ''}
                  items={mediaByUser[latestUserIndex] ?? []}
                  onOpen={(path) => void openArtifact(path)}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.chat}>
              {(run?.git?.branches ?? []).map((branch) => (
                <Pressable
                  key={`${branch.repoUrl}-${branch.prUrl ?? branch.branch}`}
                  onPress={() => void openExternal(branch.prUrl || githubHttpsUrl(branch.repoUrl))}
                  style={styles.diffRow}
                >
                  <Text style={styles.diffTitle}>{branch.prUrl ? 'Pull request' : '分支'}</Text>
                  <Text style={styles.link}>{branch.prUrl || branch.branch || branch.repoUrl}</Text>
                  <Text style={styles.meta}>会打开系统浏览器看 GitHub</Text>
                </Pressable>
              ))}
              {(artifacts.data?.items ?? []).map((item) => (
                <Pressable key={item.path} style={styles.diffRow} onPress={() => void openArtifact(item.path)}>
                  <Text style={styles.diffTitle}>{fileName(item.path)}</Text>
                  <Text style={styles.meta}>
                    {formatBytes(item.sizeBytes)}
                    {isOpenableArtifactPath(item.path) ? ' · 应用内打开' : ' · 可能要去浏览器'}
                  </Text>
                </Pressable>
              ))}
              {!run?.git?.branches?.length && !artifacts.data?.items.length ? (
                <Text style={styles.meta}>还没有代码变更或文件。</Text>
              ) : null}
            </View>
          )}
        </ScrollView>

        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {agent?.status === 'ARCHIVED' ? (
            <Text style={styles.meta}>已归档。打开右上角可以恢复。</Text>
          ) : (
            <Composer
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Add a follow up"
              onSubmit={() => void onFollowUp()}
              submitting={followUp.isPending}
              onStop={
                latestRunId && (live || cancel.isPending)
                  ? () => {
                      void cancel.mutateAsync(latestRunId).catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : '无法停止');
                      });
                      stream.stop();
                    }
                  : undefined
              }
              stopping={cancel.isPending}
              modelLabel={modelDisplayName(modelId, models.data?.items) || '选择模型'}
              onModelPress={() => setModelPicker(true)}
              hint={voice.error ?? undefined}
              listening={voice.listening}
              onMicStart={voice.onMicStart}
              onMicEnd={voice.onMicEnd}
              onAttach={() => {
                void pickImages(images.length)
                  .then((next) => setImages((current) => [...current, ...next]))
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : '无法选择图片'));
              }}
              attachLabel={images.length ? images.map((item) => item.fileName).join(' · ') : undefined}
            />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>

      <ActionSheet
        visible={modelPicker}
        title="选择模型"
        message="这一轮追问用下面列出的模型。芯片上就是当前这条任务在用的模型。"
        items={(models.data?.items ?? []).map((item) => ({
          id: item.id,
          label: item.displayName || item.id,
          hint: item.description,
        }))}
        selectedId={modelId}
        onClose={() => setModelPicker(false)}
        onSelect={(id) => {
          setModelId(id);
          void rememberAgentModel(agentId, id);
        }}
      />
      <ActionSheet
        visible={menuOpen}
        title={agent?.name || '任务'}
        items={moreItems}
        onClose={() => setMenuOpen(false)}
        onSelect={(id) => {
          if (id === 'web' && agent) {
            void openExternal(agent.url);
            return;
          }
          if (id === 'stop' && latestRunId) {
            void cancel.mutateAsync(latestRunId).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : '无法停止');
            });
            return;
          }
          if (id === 'archive' && agent) {
            void archive.mutateAsync(agent.status === 'ARCHIVED');
            return;
          }
          if (id === 'usage') {
            void usage.refetch();
            setUsageOpen(true);
            return;
          }
          if (id === 'delete') {
            setConfirmDelete(true);
          }
        }}
      />
      <ActionSheet
        visible={usageOpen}
        title="用量"
        message={usageText}
        items={[]}
        onClose={() => setUsageOpen(false)}
        onSelect={() => undefined}
      />
      <ActionSheet
        visible={confirmDelete}
        title="删除任务"
        message="删除后不能恢复。"
        items={[{ id: 'yes', label: '删除', destructive: true }]}
        onClose={() => setConfirmDelete(false)}
        onSelect={() => {
          void remove.mutateAsync(agentId).then(() => router.replace('/home'));
        }}
      />
      <ArtifactViewer
        view={artifactView}
        onClose={() => {
          setArtifactView(null);
          setBinaryUrl(null);
        }}
        onOpenExternal={binaryUrl ? () => void openExternal(binaryUrl) : undefined}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  padded: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  backIcon: { color: colors.text, fontSize: 28, lineHeight: 30, width: 24 },
  back: { color: colors.text, fontSize: 16 },
  titleWrap: { flex: 1, alignItems: 'center', gap: 1 },
  title: { textAlign: 'center', color: colors.text, fontSize: 16, fontWeight: '600' },
  project: { textAlign: 'center', color: colors.muted, fontSize: 12 },
  more: { color: colors.text, fontSize: 16, width: 28, textAlign: 'right' },
  tabs: { paddingHorizontal: spacing.md, paddingBottom: 8, alignItems: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 24 },
  chat: { gap: 14, paddingTop: 8 },
  turn: { gap: 14 },
  liveText: { color: colors.text, fontSize: 16, lineHeight: 24 },
  caret: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  tool: { color: colors.muted, fontSize: 13 },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  link: { color: colors.link, fontSize: 15 },
  diffRow: { gap: 4, paddingVertical: 10 },
  diffTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  composerWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    backgroundColor: colors.bg,
    gap: 8,
  },
  error: { color: colors.danger, fontSize: 13 },
});
