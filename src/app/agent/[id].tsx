import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
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
import { pickImages, toPromptImages, type PickedImage } from '../../features/agents/images';
import {
  isBusyError,
  useAgent,
  useArchiveAgent,
  useArtifacts,
  useCancelRun,
  useCreateFollowUp,
  useDeleteAgent,
  useDownloadArtifact,
  useModels,
  useRun,
  useUsage,
} from '../../features/agents/queries';
import { useRunStream } from '../../features/agents/useRunStream';
import { isTerminalRun } from '../../lib/cursor/types';
import { formatBytes } from '../../lib/format';
import { colors, spacing } from '../../theme';
import { ChatText } from '../../ui/chatText';
import { Composer } from '../../ui/composer';
import { githubHttpsUrl, openExternal } from '../../ui/openUrl';
import { Segmented } from '../../ui/primitives';

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const agentId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const agentQuery = useAgent(agentId);
  const agent = agentQuery.data;
  const latestRunId = agent?.latestRunId;
  const runQuery = useRun(agentId, latestRunId, true);
  const run = runQuery.data;
  const live = Boolean(run && !isTerminalRun(run.status));
  const stream = useRunStream(agentId, latestRunId, run?.status);
  const models = useModels();
  const followUp = useCreateFollowUp(agentId);
  const cancel = useCancelRun(agentId);
  const archive = useArchiveAgent(agentId);
  const remove = useDeleteAgent();
  const usage = useUsage(agentId);
  const artifacts = useArtifacts(agentId);
  const download = useDownloadArtifact(agentId);

  const [tab, setTab] = useState<'chat' | 'diff'>('chat');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = agent?.status === 'ACTIVE' || live || followUp.isPending || isBusyError(followUp.error);

  const modelLabel = useMemo(() => {
    const first = models.data?.items[0];
    return first?.displayName || '默认模型';
  }, [models.data]);

  async function onFollowUp() {
    setError(null);
    const text = prompt.trim();
    if (!text) return;
    try {
      await followUp.mutateAsync({
        prompt: { text, images: images.length ? await toPromptImages(images) : undefined },
      });
      setPrompt('');
      setImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    }
  }

  function openMore() {
    const actions = [
      { label: '在浏览器打开', run: () => void openExternal(agent!.url) },
      live && latestRunId
        ? {
            label: '停止这一轮',
            run: () =>
              void cancel.mutateAsync(latestRunId).catch((err: unknown) => {
                setError(err instanceof Error ? err.message : '无法停止');
              }),
          }
        : null,
      {
        label: agent?.status === 'ARCHIVED' ? '取消归档' : '归档',
        run: () => void archive.mutateAsync(agent?.status === 'ARCHIVED'),
      },
      {
        label: usage.data
          ? `用量 ${usage.data.totalUsage.totalTokens.toLocaleString()} tokens`
          : '查看用量',
        run: () => {
          if (!usage.data) return;
          Alert.alert(
            '用量',
            `一共 ${usage.data.totalUsage.totalTokens.toLocaleString()} tokens\n输入 ${usage.data.totalUsage.inputTokens.toLocaleString()} · 输出 ${usage.data.totalUsage.outputTokens.toLocaleString()}`,
          );
        },
      },
      {
        label: '删除',
        destructive: true,
        run: () => {
          Alert.alert('删除任务', '删除后不能恢复。', [
            { text: '取消', style: 'cancel' },
            {
              text: '删除',
              style: 'destructive',
              onPress: () => {
                void remove.mutateAsync(agentId).then(() => router.replace('/(tabs)'));
              },
            },
          ]);
        },
      },
    ].filter(Boolean) as { label: string; run: () => void; destructive?: boolean }[];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((item) => item.label), '取消'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: actions.findIndex((item) => item.destructive),
        },
        (index) => {
          if (index < actions.length) actions[index]?.run();
        },
      );
      return;
    }
    Alert.alert(agent?.name ?? '任务', undefined, [
      ...actions.map((item) => ({ text: item.label, onPress: item.run, style: item.destructive ? 'destructive' as const : undefined })),
      { text: '取消', style: 'cancel' as const },
    ]);
  }

  if (agentQuery.isError) {
    return (
      <View style={[styles.padded, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.error}>{agentQuery.error instanceof Error ? agentQuery.error.message : '加载失败'}</Text>
      </View>
    );
  }

  if (!agent) {
    return (
      <View style={[styles.padded, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.meta}>加载中…</Text>
      </View>
    );
  }

  const chatEmpty = stream.lines.length === 0 && !run?.result;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.flex, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {agent.name || '任务'}
          </Text>
          <Pressable onPress={openMore} hitSlop={12}>
            <Text style={styles.more}>•••</Text>
          </Pressable>
        </View>
        <View style={styles.tabs}>
          <Segmented
            value={tab}
            onChange={(id) => setTab(id as 'chat' | 'diff')}
            options={[
              { id: 'chat', label: 'Chat' },
              { id: 'diff', label: 'Diff' },
            ]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {tab === 'chat' ? (
            <View style={styles.chat}>
              {live ? <Text style={styles.live}>正在写…</Text> : null}
              {stream.streamError ? <Text style={styles.meta}>{stream.streamError}</Text> : null}
              {chatEmpty ? (
                <Text style={styles.meta}>{live ? '等第一段回复。' : '还没有文字结果。'}</Text>
              ) : null}
              {stream.lines.length === 0 && run?.result ? <ChatText text={run.result} /> : null}
              {stream.lines.map((line, index) => {
                if (line.kind === 'tool') {
                  return (
                    <Text key={`${line.callId}-${index}`} style={styles.tool}>
                      {toolLabel(line.name)}
                      {line.status === 'completed' ? ' · 完成' : '…'}
                    </Text>
                  );
                }
                if (line.kind === 'thinking') {
                  return (
                    <Text key={`t-${index}`} style={styles.thinking}>
                      {line.text}
                    </Text>
                  );
                }
                return <ChatText key={`a-${index}`} text={line.text} />;
              })}
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
                </Pressable>
              ))}
              {(artifacts.data?.items ?? []).map((item) => (
                <Pressable
                  key={item.path}
                  style={styles.diffRow}
                  onPress={() => {
                    void download
                      .mutateAsync(item.path)
                      .then((file) => openExternal(file.url))
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : '无法打开文件'));
                  }}
                >
                  <Text style={styles.diffTitle}>{fileName(item.path)}</Text>
                  <Text style={styles.meta}>{formatBytes(item.sizeBytes)}</Text>
                </Pressable>
              ))}
              {!run?.git?.branches?.length && !artifacts.data?.items.length ? (
                <Text style={styles.meta}>还没有代码变更或文件。</Text>
              ) : null}
            </View>
          )}
        </ScrollView>

        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {agent.status === 'ARCHIVED' ? (
            <Text style={styles.meta}>已归档。打开右上角可以恢复。</Text>
          ) : (
            <Composer
              value={prompt}
              onChangeText={setPrompt}
              placeholder={busy ? '这一轮还在进行，先等它写完…' : 'Add a follow up'}
              onSubmit={() => void onFollowUp()}
              submitting={followUp.isPending}
              disabled={busy}
              modelLabel={modelLabel}
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
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 16, fontWeight: '600' },
  more: { color: colors.text, fontSize: 16, width: 28, textAlign: 'right' },
  tabs: { paddingHorizontal: spacing.md, paddingBottom: 8 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 24 },
  chat: { gap: 14, paddingTop: 8 },
  live: { color: colors.live, fontSize: 13, fontWeight: '600' },
  thinking: { color: colors.muted, fontSize: 14, lineHeight: 20 },
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
