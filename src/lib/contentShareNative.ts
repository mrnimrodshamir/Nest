import { Linking, Share } from 'react-native';
import { track } from '@/lib/analytics';
import { configureShareRuntime } from '@/lib/contentShare';

// Static app-start wiring avoids on-tap native-module loading. Arrow wrappers
// retain the React Native receivers that must not be detached.
configureShareRuntime({
  canOpenURL: (url) => Linking.canOpenURL(url),
  openURL: (url) => Linking.openURL(url),
  share: (payload) => Share.share(payload),
  dismissedAction: Share.dismissedAction,
}, track);
