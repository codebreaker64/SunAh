import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { Message } from 'react-native-executorch';
import { FIXTURES, GATE_FIXTURES, Fixture } from '../src/fixtures';
import { textMessages } from '../src/prompt';
import { parseLetterResponse, scoreAgainst } from '../src/parse';
import { buildSpeechText } from '../src/speech';
import { speak, checkHealth, resolveOfflineVoices, voiceReport } from '../src/audio';
import { Settings } from '../src/config';
import { LANG_LABELS } from '../src/types';
import { COLORS, TYPE, pressed as pressStyle } from '../src/theme';

/**
 * The E2B viability test, blueprint sections 4 and 10.
 *
 * "Test fixtures 2 and 6 first, before writing any UI. If E2B fails them, you
 * need to know at 09:30, not 16:00."
 *
 * This runs the letters as TEXT, not images, which means it works before the
 * camera is wired and it isolates classification from OCR. If these pass but
 * the camera path fails, the problem is vision — and section 4 mitigation 4
 * (useOCR into a text-only prompt) is the fix.
 *
 * Scoring is automatic. Deciding pass/fail by eye at 09:30 on a hackathon
 * morning is how teams talk themselves into a model that doesn't work.
 */

interface Props {
  // The `useLLM` return value. Stateless generate() so fixture N is not
  // classified with fixtures 1..N-1 still in the conversation history.
  llm: { isReady: boolean; generate: (m: Message[]) => Promise<string> };
  settings: Settings;
  onBack: () => void;
}

interface Outcome {
  fixture: Fixture;
  passed: boolean;
  failures: string[];
  raw: string;
  ms: number;
}

export function FixtureRunner({ llm, settings, onBack }: Props) {
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  /**
   * Pre-flight the audio path without scanning a letter. Section 6 says to hit
   * /health from the phone before pitching; this does that plus actually
   * speaks, because a reachable server still tells you nothing about whether
   * the phone has a voice installed for the chosen language.
   */
  async function testVoice() {
    setVoiceNote('checking…');
    await resolveOfflineVoices();
    // Hokkien has no phone voice anywhere, so for nan we report on the
    // Mandarin voice that will actually speak.
    const want = settings.lang === 'nan' ? 'cmn' : settings.lang;
    const report = voiceReport(want);

    const health = await checkHealth(settings.laptopBaseUrl);
    const sample = buildSpeechText(FIXTURES[1].expected, settings.lang, settings.address);
    const fallback = buildSpeechText(FIXTURES[1].expected, 'cmn', settings.address);
    const src = await speak(sample, settings.lang, settings, true,
      settings.lang === 'nan' ? { text: fallback, lang: 'cmn' as const } : undefined);

    const laptop = health.ok
      ? `up (${health.vramGb ?? '?'} GB VRAM)`
      : 'unreachable';

    setVoiceNote(
      [
        `language: ${LANG_LABELS[settings.lang]}`,
        `${want} voices: ${report.total} (${report.offline} offline)`,
        report.chosen ? `using: ${report.chosen}` : '',
        report.offline === 0
          ? 'WARNING: no offline voice — this language speaks via Google servers, so the "fully offline" claim does not hold for it'
          : '',
        `laptop ${settings.laptopBaseUrl}: ${laptop}`,
        `played from: ${src}`,
        src === 'none'
          ? 'NO AUDIO — install the language pack in Android TTS settings'
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  async function run(set: Fixture[]) {
    if (!llm.isReady || running) return;
    setRunning(true);
    setOutcomes([]);
    const acc: Outcome[] = [];

    for (const fixture of set) {
      setCurrent(fixture.name);
      const started = Date.now();
      let raw = '';
      let passed = false;
      let failures: string[] = [];
      try {
        raw = await llm.generate(textMessages(fixture.text));
        const parsed = parseLetterResponse(raw);
        if (!parsed.ok) {
          failures = ['unparseable JSON'];
        } else {
          const scored = scoreAgainst(parsed.result, fixture.expected);
          passed = scored.passed;
          failures = scored.failures;
        }
      } catch (e) {
        failures = [`threw: ${String(e)}`];
      }
      acc.push({
        fixture,
        passed,
        failures,
        raw,
        ms: Date.now() - started,
      });
      setOutcomes([...acc]);
    }

    setCurrent(null);
    setRunning(false);
  }

  const gatePassed =
    outcomes.length > 0 &&
    GATE_FIXTURES.every((g) =>
      outcomes.some((o) => o.fixture.id === g.id && o.passed)
    );
  const gateRan = GATE_FIXTURES.every((g) =>
    outcomes.some((o) => o.fixture.id === g.id)
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>{'‹'} Back</Text>
        </Pressable>
        <Text style={styles.title}>E2B viability</Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed: p }) => [
            styles.button,
            styles.primary,
            (!llm.isReady || running) && styles.disabled,
            pressStyle(p),
          ]}
          disabled={!llm.isReady || running}
          onPress={() => run(GATE_FIXTURES)}
        >
          <Text style={styles.primaryText}>Run gate (2 & 6)</Text>
        </Pressable>
        <Pressable
          style={({ pressed: p }) => [
            styles.button,
            (!llm.isReady || running) && styles.disabled,
            pressStyle(p),
          ]}
          disabled={!llm.isReady || running}
          onPress={() => run(FIXTURES)}
        >
          <Text style={styles.buttonText}>Run all six</Text>
        </Pressable>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed: p }) => [styles.button, pressStyle(p)]}
          onPress={() => void testVoice()}
        >
          <Text style={styles.buttonText}>Test voice + laptop</Text>
        </Pressable>
      </View>

      {voiceNote ? <Text style={styles.voiceNote}>{voiceNote}</Text> : null}

      {!llm.isReady ? (
        <Text style={styles.note}>Waiting for the model to load…</Text>
      ) : null}

      {running ? (
        <View style={styles.runningRow}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.note}>{current}</Text>
        </View>
      ) : null}

      {gateRan && !running ? (
        <View
          style={[
            styles.verdict,
            { backgroundColor: gatePassed ? '#E8F5E9' : '#FDE8E8' },
          ]}
        >
          <Text
            style={[
              styles.verdictText,
              { color: gatePassed ? '#14401A' : '#7F1414' },
            ]}
          >
            {gatePassed
              ? 'GATE PASSED — classification is viable, build the UI'
              : 'GATE FAILED — this is the TEXT path, so OCR will not help. Fix the prompt (add/strengthen few-shot for the failing status) or move that decision into JS templates (§4).'}
          </Text>
        </View>
      ) : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {outcomes.map((o) => (
          <View
            key={o.fixture.id}
            style={[
              styles.row,
              { borderLeftColor: o.passed ? '#2E7D32' : '#C62828' },
            ]}
          >
            <Text style={styles.rowTitle}>
              {o.passed ? '✓' : '✕'}  {o.fixture.id}. {o.fixture.name}
              {o.fixture.viabilityGate ? '  (gate)' : ''}
            </Text>
            <Text style={styles.rowMeta}>{(o.ms / 1000).toFixed(1)}s</Text>
            {o.failures.map((f, i) => (
              <Text key={i} style={styles.failure}>
                {f}
              </Text>
            ))}
            {!o.passed ? (
              <Text style={styles.trap}>Watch for: {o.fixture.trap}</Text>
            ) : null}
            {!o.passed && o.raw ? (
              <Text style={styles.raw} numberOfLines={8}>
                {o.raw}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  back: { fontSize: TYPE.body, color: COLORS.primary },
  title: { fontSize: TYPE.body, fontWeight: '800', color: COLORS.ink },
  buttons: { flexDirection: 'row', gap: 10, paddingHorizontal: 18 },
  button: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primary: { backgroundColor: COLORS.primary },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: TYPE.small },
  buttonText: { color: COLORS.primary, fontWeight: '800', fontSize: TYPE.small },
  disabled: { opacity: 0.4 },
  note: { paddingHorizontal: 18, paddingTop: 12, color: COLORS.muted, fontSize: TYPE.small },
  voiceNote: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F2F2F2',
    color: COLORS.ink,
    fontSize: TYPE.small - 2,
    lineHeight: (TYPE.small - 2) * 1.5,
  },
  runningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  verdict: { margin: 18, marginBottom: 4, padding: 14, borderRadius: 12 },
  verdictText: { fontSize: TYPE.small, fontWeight: '800' },
  list: { flex: 1, marginTop: 12 },
  listContent: { paddingHorizontal: 18, paddingBottom: 32 },
  row: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  rowTitle: { fontSize: TYPE.small, fontWeight: '700', color: COLORS.ink },
  rowMeta: { fontSize: TYPE.small - 3, color: COLORS.muted, marginTop: 2 },
  failure: { fontSize: TYPE.small - 2, color: '#C62828', marginTop: 4 },
  trap: { fontSize: TYPE.small - 3, color: COLORS.muted, marginTop: 6, fontStyle: 'italic' },
  raw: {
    fontSize: TYPE.small - 4,
    color: COLORS.muted,
    marginTop: 6,
    fontFamily: 'monospace',
  },
});
