import { useIsFocused, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useAgentList } from '../../features/agents/queries';
import { agentStatusLabel, agentStatusTone } from '../../features/agents/labels';
import { formatTime } from '../../lib/format';
import type { AgentListItem } from '../../lib/cursor/types';
import { colors, spacing } from '../../theme';
import { Badge } from '../../ui/primitives';

export default function InboxScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const [includeArchived, setIncludeArchived] = useState(true);
  const list = useAgentList({ includeArchived, enabled: focused });
  const items = useMemo(
    () => list.data?.pages.flatMap((page) => page.items) ?? [],
    [list.data],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>显示已归档</Text>
        <Switch
          value={includeArchived}
          onValueChange={setIncludeArchived}
          trackColor={{ true: colors.accentMuted, false: colors.border }}
          thumbColor={includeArchived ? colors.accent : colors.muted}
        />
      </View>
      {list.isError ? (
        <Text style={styles.error}>{list.error instanceof Error ? list.error.message : '加载失败'}</Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => {
              void list.refetch();
            }}
            tintColor={colors.accent}
          />
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) {
            void list.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          list.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.empty}>还没有云端任务。到「新建」发一条，或先在桌面把本地 Agent 移到 Cloud。</Text>
          )
        }
        ListFooterComponent={
          list.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} /> : null
        }
        renderItem={({ item }) => (
          <AgentRow
            item={item}
            onPress={() => {
              router.push(`/agent/${item.id}`);
            }}
          />
        )}
      />
    </View>
  );
}

function AgentRow({ item, onPress }: { item: AgentListItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name || item.id}
        </Text>
        <Badge label={agentStatusLabel(item.status)} tone={agentStatusTone(item.status)} />
      </View>
      <Text style={styles.meta} numberOfLines={1}>
        {item.env?.name ? `${item.env.type} · ${item.env.name}` : item.env?.type ?? 'cloud'}
      </Text>
      <Text style={styles.meta}>{formatTime(item.updatedAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterLabel: { color: colors.muted, fontSize: 14 },
  list: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  empty: { color: colors.muted, textAlign: 'center', lineHeight: 22, fontSize: 15 },
  error: { color: colors.danger, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'flex-start' },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  meta: { color: colors.muted, fontSize: 12 },
});
