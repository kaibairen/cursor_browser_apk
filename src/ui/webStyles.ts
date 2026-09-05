import { Platform, type TextStyle } from 'react-native';

/** Browser default focus ring is a sharp orange box on web TextInput. */
export const webNoOutline = (
  Platform.OS === 'web'
    ? {
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
      }
    : null
) as TextStyle | null;
