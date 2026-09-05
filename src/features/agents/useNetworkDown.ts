import { useEffect, useState } from 'react';
import { isNetworkDown, subscribeNetwork } from '../../lib/cursor/reconnect';

export function useNetworkDown(): boolean {
  const [down, setDown] = useState(isNetworkDown);
  useEffect(() => subscribeNetwork(() => setDown(isNetworkDown())), []);
  return down;
}
