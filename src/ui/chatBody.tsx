import { MediaBlock } from './mediaBlock';
import { ChatArtifactMedia } from './chatArtifactMedia';
import { ChatText } from './chatText';
import { artifactFileName, matchArtifactPath, mediaKindFromUrl } from '../lib/cursor/artifactPath';
import type { Artifact } from '../lib/cursor/types';

export function ChatBody({
  text,
  agentId,
  artifacts = [],
  onOpen,
}: {
  text: string;
  agentId?: string;
  artifacts?: Artifact[];
  onOpen?: (path: string) => void;
}) {
  return (
    <ChatText
      text={text}
      renderMedia={(piece) => (
        <InlineChatMedia piece={piece} agentId={agentId} artifacts={artifacts} onOpen={onOpen} />
      )}
    />
  );
}

function InlineChatMedia({
  piece,
  agentId,
  artifacts,
  onOpen,
}: {
  piece: { kind: 'image' | 'video'; alt: string; url: string };
  agentId?: string;
  artifacts: Artifact[];
  onOpen?: (path: string) => void;
}) {
  const match = matchArtifactPath(piece.url, artifacts);
  if (match && agentId) {
    return <ChatArtifactMedia agentId={agentId} items={[match]} onOpen={onOpen} />;
  }
  const kind = mediaKindFromUrl(piece.url) ?? piece.kind;
  if (!/^https?:\/\//i.test(piece.url)) {
    return null;
  }
  return (
    <MediaBlock
      kind={kind}
      uri={piece.url}
      caption={piece.alt || artifactFileName(piece.url)}
      onPress={kind === 'image' && match && onOpen ? () => onOpen(match.path) : undefined}
    />
  );
}
