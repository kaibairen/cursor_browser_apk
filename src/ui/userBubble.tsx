import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export function UserBubble({ text, images }: { text: string; images?: { uri: string }[] }) {
  return (
    <View style={styles.wrap}>
      {images?.length ? (
        <View style={styles.images}>
          {images.map((image) => (
            <Image key={image.uri} source={{ uri: image.uri }} style={styles.thumb} />
          ))}
        </View>
      ) : null}
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
  images: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: '86%' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.chip },
});
