import { useCallback, useEffect, useState } from 'react';
import { loadPrefs, savePrefs, type AppPrefs } from './prefs';

export function usePrefs() {
  const [prefs, setPrefs] = useState<AppPrefs | null>(null);

  const reload = useCallback(async () => {
    setPrefs(await loadPrefs());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = useCallback(async (partial: Partial<AppPrefs>) => {
    const current = await loadPrefs();
    const next = { ...current, ...partial };
    await savePrefs(next);
    setPrefs(next);
    return next;
  }, []);

  return { prefs, ready: prefs !== null, update, reload };
}
