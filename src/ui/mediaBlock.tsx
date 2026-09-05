import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ArtifactMediaKind } from '../lib/cursor/artifactPath';
import { colors, radius } from '../theme';

export function MediaBlock({
  kind,
  uri,
  caption,
  onPress,
}: {
  kind: ArtifactMediaKind;
  uri: string;
  caption?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      {kind === 'image' ? (
        <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </Pressable>
      ) : (
        <MediaErrorBoundary>
          <InlineVideo key={uri} uri={uri} />
        </MediaErrorBoundary>
      )}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

export function MediaPlaceholder({ label }: { label: string }) {
  return (
    <View style={styles.placeholder}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

class MediaErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Keep thinking / tool rows on screen if a player fails to mount.
  }

  render(): ReactNode {
    if (this.state.failed) {
      return <Text style={styles.caption}>视频没法在这一页播放</Text>;
    }
    return this.props.children;
  }
}

function InlineVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (next) => {
    next.loop = false;
  });

  return (
    <VideoView
      style={styles.video}
      player={player}
      nativeControls
      contentFit="contain"
      playsInline
      fullscreenOptions={{ enable: true }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  image: {
    width: '100%',
    minHeight: 180,
    maxHeight: 420,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  placeholder: {
    width: '100%',
    minHeight: 160,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
