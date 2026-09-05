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
import { fileName, toolLabel } from '../../features/agents/display';
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
  useUsage,
} from '../../features/agents/queries';
import { useRunStream } from '../../features/agents/useRunStream';
import {
  fetchArtifactUtf8,
  isImageArtifactPath,
  isTextArtifactPath,
} from '../../lib/cursor/client';
import { isTerminalRun } from '../../lib/cursor/types';
import { formatBytes } from '../../lib/format';
import { colors, spacing } from '../../theme';
import {
  countUserTexts,
  isUserMessage,
  mergePreservingLocalUsers,
} from '../../features/agents/conversationView';
import { ArtifactViewer, type ArtifactView } from '../../ui/artifactViewer';
import { ChatLoading } from '../../ui/chatLoading';
import { ChatText } from '../../ui/chatText';
import { ThinkingBlock } from '../../ui/thinkingBlock';
import { UserBubble } from '../../ui/userBubble';
import { Composer } from '../../ui/composer';
import { githubHttpsUrl, openExternal } from '../../ui/openUrl';
import { Segmented } from '../../ui/primitives';
import { ActionSheet } from '../../ui/sheet';
import { useVoiceInput } from '../../features/speech/useVoiceInput';

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
  const live = Boolean((run && !isTerminalRun(run.status)) || stream.live);
  const conversation = useConversation(agentId, live);
  const followUp = useCreateFollowUp(agentId);
  const cancel = useCancelRun(agentId);
  const archive = useArchiveAgent(agentId);
  const remove = useDeleteAgent();
  const usage = useUsage(agentId);
  const artifacts = useArtifacts(agentId);
  const download = useDownloadArtifact(agentId);
  const models = useModels();

  const [tab, setTab] = useState<'chat' | 'diff'>('chat');
  const [prompt, setPrompt] = useState('');
  const [pendingUsers, setPendingUsers] = useState<{ id: string; text: string }[]>([]);
  const [keptThinking, setKeptThinking] = useState<{ text: string; durationMs?: number } | null>(null);
  const thinkingStarted = useRef<number | null>(null);
  const [modelId, setModelId] = useState('');
  const [modelPicker, setModelPicker] = useState(false);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [artifactView, setArtifactView] = useState<ArtifactView | null>(null);
  const [binaryUrl, setBinaryUrl] = useState<string | null>(null);
  const voice = useVoiceInput(prompt, setPrompt);
  const scrollRef = useRef<ScrollView>(null);

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
    if (!(live || followUp.isPending || stream.lines.length)) return;
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [live, followUp.isPending, stream.lines, conversation.data?.messages?.length, pendingUsers.length]);

  useEffect(() => {
    const thinking = [...stream.lines].reverse().find((line) => line.kind === 'thinking');
    if (!thinking || thinking.kind !== 'thinking') return;
    const durationMs =
      thinking.durationMs ??
      (thinking.done && thinkingStarted.current ? Date.now() - thinkingStarted.current : undefined);
    setKeptThinking({ text: thinking.text, durationMs });
  }, [stream.lines]);

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
    setPendingUsers((current) => [...current, { id: pendingId, text }]);
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
      if (isImageArtifactPath(path)) {
        setArtifactView({ status: 'image', title, uri: file.url });
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
        <Text style={styles.error}>{agentQuery.error instanceof Error ? agentQuery.error.message : '加载失败'}</Text>
      </View>
    );
  }

  const serverMessages = conversation.data?.messages ?? [];
  const history = mergePreservingLocalUsers(
    serverMessages,
    pendingUsers.map((item) => ({ id: item.id, type: 'user_message', text: item.text })),
  );
  const hasLocalSend = pendingUsers.length > 0;
  const hasUser = history.some(isUserMessage);
  const conversationReady = conversation.isSuccess || conversation.isError;
  const showChatSpinner = !hasLocalSend && history.length === 0 && conversation.isLoading;
  const streamAssistant = stream.lines.find((line) => line.kind === 'assistant' && line.text);
  const streamThinking = stream.lines.find((line) => line.kind === 'thinking');
  const streamTools = stream.lines.filter((line) => line.kind === 'tool');
  const thinkingBusy =
    streamThinking?.kind === 'thinking' && Boolean(streamThinking.text) && !streamThinking.done;
  const showLiveAssistant = Boolean(streamAssistant) || (stream.live && hasUser);
  const waitingForFirstToken = hasUser && (stream.live || followUp.isPending) && !streamAssistant && !thinkingBusy;
  const thinkingDone =
    Boolean(keptThinking && !live && !followUp.isPending) ||
    (streamThinking?.kind === 'thinking' && streamThinking.done);
  const showThinking =
    Boolean(keptThinking) ||
    waitingForFirstToken ||
    streamThinking?.kind === 'thinking' ||
    (stream.live && hasUser);
  const chatEmpty =
    !showChatSpinner && conversationReady && history.length === 0 && stream.lines.length === 0 && !run?.result;
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
              {showChatSpinner ? <ChatLoading label="加载对话…" /> : null}
              {stream.streamError ? <Text style={styles.meta}>{stream.streamError}</Text> : null}
              {chatEmpty ? (
                <Text style={styles.meta}>{live ? '等第一段回复。' : '还没有文字结果。'}</Text>
              ) : null}
              {!showChatSpinner
                ? history.map((item, index) => {
                    const skipTrailingAssistant =
                      Boolean(streamAssistant) && !isUserMessage(item) && index === history.length - 1;
                    if (skipTrailingAssistant) return null;
                    if (isUserMessage(item)) {
                      return <UserBubble key={`u:${index}:${item.text}`} text={item.text} />;
                    }
                    return <ChatText key={`a:${index}:${item.id}`} text={item.text} />;
                  })
                : null}
              {!showChatSpinner && showThinking ? (
                <ThinkingBlock
                  text={
                    streamThinking?.kind === 'thinking' && streamThinking.text
                      ? streamThinking.text
                      : (keptThinking?.text ?? '')
                  }
                  done={thinkingDone && !thinkingBusy}
                  durationMs={
                    streamThinking?.kind === 'thinking'
                      ? streamThinking.durationMs
                      : keptThinking?.durationMs
                  }
                  defaultOpen={!thinkingDone || thinkingBusy}
                />
              ) : null}
              {!showChatSpinner
                ? streamTools.map((line, index) =>
                    line.kind === 'tool' ? (
                      <Text key={`${line.callId}-${index}`} style={styles.tool}>
                        {toolLabel(line.name)}
                        {line.status === 'completed' ? ' · 完成' : '…'}
                      </Text>
                    ) : null,
                  )
                : null}
              {!showChatSpinner && !thinkingBusy && streamAssistant && streamAssistant.kind === 'assistant' ? (
                stream.live ? (
                  <Text style={styles.liveText}>
                    {streamAssistant.text}
                    <Text style={styles.caret}>▍</Text>
                  </Text>
                ) : (
                  <ChatText text={streamAssistant.text} />
                )
              ) : null}
              {!showChatSpinner && showResultFallback && run?.result ? <ChatText text={run.result} /> : null}
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
                    {isTextArtifactPath(item.path) || isImageArtifactPath(item.path)
                      ? ' · 应用内打开'
                      : ' · 可能要去浏览器'}
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
              modelLabel={
                modelId
                  ? models.data?.items.find((item) => item.id === modelId)?.displayName || modelId
                  : '沿用此任务模型'
              }
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
        message="这一轮追问可以换模型。不选就继续用这条任务当前的模型。"
        items={[
          { id: '', label: '沿用此任务模型', hint: '不改模型' },
          ...(models.data?.items ?? []).map((item) => ({
            id: item.id,
            label: item.displayName || item.id,
            hint: item.description,
          })),
        ]}
        onClose={() => setModelPicker(false)}
        onSelect={setModelId}
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
  tabs: { paddingHorizontal: spacing.md, paddingBottom: 8 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 24 },
  chat: { gap: 14, paddingTop: 8 },
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
