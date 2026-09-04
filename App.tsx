import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>cursor-browser-apk</Text>
      <Text style={styles.body}>
        Expo SDK 57 scaffold is ready. Cursor does not ship an official Android
        APK; on Android use Chrome to open cursor.com/agents and install the
        official PWA. Do not wrap cursor.com in a WebView.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: '#f0f6fc',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#c9d1d9',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
