import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button, Field } from '../../ui/primitives';
import { settingsStyles as styles } from '../../ui/settingsChrome';
import { iatConfigured, readIatCredentials, writeIatCredentials } from '../speech/credentials';

export function SpeechPanel() {
  const [appId, setAppId] = useState('');
  const [xfKey, setXfKey] = useState('');
  const [xfSecret, setXfSecret] = useState('');
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void readIatCredentials().then((creds) => {
      if (!creds) return;
      setAppId(creds.appId);
      setXfKey(creds.apiKey);
      setXfSecret(creds.apiSecret);
      setReady(true);
    });
  }, []);

  return (
    <>
      <Text style={styles.meta}>
        按住作曲家里的「语音」说话。密钥只存在这台设备上。要开通「语音听写（流式版）」，Spark Lite 聊天接口不能转文字。
      </Text>
      <Field value={appId} onChangeText={setAppId} placeholder="APPID" />
      <Field value={xfKey} onChangeText={setXfKey} placeholder="APIKey" />
      <Field value={xfSecret} onChangeText={setXfSecret} placeholder="APISecret" secureTextEntry />
      <Button
        title={ready ? '更新听写密钥' : '保存听写密钥'}
        variant="ghost"
        disabled={!iatConfigured({ appId, apiKey: xfKey, apiSecret: xfSecret })}
        onPress={() => {
          void writeIatCredentials({ appId, apiKey: xfKey, apiSecret: xfSecret }).then(() => {
            setReady(true);
            setSaved('听写密钥已保存');
          });
        }}
      />
      {saved ? <Text style={styles.ok}>{saved}</Text> : null}
    </>
  );
}
