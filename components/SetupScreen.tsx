import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Switch,
} from 'react-native';
import { Lang, LANGS, LANG_LABELS } from '../src/types';
import { Address } from '../src/speech';
import { Settings } from '../src/config';
import { COLORS, TYPE, pressed as pressStyle } from '../src/theme';

/**
 * Setup, blueprint section 9.
 *
 * Language is set once, on first launch, by a family member or an AAC
 * volunteer — five large buttons labelled in their own scripts. Then never
 * shown again. The senior only ever sees one button.
 *
 * The same screen doubles as the settings gear afterwards, which is where the
 * laptop IP lives: hotspots hand out different addresses (section 7e).
 */
interface Props {
  settings: Settings;
  onDone: (s: Settings) => void;
  /** True on first launch: hides the technical rows behind a disclosure. */
  firstRun: boolean;
}

export function SetupScreen({ settings, onDone, firstRun }: Props) {
  const [lang, setLang] = useState<Lang>(settings.lang);
  const [address, setAddress] = useState<Address>(settings.address);
  const [url, setUrl] = useState(settings.laptopBaseUrl);
  const [allowCloud, setAllowCloud] = useState(settings.allowCloud);
  const [showAdvanced, setShowAdvanced] = useState(!firstRun);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Choose a language</Text>
      <Text style={styles.sub}>选择语言 · Pilih bahasa · மொழியைத் தேர்ந்தெடுக்கவும்</Text>

      {LANGS.map((l) => (
        <Pressable
          key={l}
          onPress={() => setLang(l)}
          style={({ pressed: p }) => [
            styles.langButton,
            lang === l && styles.langButtonActive,
            pressStyle(p),
          ]}
          accessibilityRole="radio"
          accessibilityState={{ selected: lang === l }}
        >
          <Text style={[styles.langText, lang === l && styles.langTextActive]}>
            {LANG_LABELS[l]}
          </Text>
          {l === 'nan' ? (
            <Text style={styles.langNote}>needs the laptop for voice</Text>
          ) : null}
        </Pressable>
      ))}

      {/* No neutral Hokkien address form exists, so this is asked rather than
          assumed. 'none' is the default and skips it entirely. */}
      <Text style={styles.heading2}>How should Sun Ah address you?</Text>
      <View style={styles.addressRow}>
        {(
          [
            ['none', 'Don’t use a name'],
            ['a-kong', '阿公  A-kong'],
            ['a-ma', '阿嬤  A-má'],
          ] as [Address, string][]
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setAddress(value)}
            style={({ pressed: p }) => [
              styles.chip,
              address === value && styles.chipActive,
              pressStyle(p),
            ]}
          >
            <Text
              style={[styles.chipText, address === value && styles.chipTextActive]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {showAdvanced ? (
        <View style={styles.advanced}>
          <Text style={styles.heading2}>Laptop address</Text>
          <Text style={styles.hint}>
            The laptop’s IP on your hotspot. Only used for Hokkien voice.
          </Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            placeholder="http://192.168.43.12:8000"
          />

          <View style={styles.switchRow}>
            <View style={styles.switchLabelBox}>
              {/* Section 3: label the toggle by what it costs the user, not by
                  the vendor behind it. */}
              <Text style={styles.switchLabel}>Better voice (uses internet)</Text>
              <Text style={styles.hint}>
                Off by default. When on, the card shows a cloud icon.
              </Text>
            </View>
            <Switch value={allowCloud} onValueChange={setAllowCloud} />
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setShowAdvanced(true)} style={styles.disclosure}>
          <Text style={styles.disclosureText}>Advanced settings</Text>
        </Pressable>
      )}

      <Pressable
        onPress={() =>
          onDone({
            ...settings,
            lang,
            address,
            laptopBaseUrl: url.trim().replace(/\/+$/, ''),
            allowCloud,
            setupDone: true,
          })
        }
        style={({ pressed: p }) => [styles.done, pressStyle(p)]}
        accessibilityRole="button"
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 22, paddingBottom: 48 },
  heading: {
    fontSize: TYPE.title,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 4,
  },
  heading2: {
    fontSize: TYPE.body,
    fontWeight: '800',
    color: COLORS.ink,
    marginTop: 26,
    marginBottom: 8,
  },
  sub: { fontSize: TYPE.small, color: COLORS.muted, marginBottom: 18 },
  langButton: {
    borderWidth: 2,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  langButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EAF2FA',
  },
  langText: { fontSize: TYPE.huge, color: COLORS.ink, fontWeight: '700' },
  langTextActive: { color: COLORS.primary },
  langNote: { fontSize: TYPE.small - 2, color: COLORS.muted, marginTop: 4 },
  addressRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderWidth: 2,
    borderColor: COLORS.hairline,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: '#EAF2FA' },
  chipText: { fontSize: TYPE.small, color: COLORS.ink },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },
  advanced: { marginTop: 4 },
  hint: { fontSize: TYPE.small - 2, color: COLORS.muted, marginBottom: 8 },
  input: {
    borderWidth: 2,
    borderColor: COLORS.hairline,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: TYPE.body,
    color: COLORS.ink,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    gap: 14,
  },
  switchLabelBox: { flex: 1 },
  switchLabel: { fontSize: TYPE.body, color: COLORS.ink, fontWeight: '600' },
  disclosure: { marginTop: 26, paddingVertical: 8 },
  disclosureText: { fontSize: TYPE.small, color: COLORS.primary },
  done: {
    marginTop: 34,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
  },
  doneText: { fontSize: TYPE.title, color: '#FFFFFF', fontWeight: '800' },
});
