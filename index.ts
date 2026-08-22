import { registerRootComponent } from 'expo';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

import App from './App';

// Required as of react-native-executorch 0.8.0 (section 7a). Without this the
// runtime has no adapter to download the .pte with, and the model never
// arrives — a failure that surfaces as a stuck loading screen, not an error.
// Must run before any hook mounts, which is why it lives here and not in App.
initExecutorch({
  resourceFetcher: ExpoResourceFetcher,
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
