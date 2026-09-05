const { writeSseChunk } = require('./cursor-api-proxy');

let wrote = '';
const ok = writeSseChunk(
  {
    writableEnded: false,
    write(chunk) {
      wrote = String(chunk);
      return true;
    },
  },
  'hi',
);
if (!ok || wrote !== 'hi') throw new Error('writeSseChunk should write');

const ended = writeSseChunk(
  {
    writableEnded: true,
    write() {
      throw new Error('should not write after end');
    },
  },
  'x',
);
if (ended) throw new Error('ended response should not write');

const boom = writeSseChunk(
  {
    writableEnded: false,
    write() {
      throw new Error('write after end');
    },
  },
  'x',
);
if (boom) throw new Error('throwing write should be swallowed');

const { watchClientAbort } = require('./cursor-api-proxy');
if (typeof watchClientAbort !== 'function') {
  throw new Error('watchClientAbort should be exported');
}

const { isAllowedArtifactHost, MEDIA_MAX_BYTES } = require('./cursor-api-proxy');
if (!isAllowedArtifactHost('cloud-agent-artifacts.s3.us-east-1.amazonaws.com')) {
  throw new Error('artifact host should allow S3');
}
if (isAllowedArtifactHost('evil.example')) {
  throw new Error('artifact host should reject unknown hosts');
}
if (MEDIA_MAX_BYTES < 20 * 1024 * 1024) {
  throw new Error('media proxy must allow a ~20MB mp4');
}

console.log('proxy helpers ok');
