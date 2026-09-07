import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme';
import { openExternal } from './openUrl';

// Do not mount expo-video or expo-av Video on Android. Native video init has crashed this APK.

export function InlineVideo({ uri }: { uri: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => void openExternal(uri)} style={styles.video}>
      <Text style={styles.label}>▶ 打开视频</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.card, fontSize: 16, fontWeight: '600' },
});
