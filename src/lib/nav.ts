import { useNavigation, useRouter, type Href } from 'expo-router';

export function useSafeBack(fallback: Href = '/home') {
  const router = useRouter();
  const navigation = useNavigation();

  return () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.replace(fallback);
  };
}
