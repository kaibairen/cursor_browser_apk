import { useRef, useState } from 'react';
import { startStreamingVoice } from './pcm';
import { readIatCredentials } from './credentials';
import { attachSpoken, describeSpeechError, HOLD_VOICE_MS, isVoiceHoldTap } from './voice';

type Live = {
  stop: () => Promise<string>;
  captureStop: () => Promise<void>;
};

export function useVoiceInput(value: string, setValue: (next: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef<Live | null>(null);
  const startedAt = useRef(0);
  const base = useRef('');

  async function start() {
    if (live.current) return;
    setError(null);
    const credentials = await readIatCredentials();
    if (!credentials) {
      setError('先到设置里填讯飞 APPID / APIKey / APISecret。要开通「语音听写（流式版）」。');
      return;
    }
    base.current = value;
    startedAt.current = Date.now();
    try {
      const started = await startStreamingVoice(credentials, (text) => {
        setValue(attachSpoken(base.current, text));
      });
      live.current = {
        stop: started.session.stop,
        captureStop: started.capture.stop,
      };
      setListening(true);
    } catch (err) {
      live.current = null;
      setListening(false);
      setError(describeSpeechError(err instanceof Error ? err.message : '听写服务不可用'));
    }
  }

  async function stop() {
    const current = live.current;
    live.current = null;
    const held = Date.now() - startedAt.current;
    if (!current) {
      setListening(false);
      return;
    }
    try {
      await current.captureStop().catch(() => undefined);
      const spoken = await current.stop();
      if (isVoiceHoldTap(held, HOLD_VOICE_MS)) {
        setValue(base.current);
        return;
      }
      setValue(attachSpoken(base.current, spoken));
    } catch (err) {
      setError(describeSpeechError(err instanceof Error ? err.message : '听写服务不可用'));
    } finally {
      setListening(false);
    }
  }

  return {
    listening,
    error,
    onMicStart: () => void start(),
    onMicEnd: () => void stop(),
  };
}
