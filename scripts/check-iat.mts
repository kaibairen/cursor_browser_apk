import assert from 'node:assert/strict';
import { hmacSha256Base64 } from '../src/lib/iflytek/hmac.ts';
import {
  applyIatSlice,
  buildIatWebSocketUrl,
  decodeIatResult,
  emptyIatAssembly,
  encodeIatFrame,
  joinIatSlices,
} from '../src/lib/iflytek/protocol.ts';
import { attachSpoken, isVoiceHoldTap, mergeSpokenText } from '../src/features/speech/voice.ts';

const date = 'Thu, 01 Jan 2026 00:00:00 GMT';
const first = buildIatWebSocketUrl({ appId: 'app', apiKey: 'key', apiSecret: 'secret' }, date);
const second = buildIatWebSocketUrl({ appId: 'app', apiKey: 'key', apiSecret: 'secret' }, date);
assert.equal(first, second);
assert.match(first, /^wss:\/\/iat-api\.xfyun\.cn\/v2\/iat\?/);
assert.match(first, /authorization=/);
assert.match(first, /host=iat-api\.xfyun\.cn/);

const origin = `host: iat-api.xfyun.cn\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
assert.equal(hmacSha256Base64('secret', origin).length > 10, true);

const frame0 = encodeIatFrame('app1', 0, 'AAAA');
assert.equal(frame0.common?.app_id, 'app1');
assert.equal(frame0.business?.language, 'zh_cn');
assert.equal(frame0.data.status, 0);
const frame1 = encodeIatFrame('app1', 1, 'BBBB');
assert.equal(frame1.common, undefined);
assert.equal(frame1.data.status, 1);

const parsed = decodeIatResult({
  data: {
    status: 1,
    result: { ws: [{ cw: [{ w: '加' }] }, { cw: [{ w: ' README' }] }] },
  },
});
assert.equal(parsed.text, '加 README');
assert.equal(parsed.status, 1);

let assembly = emptyIatAssembly();
assembly = applyIatSlice(assembly, { text: '你好', status: 1, pgs: 'apd', sn: 1 });
assembly = applyIatSlice(assembly, { text: '你好世界', status: 1, pgs: 'rpl', sn: 2, rg: [1, 1] });
assert.equal(joinIatSlices(assembly), '你好世界');
assembly = applyIatSlice(assembly, { text: '。', status: 2, pgs: 'rpl', sn: 3, rg: [1, 2] });
assert.equal(joinIatSlices(assembly), '你好世界。');

assert.equal(mergeSpokenText('', '打开设置'), '打开设置');
assert.equal(mergeSpokenText('先看天气', '。'), '先看天气。');
assert.equal(attachSpoken('帮我看看', '仓库状态'), '帮我看看 仓库状态');
assert.equal(isVoiceHoldTap(100), true);
assert.equal(isVoiceHoldTap(400), false);

console.log('iat protocol ok');
