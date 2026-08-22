import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { AudioSource, Lang, LetterResult } from '../src/types';
import { STATUS_STYLE, COLORS, TYPE } from '../src/theme';

/**
 * The result card, blueprint sections 7c and 9.
 *
 * This paints before any audio call, so even with the laptop unreachable the
 * senior gets colour, summary, amount and source quote. A blank card is the
 * only outcome that actually kills a demo, so every field degrades to
 * something rather than to nothing.
 */
interface Props {
  result: LetterResult;
  speechText: string;
  lang: Lang;
  audioSource: AudioSource;
  onReplay: () => void;
}

export function ResultCard({
  result,
  speechText,
  lang,
  audioSource,
  onReplay,
}: Props) {
  const style = STATUS_STYLE[result.status];
  const showAmount =
    result.amount_due && result.amount_due !== 'NIL' ? result.amount_due : null;

  return (
    <ScrollView
      style={[styles.card, { backgroundColor: style.bg, borderColor: style.border }]}
      contentContainerStyle={styles.cardContent}
    >
      <Text style={[styles.statusLabel, { color: style.text }]}>
        {style.label[lang]}
      </Text>

      {/* The spoken sentence, shown large. Section 9 step 4: when the laptop
          is unreachable there is no Hokkien audio, and this is the fallback —
          so it is always on screen, not only when audio fails. */}
      <Text style={[styles.speech, { color: style.text }]}>{speechText}</Text>

      <View style={styles.divider} />

      {showAmount ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Amount</Text>
          <Text style={styles.rowValueStrong}>{showAmount}</Text>
        </View>
      ) : null}

      {result.deadline ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>By</Text>
          <Text style={styles.rowValueStrong}>{result.deadline}</Text>
        </View>
      ) : null}

      {result.sender ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>From</Text>
          <Text style={styles.rowValue}>{result.sender}</Text>
        </View>
      ) : null}

      {result.summary_english ? (
        <Text style={styles.summary}>{result.summary_english}</Text>
      ) : null}

      {result.action_items.length > 0 ? (
        <View style={styles.actions}>
          {result.action_items.map((item, i) => (
            <Text key={i} style={styles.actionItem}>
              {'•'}  {item}
            </Text>
          ))}
        </View>
      ) : null}

      {/* Section 9: with E2B this stops being a nice-to-have. It is the
          mechanism by which a wrong answer is catchable by a family member. */}
      {result.source_quote ? (
        <View style={styles.quoteBox}>
          <Text style={styles.quoteLabel}>From the letter:</Text>
          <Text style={styles.quote}>{'“'}{result.source_quote}{'”'}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          onPress={onReplay}
          style={({ pressed }) => [
            styles.replay,
            { borderColor: style.border, opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Play again"
        >
          <Text style={[styles.replayText, { color: style.text }]}>
            {'▶'}  Play again
          </Text>
        </Pressable>

        {/* Only 'cloud' shows the glyph (section 7d). */}
        {audioSource === 'cloud' ? (
          <Text style={styles.cloud}>{'☁'}  voice from internet</Text>
        ) : null}
        {audioSource === 'none' ? (
          <Text style={styles.noAudio}>no voice — read the text above</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 3,
    borderRadius: 18,
    marginHorizontal: 14,
  },
  cardContent: {
    padding: 20,
    paddingBottom: 32,
  },
  statusLabel: {
    fontSize: TYPE.title,
    fontWeight: '800',
    marginBottom: 10,
  },
  speech: {
    fontSize: TYPE.huge,
    lineHeight: TYPE.huge * 1.35,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.hairline,
    marginVertical: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: TYPE.small,
    color: COLORS.muted,
    width: 74,
  },
  rowValue: {
    fontSize: TYPE.body,
    color: COLORS.ink,
    flex: 1,
  },
  rowValueStrong: {
    fontSize: TYPE.title,
    fontWeight: '800',
    color: COLORS.ink,
    flex: 1,
  },
  summary: {
    fontSize: TYPE.body,
    lineHeight: TYPE.body * 1.4,
    color: COLORS.ink,
    marginTop: 10,
  },
  actions: {
    marginTop: 12,
  },
  actionItem: {
    fontSize: TYPE.body,
    lineHeight: TYPE.body * 1.4,
    color: COLORS.ink,
    marginBottom: 6,
  },
  quoteBox: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  quoteLabel: {
    fontSize: TYPE.small - 2,
    color: COLORS.muted,
    marginBottom: 4,
  },
  quote: {
    fontSize: TYPE.small,
    lineHeight: TYPE.small * 1.4,
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 22,
    alignItems: 'flex-start',
  },
  replay: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  replayText: {
    fontSize: TYPE.body,
    fontWeight: '700',
  },
  cloud: {
    marginTop: 10,
    fontSize: TYPE.small,
    color: COLORS.muted,
  },
  noAudio: {
    marginTop: 10,
    fontSize: TYPE.small,
    color: COLORS.muted,
  },
});
