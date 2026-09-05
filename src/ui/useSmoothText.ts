import { useEffect, useRef, useState } from 'react';

export function useSmoothText(target: string, enabled: boolean): string {
  const [visible, setVisible] = useState(target);
  const visibleRef = useRef(target);

  useEffect(() => {
    if (!enabled) {
      visibleRef.current = target;
      setVisible(target);
      return;
    }

    let frame = 0;
    const tick = () => {
      const current = visibleRef.current;
      if (target === current) return;
      if (!target.startsWith(current)) {
        visibleRef.current = target;
        setVisible(target);
        return;
      }
      const remain = target.length - current.length;
      const take = remain > 160 ? 12 : remain > 48 ? 5 : remain > 16 ? 2 : 1;
      const next = target.slice(0, current.length + take);
      visibleRef.current = next;
      setVisible(next);
      if (next.length < target.length) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled]);

  return enabled ? visible : target;
}
