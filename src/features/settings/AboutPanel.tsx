import { useEffect, useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { readStartupLog, shareStartupLog } from '../../lib/startupLog';
import { settingsStyles as styles } from '../../ui/settingsChrome';

export function AboutPanel() {
  const [log, setLog] = useState('读取中…');
  const [copied, setCopied] = useState(false);

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
          void shareStartupLog(log).then(() => {
            if (Platform.OS === 'web') setCopied(true);
          });
        }}
      >
        <Text style={styles.ok}>{copied ? '已复制' : Platform.OS === 'web' ? '复制启动日志' : '分享启动日志'}</Text>
      </Pressable>
    </>
  );
}
