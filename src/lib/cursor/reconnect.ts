type Listener = () => void;

let failures = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function resetNetworkState(): void {
  failures = 0;
  emit();
}

export function noteNetworkOk(): void {
  if (failures === 0) return;
  failures = 0;
  emit();
}

export function noteNetworkFail(): void {
  failures += 1;
  emit();
}

export function networkFailureCount(): number {
  return failures;
}

export function isNetworkDown(): boolean {
  return failures >= 2;
}

export function networkBackoffMs(): number {
  if (failures <= 0) return 0;
  return Math.min(15_000, 1000 * 2 ** Math.min(failures - 1, 4));
}

export function fetchAttemptsWhenUnstable(): number {
  return isNetworkDown() ? 1 : 3;
}

export function subscribeNetwork(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
