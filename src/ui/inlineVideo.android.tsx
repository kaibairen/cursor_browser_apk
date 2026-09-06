import { ResizeMode, Video } from 'expo-av';
import { StyleSheet } from 'react-native';
import { radius } from '../theme';

// Android must not native-link expo-video: VideoModule.OnCreate / SimpleCache crashes at process start.

export function InlineVideo({ uri }: { uri: string }) {
  return (
    <Video
      source={{ uri }}
      style={styles.video}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay={false}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
});
