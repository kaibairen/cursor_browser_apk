import { PermissionsAndroid, Platform } from 'react-native';
import { startIatSession, type IatLiveSession } from '../../lib/iflytek/session';
import type { IatCredentials } from '../../lib/iflytek/protocol';
import { describeSpeechError } from './voice';

export type PcmCapture = {
  start: (onFrame: (pcm: Uint8Array) => void) => Promise<void>;
  stop: () => Promise<void>;
};

const TARGET_RATE = 16_000;

type NativeRecorder = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  addListener: (event: string, listener: (payload: { pcm?: string }) => void) => { remove: () => void };
};

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function loadNativeRecorder(): Promise<NativeRecorder | null> {
  try {
    const expo = await import('expo-modules-core');
    const required = (
      expo as { requireOptionalNativeModule?: (name: string) => NativeRecorder | null }
    ).requireOptionalNativeModule?.('PcmRecorder');
    return required ?? null;
  } catch {
    return null;
  }
}

function createNativePcmCapture(native: NativeRecorder): PcmCapture {
  let sub: { remove: () => void } | null = null;
  return {
    start: async (onFrame) => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('请允许麦克风后再试。');
        }
      }
      sub = native.addListener('audio', (payload) => {
        if (payload.pcm) onFrame(decodeBase64(payload.pcm));
      });
      await native.start();
    },
    stop: async () => {
      try {
        await native.stop();
      } finally {
        sub?.remove();
        sub = null;
      }
    },
  };
}

function floatTo16Bit(input: Float32Array, fromRate: number): Uint8Array {
  const ratio = fromRate / TARGET_RATE;
  const length = Math.max(1, Math.round(input.length / ratio));
  const bytes = new Uint8Array(length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < length; i += 1) {
    const sample = input[Math.min(input.length - 1, Math.floor(i * ratio))] ?? 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return bytes;
}

function createBrowserPcmCapture(): PcmCapture {
  let stop: (() => Promise<void>) | null = null;
  return {
    start: async (onFrame) => {
      const nav = typeof navigator === 'undefined' ? null : navigator;
      const getUserMedia = nav?.mediaDevices?.getUserMedia?.bind(nav.mediaDevices);
      if (!getUserMedia) {
        throw new Error('这个浏览器不支持麦克风。请换 Chrome，或直接打字。');
      }
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        throw new Error('当前是 HTTP，浏览器不给实时麦克风。请用 HTTPS / 真机，或直接打字。');
      }
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error('这个浏览器不支持麦克风。');
      const context = new AudioCtx({ sampleRate: TARGET_RATE });
      const stream = await getUserMedia({ audio: { channelCount: 1, echoCancellation: true } });
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(2048, 1, 1);
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        onFrame(floatTo16Bit(input, context.sampleRate || TARGET_RATE));
      };
      source.connect(processor);
      processor.connect(context.destination);
      stop = async () => {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach((track) => track.stop());
        await context.close();
      };
    },
    stop: async () => {
      await stop?.();
      stop = null;
    },
  };
}

export async function createPcmCapture(): Promise<PcmCapture> {
  if (Platform.OS === 'web') {
    return createBrowserPcmCapture();
  }
  const native = await loadNativeRecorder();
  if (native) return createNativePcmCapture(native);
  if (Platform.OS === 'android') {
    throw new Error('这台预览包还没有麦克风模块。重新打一版 APK 后再用语音。');
  }
  return createIosFileCapture();
}

async function createIosFileCapture(): Promise<PcmCapture> {
  const { Audio } = await import('expo-av');
  let recording: InstanceType<typeof Audio.Recording> | null = null;
  let onFrame: ((pcm: Uint8Array) => void) | null = null;
  return {
    start: async (next) => {
      onFrame = next;
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) throw new Error('请允许麦克风后再试。');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        isMeteringEnabled: false,
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/wav',
          bitsPerSecond: 128000,
        },
      });
      await rec.startAsync();
      recording = rec;
    },
    stop: async () => {
      const rec = recording;
      recording = null;
      if (!rec) return;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri || !onFrame) return;
      const { EncodingType, readAsStringAsync } = await import('expo-file-system/legacy');
      const data = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
      const bytes = decodeBase64(data);
      const pcm = stripWavHeader(bytes);
      const frame = 1280;
      for (let i = 0; i < pcm.length; i += frame) {
        onFrame(pcm.subarray(i, Math.min(pcm.length, i + frame)));
      }
    },
  };
}

function stripWavHeader(bytes: Uint8Array): Uint8Array {
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const id = String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!);
      const size = view.getUint32(offset + 4, true);
      if (id === 'data') return bytes.subarray(offset + 8, offset + 8 + size);
      offset += 8 + size;
    }
  }
  return bytes;
}

export async function startStreamingVoice(
  credentials: IatCredentials,
  onPreview: (text: string) => void,
): Promise<{ session: IatLiveSession; capture: PcmCapture }> {
  const capture = await createPcmCapture();
  const session = await startIatSession(credentials, onPreview);
  try {
    await capture.start((pcm) => session.push(pcm));
  } catch (error) {
    await session.stop().catch(() => undefined);
    throw new Error(describeSpeechError(error instanceof Error ? error.message : '请允许麦克风后再试。'));
  }
  return { session, capture };
}
