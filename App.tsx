import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLLM, models } from 'react-native-executorch';

import { AudioSource, LetterResult } from './src/types';
import { visionMessages } from './src/prompt';
import { parseLetterResponse } from './src/parse';
import { buildSpeechText } from './src/speech';
import { speak, stopAudio } from './src/audio';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './src/config';
import { COLORS, TYPE } from './src/theme';
import { ResultCard } from './components/ResultCard';
import { SetupScreen } from './components/SetupScreen';
import { FixtureRunner } from './components/FixtureRunner';

/**
 * Sun Ah — one screen. Camera button, result card, settings gear. Nothing else.
 * Blueprint section 9.
 */

type Screen = 'scan' | 'setup' | 'test';

// Android draws under the status bar and RN's SafeAreaView is both deprecated
// and a no-op here, so the header collided with the clock and battery. Using
// the measured status-bar height keeps this pure JS — react-native-safe-area-
// context would work too but it is a native module, and adding one costs a
// rebuild plus a 4 GB model reload.
const TOP_INSET = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0;

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>('scan');

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LetterResult | null>(null);
  const [speechText, setSpeechText] = useState('');
  const [audioSource, setAudioSource] = useState<AudioSource>('none');
  const [failure, setFailure] = useState<string | null>(null);

  // Vision + audio capabilities are preset on the constant; on Android this
  // resolves to the Vulkan .pte. Do not hardcode the URL — the constant is
  // what guarantees the runtime matches the export (section 7a).
  const llm = useLLM({ model: models.llm.gemma4_e2b_multimodal() });

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setSettingsLoaded(true);
      if (!s.setupDone) setScreen('setup');
    });
  }, []);

  const persist = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
    setScreen('scan');
  }, []);

  const say = useCallback(
    async (text: string) => {
      const src = await speak(text, settings.lang, settings);
      setAudioSource(src);
    },
    [settings]
  );

  const onScan = useCallback(async () => {
    if (busy || !llm.isReady || !cameraRef.current) return;
    stopAudio();
    setBusy(true);
    setFailure(null);
    setResult(null);
    setAudioSource('none');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
        shutterSound: false,
      });
      if (!photo?.uri) throw new Error('no image');

      // generate(), not sendMessage(): every letter is judged on its own,
      // with no previous scan left in the conversation history.
      const raw = await llm.generate(visionMessages(photo.uri));
      const parsed = parseLetterResponse(raw);

      if (!parsed.ok) {
        // Section 7g: parse fails -> show summary_english if present, else
        // "couldn't read this one". Never a blank card.
        setFailure(
          parsed.partial.summary_english ??
            'Sorry — I could not read this one. Try again with more light, or ask someone at home.'
        );
        return;
      }

      // The card paints before any audio call (section 7c).
      setResult(parsed.result);
      const text = buildSpeechText(parsed.result, settings.lang, settings.address);
      setSpeechText(text);
      void say(text);
    } catch (e) {
      setFailure(
        'Sorry — I could not read this one. Try again with more light, or ask someone at home.'
      );
    } finally {
      setBusy(false);
    }
  }, [busy, llm, settings, say]);

  if (!settingsLoaded) {
    return (
      <View style={[styles.centered, { paddingTop: TOP_INSET }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (screen === 'setup') {
    return (
      <View style={[styles.root, { paddingTop: TOP_INSET }]}>
        <StatusBar style="dark" />
        <SetupScreen
          settings={settings}
          onDone={persist}
          firstRun={!settings.setupDone}
        />
      </View>
    );
  }

  if (screen === 'test') {
    return (
      <View style={[styles.root, { paddingTop: TOP_INSET }]}>
        <StatusBar style="dark" />
        <FixtureRunner llm={llm} onBack={() => setScreen('scan')} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: TOP_INSET }]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.brand}>孙仔 Sun Ah</Text>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setScreen('test')} hitSlop={12}>
            <Text style={styles.gear}>{'⚑'}</Text>
          </Pressable>
          <Pressable onPress={() => setScreen('setup')} hitSlop={12}>
            <Text style={styles.gear}>{'⚙'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Section 9: a frozen splash during a 30-second model load reads as a
          crash to a judge, so download and load progress are always visible. */}
      {!llm.isReady ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {llm.downloadProgress > 0 && llm.downloadProgress < 1
              ? `Downloading Gemma… ${Math.round(llm.downloadProgress * 100)}%`
              : 'Loading Gemma onto the phone…'}
          </Text>
          <Text style={styles.loadingHint}>First launch only. It stays on the phone.</Text>
          {llm.error ? (
            <Text style={styles.error}>{String(llm.error.message ?? llm.error)}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.body}>
        {result ? (
          <ResultCard
            result={result}
            speechText={speechText}
            lang={settings.lang}
            audioSource={audioSource}
            onReplay={() => void say(speechText)}
          />
        ) : failure ? (
          <View style={styles.failureBox}>
            <Text style={styles.failureText}>{failure}</Text>
          </View>
        ) : (
          <View style={styles.preview}>
            {permission?.granted ? (
              <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            ) : (
              <Pressable style={styles.permission} onPress={requestPermission}>
                <Text style={styles.permissionText}>
                  Tap to allow the camera
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {result || failure ? (
          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() => {
              stopAudio();
              setResult(null);
              setFailure(null);
              setAudioSource('none');
            }}
          >
            <Text style={styles.secondaryText}>Scan another letter</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.shutter,
              (!llm.isReady || busy) && styles.shutterDisabled,
              pressed && styles.pressed,
            ]}
            onPress={onScan}
            disabled={!llm.isReady || busy}
            accessibilityRole="button"
            accessibilityLabel="Read this letter"
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <Text style={styles.shutterText}>Read this letter</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  // Shifted left of the expo-dev-client floating button, whose touch target
  // sits over the top-right corner and swallows taps meant for these. Also
  // stops a judge opening the dev menu by accident during the pitch.
  headerRight: { flexDirection: 'row', gap: 18, marginRight: 80 },
  brand: { fontSize: TYPE.body, fontWeight: '800', color: COLORS.ink },
  gear: { fontSize: 24, color: COLORS.muted },
  loading: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 24 },
  loadingText: {
    marginTop: 12,
    fontSize: TYPE.body,
    color: COLORS.ink,
    textAlign: 'center',
  },
  loadingHint: { marginTop: 4, fontSize: TYPE.small, color: COLORS.muted },
  error: { marginTop: 10, fontSize: TYPE.small, color: '#C62828', textAlign: 'center' },
  body: { flex: 1 },
  preview: { flex: 1, marginHorizontal: 14, borderRadius: 18, overflow: 'hidden' },
  camera: { flex: 1 },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 18,
  },
  permissionText: { fontSize: TYPE.body, color: COLORS.primary, fontWeight: '700' },
  failureBox: {
    flex: 1,
    marginHorizontal: 14,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
  },
  failureText: {
    fontSize: TYPE.title,
    lineHeight: TYPE.title * 1.35,
    color: COLORS.ink,
    textAlign: 'center',
  },
  footer: { padding: 18 },
  shutter: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 26,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  shutterDisabled: { backgroundColor: '#9AB6CE' },
  shutterText: { fontSize: TYPE.huge, color: '#FFFFFF', fontWeight: '800' },
  secondary: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  secondaryText: { fontSize: TYPE.title, color: COLORS.primary, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
