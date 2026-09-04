import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { pickImages, toPromptImages, type PickedImage } from '../../features/agents/images';
import { agentStatusLabel, agentStatusTone, runStatusLabel, runStatusTone } from '../../features/agents/labels';
import {
  isBusyError,
  useAgent,
  useArchiveAgent,
  useArtifacts,
  useCancelRun,
  useCreateFollowUp,
  useDeleteAgent,
  useDownloadArtifact,
  useRun,
  useUsage,
} from '../../features/agents/queries';
import { useRunStream } from '../../features/agents/useRunStream';
import { isTerminalRun } from '../../lib/cursor/types';
import { formatBytes, formatDuration, formatTime } from '../../lib/format';
import { colors, spacing } from '../../theme';
import { githubHttpsUrl, openExternal } from '../../ui/openUrl';
import { Badge, Button, Field } from '../../ui/primitives';

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const agentId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const navigation = useNavigation();

  const agentQuery = useAgent(agentId);
  const agent = agentQuery.data;
  const latestRunId = agent?.latestRunId;
  const runQuery = useRun(agentId, latestRunId, true);
  const run = runQuery.data;
  const live = Boolean(run && !isTerminalRun(run.status));
  const stream = useRunStream(agentId, latestRunId, run?.status);

  const followUp = useCreateFollowUp(agentId);
  const cancel = useCancelRun(agentId);
  const archive = useArchiveAgent(agentId);
  const remove = useDeleteAgent();
  const usage = useUsage(agentId);
  const artifacts = useArtifacts(agentId);
  const download = useDownloadArtifact(agentId);

  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = agent?.status === 'ACTIVE' || live || followUp.isPending || isBusyError(followUp.error);

  useEffect(() => {
    if (agent?.name) {
      navigation.setOptions({ title: agent.name });
    }
  }, [agent?.name, navigation]);

  async function onFollowUp() {
    setError(null);
    const text = prompt.trim();
    if (!text) return;
    try {
      await followUp.mutateAsync({
        prompt: {
          text,
          images: images.length ? await toPromptImages(images) : undefined,
        },
      });
      setPrompt('');
      setImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '追问失败');
    }
  }

  function confirmDelete() {
    Alert.alert('删除任务', '将永久删除这条 Cloud Agent，无法恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void remove.mutateAsync(agentId).then(() => {
            router.replace('/(tabs)');
          });
        },
      },
    ]);
  }

  if (agentQuery.isError) {
    return (
      <View style={styles.padded}>
        <Text style={styles.error}>{agentQuery.error instanceof Error ? agentQuery.error.message : '加载失败'}</Text>
      </View>
    );
  }

  if (!agent) {
    return (
      <View style={styles.padded}>
        <Text style={styles.meta}>加载任务…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <Badge label={agentStatusLabel(agent.status)} tone={agentStatusTone(agent.status)} />
          {run ? <Badge label={runStatusLabel(run.status)} tone={runStatusTone(run.status)} /> : null}
        </View>
        <Text style={styles.id}>{agent.id}</Text>
        <Text style={styles.meta}>{formatTime(agent.updatedAt)}</Text>
        {agent.repos?.[0]?.url ? <Text style={styles.meta}>{agent.repos[0].url}</Text> : null}
        {agent.env?.name ? <Text style={styles.meta}>环境：{agent.env.name}</Text> : null}

        <View style={styles.actions}>
          <Button title="打开网页版" variant="ghost" onPress={() => void openExternal(agent.url)} />
          {live && latestRunId ? (
            <Button
              title="取消本轮"
              variant="danger"
              loading={cancel.isPending}
              onPress={() => {
                void cancel.mutateAsync(latestRunId).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : '无法取消');
                });
              }}
            />
          ) : null}
          <Button
            title={agent.status === 'ARCHIVED' ? '取消归档' : '归档'}
            variant="ghost"
            loading={archive.isPending}
            onPress={() => {
              void archive.mutateAsync(agent.status === 'ARCHIVED');
            }}
          />
          <Button title="删除" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
        </View>

        {run?.git?.branches?.length ? (
          <View style={styles.block}>
            <Text style={styles.section}>分支 / PR</Text>
            {run.git.branches.map((branch) => (
              <View key={`${branch.repoUrl}-${branch.branch ?? ''}-${branch.prUrl ?? ''}`} style={styles.block}>
                <Text style={styles.body}>
                  {branch.repoUrl}
                  {branch.branch ? ` · ${branch.branch}` : ''}
                </Text>
                {branch.prUrl ? (
                  <Pressable onPress={() => void openExternal(branch.prUrl!)}>
                    <Text style={styles.link}>打开 PR</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => void openExternal(githubHttpsUrl(branch.repoUrl))}>
                    <Text style={styles.link}>打开仓库</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {stream.streamError ? <Text style={styles.meta}>{stream.streamError}</Text> : null}

        <Text style={styles.section}>本轮输出</Text>
        {stream.lines.length === 0 && run?.result ? <Text style={styles.body}>{run.result}</Text> : null}
        {stream.lines.length === 0 && !run?.result ? (
          <Text style={styles.meta}>{live ? '等待模型输出…' : '没有可显示的实时内容，终态请看 result。'}</Text>
        ) : null}
        {stream.lines.map((line, index) => {
          if (line.kind === 'tool') {
            return (
              <Text key={`${line.callId}-${index}`} style={styles.tool}>
                {line.name} · {line.status}
                {line.detail ? ` ${line.detail}` : ''}
              </Text>
            );
          }
          return (
            <Text key={`${line.kind}-${index}`} style={line.kind === 'thinking' ? styles.thinking : styles.body}>
              {line.text}
            </Text>
          );
        })}
        {run?.durationMs != null ? <Text style={styles.meta}>耗时 {formatDuration(run.durationMs)}</Text> : null}

        <Text style={styles.section}>用量</Text>
        {usage.data ? (
          <Text style={styles.meta}>
            合计 {usage.data.totalUsage.totalTokens} tokens（入 {usage.data.totalUsage.inputTokens} / 出{' '}
            {usage.data.totalUsage.outputTokens}）
          </Text>
        ) : (
          <Text style={styles.meta}>{usage.isError ? '用量暂不可用' : '加载用量…'}</Text>
        )}

        <Text style={styles.section}>产物</Text>
        {(artifacts.data?.items ?? []).map((item) => (
          <Pressable
            key={item.path}
            onPress={() => {
              void download
                .mutateAsync(item.path)
                .then((file) => openExternal(file.url))
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : '无法下载产物');
                });
            }}
          >
            <Text style={styles.link}>
              {item.path} · {formatBytes(item.sizeBytes)}
            </Text>
          </Pressable>
        ))}
        {artifacts.data && artifacts.data.items.length === 0 ? <Text style={styles.meta}>没有产物</Text> : null}

        <Text style={styles.section}>追问</Text>
        {agent.status === 'ARCHIVED' ? (
          <Text style={styles.meta}>已归档，不能追问。先取消归档。</Text>
        ) : (
          <>
            <Field
              label="继续说"
              value={prompt}
              onChangeText={setPrompt}
              placeholder={busy ? '当前轮次未结束' : '补充指令'}
              multiline
              autoCapitalize="sentences"
            />
            {images.map((image) => (
              <View key={image.uri} style={styles.row}>
                <Text style={styles.meta}>{image.fileName}</Text>
                <Pressable onPress={() => setImages((current) => current.filter((item) => item.uri !== image.uri))}>
                  <Text style={styles.link}>移除</Text>
                </Pressable>
              </View>
            ))}
            <Button
              title="附加图片"
              variant="ghost"
              disabled={busy || images.length >= 5}
              onPress={() => {
                void pickImages(images.length)
                  .then((next) => setImages((current) => [...current, ...next]))
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : '无法选择图片'));
              }}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="发送追问" onPress={() => void onFollowUp()} loading={followUp.isPending} disabled={busy || !prompt.trim()} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 48 },
  padded: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  actions: { gap: spacing.sm },
  block: { gap: 6 },
  section: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  id: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  thinking: { color: colors.muted, fontSize: 13, fontStyle: 'italic', lineHeight: 20 },
  tool: { color: colors.accent, fontSize: 13 },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  link: { color: colors.accent, fontSize: 14 },
  error: { color: colors.danger },
});
