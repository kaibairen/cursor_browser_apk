import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { ChatText } from '../ui/chatText';
import { Composer } from '../ui/composer';
import { AvatarButton, Segmented } from '../ui/primitives';

const DEMO_ROWS = [
  { title: '记忆系统对齐分析', meta: 'neo-cloud-agent', time: '18m', done: true },
  { title: '对话存储方式', meta: 'neo-cloud-agent', time: '7h', done: false },
  { title: 'Cursor 网页集成可行性', meta: 'cursor_browser_apk', time: '7h', done: false },
];

export default function PreviewScreen() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<'home' | 'detail'>('home');
  const [tab, setTab] = useState('chat');
  const [homeText, setHomeText] = useState('');
  const [follow, setFollow] = useState('');

  if (page === 'detail') {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => setPage('home')} hitSlop={12}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.title}>记忆系统对齐分析</Text>
          <Text style={styles.more}>•••</Text>
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
            <ChatText text={'修订稿建议\n\n- **保留** 现有的检索入口\n- 删掉 `conversation_search`\n- 改写成以 `MEMORY.md` 为准'} />
          ) : (
            <View style={{ gap: 12 }}>
              <Text style={styles.diffTitle}>Pull request</Text>
              <Text style={styles.link}>github.com/org/repo/pull/12</Text>
              <Text style={styles.diffTitle}>MEMORY.md</Text>
              <Text style={styles.meta}>4.2 KB</Text>
            </View>
          )}
        </ScrollView>
        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Composer
            value={follow}
            onChangeText={setFollow}
            placeholder="Add a follow up"
            onSubmit={() => setFollow('')}
            modelLabel="默认模型"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.banner}>界面预览 · 示例数据，点一条就能进详情</Text>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Agents</Text>
        <AvatarButton label="思亦" onPress={() => undefined} />
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        <Composer
          value={homeText}
          onChangeText={setHomeText}
          placeholder="让 Agent 构建、修 bug、探索…"
          onSubmit={() => setPage('detail')}
          modelLabel="默认模型"
        >
          <View style={styles.sourceChip}>
            <Text style={styles.sourceText}>从零开始 ▾</Text>
          </View>
        </Composer>
        <Text style={styles.group}>今天</Text>
        {DEMO_ROWS.map((row) => (
          <Pressable key={row.title} style={styles.row} onPress={() => setPage('detail')}>
            <Text style={styles.glyph}>{row.done ? '✓' : '⎇'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowMeta}>{row.meta}</Text>
            </View>
            <Text style={styles.time}>{row.time}</Text>
          </Pressable>
        ))}
      </ScrollView>
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
  sourceChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sourceText: { color: colors.text, fontSize: 13, fontWeight: '500' },
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
