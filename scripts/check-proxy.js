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

console.log('proxy helpers ok');
