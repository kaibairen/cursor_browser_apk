import { Tabs } from 'expo-router';
import { colors } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '收件箱' }} />
      <Tabs.Screen name="compose" options={{ title: '新建' }} />
      <Tabs.Screen name="settings" options={{ title: '设置' }} />
    </Tabs>
  );
}
