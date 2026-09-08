import { useEffect, useState } from 'react';
import { Pressable, Share, Text } from 'react-native';
import { readStartupLog } from '../../lib/startupLog';
import { settingsStyles as styles } from '../../ui/settingsChrome';

export function AboutPanel() {
  const [log, setLog] = useState('读取中…');

  useEffect(() => {
    const next = readStartupLog().trim();
    setLog(next || '没有启动日志。如果是网页，这里本来就没有；如果是 Android，说明当前安装包还没打点。');
  }, []);

  return (
    <>
      <Text style={styles.meta}>
        和网页、桌面 Cloud 是同一批任务。本地 Agent 要先移到 Cloud 才会出现。
      </Text>
      <Text style={styles.label}>启动日志</Text>
      <Text selectable style={styles.meta}>
        {log}
      </Text>
      <Pressable
        onPress={() => {
          void Share.share({ message: log });
        }}
      >
        <Text style={styles.ok}>分享启动日志</Text>
      </Pressable>
    </>
  );
}
