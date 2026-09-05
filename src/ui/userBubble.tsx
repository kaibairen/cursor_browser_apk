import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '86%',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  text: { color: '#fff', fontSize: 16, lineHeight: 22 },
});
