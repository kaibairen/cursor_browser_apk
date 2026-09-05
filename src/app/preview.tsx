import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupByProject } from '../features/agents/projects';
import { AboutPanel } from '../features/settings/AboutPanel';
import { SpeechPanel } from '../features/settings/SpeechPanel';
import { WorkspacePanel } from '../features/settings/WorkspacePanel';
import { useVoiceInput } from '../features/speech/useVoiceInput';
import { colors, spacing } from '../theme';
import { AccountMenuPopover, SETTINGS_TITLES, type SettingsPageId } from '../ui/accountMenu';
import { ChatText } from '../ui/chatText';
import { ThinkingBlock } from '../ui/thinkingBlock';
import { UserBubble } from '../ui/userBubble';
import { AgentRowMeta, AgentStatusIcon } from '../ui/agentRow';
import { Composer, RepoSourceBar } from '../ui/composer';
import { AvatarButton, Segmented } from '../ui/primitives';
import { SettingsChrome } from '../ui/settingsChrome';
import { ActionSheet } from '../ui/sheet';

const DEMO_ROWS = [
  { title: '记忆系统对齐分析', meta: 'neo-cloud-agent', time: '18m', done: true, additions: 464, deletions: 81 },
  { title: '对话存储方式', meta: 'neo-cloud-agent', time: '7h', done: false },
  { title: 'Cursor 网页集成可行性', meta: 'cursor_browser_apk', time: '7h', done: true, additions: 10774, deletions: 1 },
];

const DEMO_QUESTION = '这四件事分别根据什么来判断？对象是不是「会算但收尾选飞」。';

const DEMO_MARKDOWN = `## 3. 基于什么指标，对应什么情况

| 指标 | 它在回答什么 | 看到什么，对应什么情况 |
| --- | --- | --- |
| 答对率 Accuracy | 最终字母对不对 | 高：卷面分好。低：可能不会做。 |
| 会算 Number-match | 中间有没有算出正确那个数 | 高：题会做。低：知识/演算不够。 |
| 错配 Mismatch | 中间已指向某选项，字母却另选 | 这是主指标。 |

几种常见组合：

| 会算 | 答对 | 错配 | 人话 |
| --- | --- | --- | --- |
| 低 | 低 | 低 | 根本不会做 |
| 高 | 高 | 低 | 会算也会选 |
| 高 | 低 | 高 | 算到了，收尾选飞 |

> 能判断出「收尾会慌」，也能把慌按回去、把数算得更多。

- **保留** 现有的检索入口
- 删掉 \`conversation_search\`
`;

const DEMO_THINKING = '用户在问判断标准。先对上「会算 / 答对 / 错配」三列，再解释「会算但收尾选飞」对应哪一行。';
const DEMO_FOLLOW_REPLY = '黑色气泡会先出现。下面先展开思考，再一段一段写出回复。';

type DemoTurn = {
  user: string;
  thinking?: string;
  thinkingMs?: number;
  reply?: string;
};

const EXAMPLE_THREAD: DemoTurn[] = [
  {
    user: DEMO_QUESTION,
    thinking: DEMO_THINKING,
    thinkingMs: 2200,
    reply: DEMO_MARKDOWN,
  },
];

export default function PreviewScreen() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<'home' | 'detail'>('home');
  const [tab, setTab] = useState('chat');
  const [homeText, setHomeText] = useState('');
  const [follow, setFollow] = useState('');
  const [thread, setThread] = useState<DemoTurn[]>(EXAMPLE_THREAD);
  const [model, setModel] = useState('默认模型');
  const [picker, setPicker] = useState<'model' | 'repo' | null>(null);
  const [repo, setRepo] = useState('默认仓库');
  const [more, setMore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPageId | null>(null);
  const homeVoice = useVoiceInput(homeText, setHomeText);
  const followVoice = useVoiceInput(follow, setFollow);
  const turn = usePreviewTurn();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!turn.waiting) return;
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [turn.waiting, turn.thinking, turn.reply, thread.length]);

  function openFinishedExample() {
    turn.stop();
    setThread(EXAMPLE_THREAD);
    setPage('detail');
  }

  function startTurn(userText: string, reply: string, reset = false) {
    setThread((current) => (reset ? [{ user: userText }] : [...current, { user: userText }]));
    turn.start(DEMO_THINKING, reply, (thinking, thinkingMs) => {
      setThread((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (!last) return [{ user: userText, thinking, thinkingMs, reply }];
        next[next.length - 1] = { ...last, thinking, thinkingMs, reply };
        return next;
      });
    });
    setPage('detail');
  }

  if (settingsPage) {
    return (
      <SettingsChrome title={SETTINGS_TITLES[settingsPage]} onBack={() => setSettingsPage(null)}>
        {settingsPage === 'workspace' ? <WorkspacePanel /> : null}
        {settingsPage === 'speech' ? <SpeechPanel /> : null}
        {settingsPage === 'about' ? <AboutPanel /> : null}
      </SettingsChrome>
    );
  }

  if (page === 'detail') {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => setPage('home')} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.title}>记忆系统对齐分析</Text>
          <Pressable accessibilityRole="button" onPress={() => setMore(true)} hitSlop={12}>
            <Text style={styles.more}>•••</Text>
          </Pressable>
        </View>
        <View style={styles.tabs}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { id: 'chat', label: 'Chat' },
              { id: 'diff', label: 'Diff' },
            ]}
          />
        </View>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.chat}>
          {tab === 'chat' ? (
            <View style={{ gap: 14 }}>
              {thread.map((item, index) => (
                <View key={`${index}-${item.user}`} style={{ gap: 14 }}>
                  <UserBubble text={item.user} />
                  {item.thinking ? (
                    <ThinkingBlock
                      text={item.thinking}
                      done
                      durationMs={item.thinkingMs}
                      defaultOpen={false}
                    />
                  ) : null}
                  {item.reply ? <ChatText text={item.reply} /> : null}
                </View>
              ))}
              {turn.waiting || (!thread[thread.length - 1]?.reply && (turn.thinking || turn.reply)) ? (
                <>
                  <ThinkingBlock
                    text={turn.thinking}
                    done={turn.thinkingDone || !turn.waiting}
                    durationMs={turn.thinkingDone ? turn.thinkingMs : undefined}
                  />
                  {turn.reply ? (
                    <Text style={styles.liveText}>
                      {turn.reply}
                      {turn.waiting ? <Text style={styles.caret}>▍</Text> : null}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Text style={styles.diffTitle}>Pull request</Text>
              <Text style={styles.link}>github.com/org/repo/pull/12</Text>
              <Text style={styles.meta}>会打开系统浏览器看 GitHub</Text>
              <Text style={styles.diffTitle}>numerical_analysis.md</Text>
              <Text style={styles.meta}>应用内 UTF-8 打开，不再跳浏览器</Text>
              <ChatText text={DEMO_MARKDOWN} />
            </View>
          )}
        </ScrollView>
        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Composer
            value={follow}
            onChangeText={setFollow}
            placeholder="Add a follow up"
            onSubmit={() => {
              const text = follow.trim();
              if (!text || turn.waiting) return;
              setFollow('');
              startTurn(text, DEMO_FOLLOW_REPLY);
            }}
            submitting={false}
            onStop={turn.waiting ? turn.stop : undefined}
            modelLabel={model === '默认模型' ? '沿用此任务模型' : model}
            onModelPress={() => setPicker('model')}
            listening={followVoice.listening}
            onMicStart={followVoice.onMicStart}
            onMicEnd={followVoice.onMicEnd}
            hint={followVoice.error ?? undefined}
          />
        </View>
        <ActionSheet
          visible={picker === 'model'}
          title="选择模型"
          message="这一轮追问可以换模型。"
          items={[
            { id: '默认模型', label: '沿用此任务模型' },
            { id: 'Composer', label: 'Composer' },
            { id: 'Auto', label: 'Auto' },
          ]}
          onClose={() => setPicker(null)}
          onSelect={setModel}
        />
        <ActionSheet
          visible={more}
          title="记忆系统对齐分析"
          items={[
            { id: 'web', label: '在浏览器打开', hint: '打开网页上的同一条任务' },
            { id: 'stop', label: '停止这一轮', hint: '取消当前正在写的回复' },
            { id: 'archive', label: '归档', hint: '从列表里收起来' },
            { id: 'usage', label: '用量', hint: '看这轮花了多少' },
            { id: 'delete', label: '删除', hint: '删掉后不能恢复', destructive: true },
          ]}
          onClose={() => setMore(false)}
          onSelect={() => undefined}
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.banner}>界面预览 · 示例数据，点一条就能进详情</Text>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Agents</Text>
        <AvatarButton label="思亦" onPress={() => setMenuOpen(true)} />
      </View>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <RepoSourceBar label={repo} onPress={() => setPicker('repo')} />
        <Composer
          value={homeText}
          onChangeText={setHomeText}
          placeholder="让 Agent 构建、修 bug、探索…"
          onSubmit={() => {
            const text = homeText.trim();
            if (text) {
              setHomeText('');
              startTurn(text, DEMO_MARKDOWN, true);
              return;
            }
            openFinishedExample();
          }}
          modelLabel={model}
          onModelPress={() => setPicker('model')}
          listening={homeVoice.listening}
          onMicStart={homeVoice.onMicStart}
          onMicEnd={homeVoice.onMicEnd}
          hint={homeVoice.error ?? undefined}
        />
        {groupByProject(DEMO_ROWS, (row) => ({ key: row.meta, title: row.meta })).map((section) => (
          <View key={section.key}>
            <Text style={styles.group}>{section.title}</Text>
            {section.data.map((row) => (
              <Pressable key={row.title} style={styles.row} onPress={openFinishedExample}>
                <AgentStatusIcon status={row.done ? 'IDLE' : 'ACTIVE'} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <AgentRowMeta repo={row.meta} additions={row.additions} deletions={row.deletions} />
                </View>
                <Text style={styles.time}>{row.time}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
      <ActionSheet
        visible={picker === 'model'}
        title="选择模型"
        message="只在新建任务时生效。"
        items={[
          { id: '默认模型', label: '默认模型' },
          { id: 'Composer', label: 'Composer' },
          { id: 'Auto', label: 'Auto' },
        ]}
        onClose={() => setPicker(null)}
        onSelect={setModel}
      />
      <ActionSheet
        visible={picker === 'repo'}
        title="这次用哪个仓库"
        message="默认仓库在右上角头像里配置。"
        items={[
          { id: '默认仓库', label: '默认仓库', hint: 'neo-cloud-agent' },
          { id: 'neo-cloud-agent', label: 'neo-cloud-agent' },
          { id: 'cursor_browser_apk', label: 'cursor_browser_apk' },
        ]}
        onClose={() => setPicker(null)}
        onSelect={setRepo}
      />
      <AccountMenuPopover
        visible={menuOpen}
        name="思亦"
        email="preview@local"
        onClose={() => setMenuOpen(false)}
        onItem={(id) => {
          setMenuOpen(false);
          if (id === 'logout') return;
          setSettingsPage(id);
        }}
      />
    </View>
  );
}

function usePreviewTurn() {
  const [waiting, setWaiting] = useState(false);
  const [thinking, setThinking] = useState('');
  const [thinkingDone, setThinkingDone] = useState(false);
  const [thinkingMs, setThinkingMs] = useState(0);
  const [reply, setReply] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAt = useRef(0);

  function clearTimers() {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  }

  function later(ms: number, fn: () => void) {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }

  function typeOut(
    text: string,
    delay: number,
    stepSize: number,
    onTick: (value: string) => void,
    onDone: () => void,
  ) {
    let index = 0;
    const step = () => {
      index = Math.min(text.length, index + stepSize);
      onTick(text.slice(0, index));
      if (index >= text.length) {
        onDone();
        return;
      }
      later(delay, step);
    };
    later(delay, step);
  }

  function stop() {
    clearTimers();
    setWaiting(false);
    setThinkingDone(true);
    setThinkingMs((current) => current || Math.max(800, Date.now() - startedAt.current));
  }

  function start(
    thinkingText: string,
    replyText: string,
    onComplete: (thinking: string, thinkingMs: number) => void,
  ) {
    clearTimers();
    startedAt.current = Date.now();
    setWaiting(true);
    setThinking('');
    setThinkingDone(false);
    setThinkingMs(0);
    setReply('');
    later(500, () => {
      typeOut(thinkingText, 36, 1, setThinking, () => {
        const duration = Math.max(800, Date.now() - startedAt.current);
        setThinkingMs(duration);
        setThinkingDone(true);
        later(450, () => {
          const chunk = replyText.length > 80 ? 4 : 1;
          typeOut(replyText, 32, chunk, setReply, () => {
            onComplete(thinkingText, duration);
            setWaiting(false);
            setThinking('');
            setThinkingDone(false);
            setThinkingMs(0);
            setReply('');
          });
        });
      });
    });
  }

  useEffect(() => () => clearTimers(), []);

  return { waiting, thinking, thinkingDone, thinkingMs, reply, start, stop };
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  banner: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    paddingBottom: 4,
  },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { color: colors.text, fontSize: 18, fontWeight: '600' },
  list: { paddingHorizontal: spacing.md, paddingBottom: 32 },
  group: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 18, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  glyph: { width: 18, textAlign: 'center', color: colors.muted },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowMeta: { color: colors.muted, fontSize: 13 },
  time: { color: colors.muted, fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8 },
  back: { color: colors.text, fontSize: 28, width: 24 },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 16, fontWeight: '600' },
  more: { width: 28, textAlign: 'right', color: colors.text },
  tabs: { paddingHorizontal: spacing.md, paddingBottom: 8 },
  chat: { paddingHorizontal: spacing.lg, paddingBottom: 24, gap: 12 },
  composerWrap: { paddingHorizontal: spacing.md, paddingTop: 8, backgroundColor: colors.bg },
  liveText: { color: colors.text, fontSize: 16, lineHeight: 24 },
  caret: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  diffTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  link: { color: colors.link, fontSize: 15 },
  meta: { color: colors.muted, fontSize: 13 },
});
