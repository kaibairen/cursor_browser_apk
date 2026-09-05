import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '未找到' }} />
      <View style={styles.container}>
        <Text style={styles.title}>没有这个页面</Text>
        <Link href="/(tabs)" style={styles.link}>
          回到 Agents
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  link: { color: colors.accent, fontSize: 16 },
});
