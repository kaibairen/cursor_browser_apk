const IAT_PUNCT_RE = /^[\s。．.？?！!，,、；;：:…—\-–~～'"“”‘’]+$/u;

export const HOLD_VOICE_MS = 280;

export function isSpokenPunctuation(text: string): boolean {
  return text.length > 0 && IAT_PUNCT_RE.test(text);
}

export function mergeSpokenText(previous: string, incoming: string): string {
  const prev = previous.replace(/\s+/g, ' ').trim();
  const next = incoming.replace(/\s+/g, ' ').trim();
  if (!next) return prev;
  if (!prev) return next;
  if (isSpokenPunctuation(next) && !isSpokenPunctuation(prev)) {
    return prev.endsWith(next) ? prev : `${prev}${next}`;
  }
  if (next.length < prev.length && prev.startsWith(next) && isSpokenPunctuation(prev.slice(next.length))) {
    return prev;
  }
  return next;
}

/** Put a finished IAT transcript after text the user already typed. */
export function attachSpoken(typed: string, spoken: string): string {
  const base = typed.replace(/\s+/g, ' ').trim();
  const next = spoken.replace(/\s+/g, ' ').trim();
  if (!next) return typed;
  if (!base) return next;
  if (isSpokenPunctuation(next)) {
    return base.endsWith(next) ? base : `${base}${next}`;
  }
  return `${base} ${next}`;
}

export function isVoiceHoldTap(heldMs: number, thresholdMs = HOLD_VOICE_MS): boolean {
  return heldMs < thresholdMs;
}

export function describeSpeechError(message: string): string {
  if (/rate_limited/i.test(message)) return '听写请求太密，请稍后再试。';
  if (/NotAllowedError|NotReadableError|permission|denied|请允许麦克风/i.test(message)) {
    return '请允许麦克风后再试。';
  }
  if (/getUserMedia|mediaDevices|secure context|NotSupportedError|不是 HTTPS/i.test(message)) {
    return '当前页面不能开麦克风。请用 HTTPS / 真机，或直接打字。';
  }
  return message || '听写服务不可用';
}
