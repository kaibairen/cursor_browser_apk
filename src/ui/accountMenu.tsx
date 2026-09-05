import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

export type AccountMenuId = 'workspace' | 'speech' | 'about' | 'logout';
export type SettingsPageId = Exclude<AccountMenuId, 'logout'>;

export const SETTINGS_HREF = {
  workspace: '/settings/workspace',
  speech: '/settings/speech',
  about: '/settings/about',
} as const;

export const SETTINGS_TITLES: Record<SettingsPageId, string> = {
  workspace: '默认仓库',
  speech: '语音听写',
  about: '关于',
};

type Row = {
  id: AccountMenuId;
  icon: string;
  label: string;
  hint?: string;
  chevron?: boolean;
  danger?: boolean;
};

const GROUPS: Row[][] = [
  [
    { id: 'workspace', icon: '⎇', label: '默认仓库', chevron: true },
    { id: 'speech', icon: '🎤', label: '语音听写', chevron: true },
    { id: 'about', icon: '?', label: '关于', chevron: true },
  ],
  [{ id: 'logout', icon: '⎋', label: '退出', danger: true }],
];

export function AccountMenuCard({
  name,
  email,
  onItem,
}: {
  name: string;
  email: string;
  onItem: (id: AccountMenuId) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        <Text style={styles.name}>{name}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
      </View>
      {GROUPS.map((group, index) => (
        <View key={index}>
          <View style={styles.rule} />
          {group.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => onItem(row.id)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>{row.icon}</Text>
              </View>
              <Text style={[styles.label, row.danger && styles.danger]}>{row.label}</Text>
              {row.hint ? <Text style={styles.hint}>{row.hint}</Text> : null}
              {row.chevron ? <Text style={styles.chevron}>›</Text> : null}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

export function AccountMenuPopover({
  visible,
  name,
  email,
  onClose,
  onItem,
}: {
  visible: boolean;
  name: string;
  email: string;
  onClose: () => void;
  onItem: (id: AccountMenuId) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="关闭账号菜单" />
        <View style={[styles.popover, { top: insets.top + 44, right: spacing.md }]}>
          <AccountMenuCard name={name} email={email} onItem={onItem} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20, 20, 18, 0.18)' },
  popover: {
    position: 'absolute',
    width: 280,
    zIndex: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  identity: { paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 12, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  email: { color: colors.muted, fontSize: 13 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowPressed: { backgroundColor: colors.chip },
  iconWrap: {
    width: 22,
    alignItems: 'center',
  },
  icon: { color: colors.text, fontSize: 14 },
  label: { flex: 1, color: colors.text, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 13 },
  chevron: { color: colors.muted, fontSize: 18, lineHeight: 20 },
  danger: { color: colors.danger },
});
