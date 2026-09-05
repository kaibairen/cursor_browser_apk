import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupByProject } from '../features/agents/projects';
import { AboutPanel } from '../features/settings/AboutPanel';
import { SpeechPanel } from '../features/settings/SpeechPanel';
import { WorkspacePanel } from '../features/settings/WorkspacePanel';
import { useVoiceInput } from '../features/speech/useVoiceInput';
import { colors, spacing } from '../theme';
import { AccountMenuPopover, SETTINGS_TITLES, type SettingsPageId } from '../ui/accountMenu';
import { ChatLoading } from '../ui/chatLoading';
import { ChatText } from '../ui/chatText';
import { UserBubble } from '../ui/userBubble';
import { Composer, RepoSourceBar } from '../ui/composer';
import { AvatarButton, Segmented } from '../ui/primitives';
import { SettingsChrome } from '../ui/settingsChrome';
import { ActionSheet } from '../ui/sheet';

const DEMO_ROWS = [
  { title: '记忆系统对齐分析', meta: 'neo-cloud-agent', time: '18m', done: true },
  { title: '对话存储方式', meta: 'neo-cloud-agent', time: '7h', done: false },
  { title: 'Cursor 网页集成可行性', meta: 'cursor_browser_apk', time: '7h', done: false },
];

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

export default function PreviewScreen() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<'home' | 'detail'>('home');
  const [tab, setTab] = useState('chat');
  const [homeText, setHomeText] = useState('');
  const [follow, setFollow] = useState('');
  const [sent, setSent] = useState(['这四件事分别根据什么来判断？对象是不是「会算但收尾选飞」。']);
  const [replies, setReplies] = useState([DEMO_MARKDOWN]);
  const [waiting, setWaiting] = useState(false);
  const [model, setModel] = useState('默认模型');
  const [picker, setPicker] = useState<'model' | 'repo' | null>(null);
  const [repo, setRepo] = useState('默认仓库');
  const [more, setMore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<SettingsPageId | null>(null);
  const homeVoice = useVoiceInput(homeText, setHomeText);
  const followVoice = useVoiceInput(follow, setFollow);

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
        <ScrollView contentContainerStyle={styles.chat}>
          {tab === 'chat' ? (
            <View style={{ gap: 14 }}>
              {sent.map((text, index) => (
                <View key={`${index}-${text}`} style={{ gap: 14 }}>
                  <UserBubble text={text} />
                  {replies[index] ? <ChatText text={replies[index]} /> : null}
                </View>
              ))}
              {waiting ? <ChatLoading label="正在写…" /> : null}
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
              if (!text || waiting) return;
              setSent((current) => [...current, text]);
              setFollow('');
              setWaiting(true);
              setTimeout(() => {
                setReplies((current) => [...current, '预览回复。黑色气泡会先出现，这段字后到。']);
                setWaiting(false);
              }, 700);
            }}
            submitting={waiting}
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
              setSent([text]);
              setReplies([]);
              setHomeText('');
              setWaiting(true);
              setTimeout(() => {
                setReplies([DEMO_MARKDOWN]);
                setWaiting(false);
              }, 700);
            } else {
              setSent(['这四件事分别根据什么来判断？对象是不是「会算但收尾选飞」。']);
              setReplies([DEMO_MARKDOWN]);
              setWaiting(false);
            }
            setPage('detail');
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
              <Pressable key={row.title} style={styles.row} onPress={() => setPage('detail')}>
                <Text style={styles.glyph}>{row.done ? '✓' : '⎇'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <Text style={styles.rowMeta}>{row.meta}</Text>
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
  diffTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  link: { color: colors.link, fontSize: 15 },
  meta: { color: colors.muted, fontSize: 13 },
});
