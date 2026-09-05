import { Text } from 'react-native';
import { settingsStyles as styles } from '../../ui/settingsChrome';

export function AboutPanel() {
  return (
    <>
      <Text style={styles.meta}>
        和网页、桌面 Cloud 是同一批任务。本地 Agent 要先移到 Cloud 才会出现。
      </Text>
    </>
  );
}
