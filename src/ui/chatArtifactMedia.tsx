import { Text, View } from 'react-native';
import { useArtifactMedia } from '../features/agents/queries';
import { artifactFileName, artifactMediaKind } from '../lib/cursor/artifactPath';
import type { Artifact } from '../lib/cursor/types';
import { colors } from '../theme';
import { MediaBlock, MediaPlaceholder } from './mediaBlock';

export function ChatArtifactMedia({
  agentId,
  items,
  onOpen,
}: {
  agentId: string;
  items: Artifact[];
  onOpen?: (path: string) => void;
}) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 12 }}>
      {items.map((item) => (
        <ArtifactMediaCard key={item.path} agentId={agentId} path={item.path} onOpen={onOpen} />
      ))}
    </View>
  );
}

function ArtifactMediaCard({
  agentId,
  path,
  onOpen,
}: {
  agentId: string;
  path: string;
  onOpen?: (path: string) => void;
}) {
  const media = useArtifactMedia(agentId, path);
  const kind = media.data?.kind ?? artifactMediaKind(path);
  const caption = artifactFileName(path);

  if (media.isLoading || !kind) {
    return <MediaPlaceholder label={`正在打开 ${caption}`} />;
  }
  if (media.isError || !media.data) {
    return <Text style={{ color: colors.danger, fontSize: 13 }}>{`无法打开 ${caption}`}</Text>;
  }

  return (
    <MediaBlock
      kind={media.data.kind}
      uri={media.data.uri}
      caption={caption}
      onPress={media.data.kind === 'image' && onOpen ? () => onOpen(path) : undefined}
    />
  );
}
