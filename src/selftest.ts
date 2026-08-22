/**
 * Node-side smoke test for the parts that don't need a phone: the JSON
 * recovery layers and the speech templates.
 *
 *   npx tsc -p tsconfig.selftest.json && node .selftest/selftest.js
 *
 * This proves the deterministic half of the pipeline before the Pixel is
 * even plugged in. It does not test Gemma — that is FixtureRunner's job,
 * on the device.
 */
import { FIXTURES } from './fixtures';
import { parseLetterResponse, scoreAgainst } from './parse';
import { buildSpeechText, toHanzi, parseAmount } from './speech';
import { LANGS, Lang } from './types';

let failures = 0;

function check(name: string, cond: boolean, detail = '') {
  if (!cond) {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    console.log(`  ok    ${name}`);
  }
}

console.log('\n== numbers ==');
check('toHanzi(132)', toHanzi(132) === '一百三十二', toHanzi(132));
check('toHanzi(102)', toHanzi(102) === '一百零二', toHanzi(102));
check('toHanzi(8)', toHanzi(8) === '八', toHanzi(8));
check('toHanzi(15)', toHanzi(15) === '十五', toHanzi(15));
check('toHanzi(27)', toHanzi(27) === '二十七', toHanzi(27));
check('toHanzi(450)', toHanzi(450) === '四百五十', toHanzi(450));
check('toHanzi(8500)', toHanzi(8500) === '八千五百', toHanzi(8500));

console.log('\n== amounts ==');
check('S$132.00 parses', parseAmount('S$132.00')?.dollars === 132);
check('NIL is not money', parseAmount('NIL') === null);
check('FREE is not money', parseAmount('FREE') === null);

console.log('\n== parser: clean JSON round-trips ==');
for (const f of FIXTURES) {
  const raw = JSON.stringify(f.expected);
  const out = parseLetterResponse(raw);
  if (!out.ok) {
    check(`fixture ${f.id}`, false, 'did not parse');
    continue;
  }
  const scored = scoreAgainst(out.result, f.expected);
  check(`fixture ${f.id} ${f.name}`, scored.passed, scored.failures.join('; '));
}

console.log('\n== parser: the ways a small model actually fails ==');
const messy: [string, string][] = [
  [
    'prose wrapper',
    'Sure! Here is the JSON:\n{"status":"SCAM_ALERT","sender":"Unknown","summary_english":"This is a scam.","action_items":[],"amount_due":"NIL","deadline":null,"source_quote":"transfer"}\nHope that helps!',
  ],
  [
    'fenced',
    '```json\n{"status":"INFO_ONLY","sender":"CPF","summary_english":"Money was credited.","action_items":[],"amount_due":"NIL","deadline":null,"source_quote":"CREDITED"}\n```',
  ],
  [
    'trailing comma',
    '{"status":"ACTION_REQUIRED","sender":"Town Council","summary_english":"Pay up.","action_items":["Pay"],"amount_due":"S$132.00","deadline":"2026-08-31","source_quote":"settle",}',
  ],
  [
    'truncated mid-object',
    '{"status":"CONDITIONAL","sender":"Town Council","summary_english":"Lift B is closed.","action_items":["Call if you use a wheelchair"',
  ],
  [
    'single quotes',
    "{'status':'INFO_ONLY','sender':'CPF','summary_english':'Nothing to do.','action_items':[],'amount_due':'NIL','deadline':null,'source_quote':'information only'}",
  ],
];
for (const [name, raw] of messy) {
  const out = parseLetterResponse(raw);
  check(`recovers: ${name}`, out.ok, out.ok ? '' : 'gave up');
}

console.log('\n== parser: dangerous inputs must NOT produce a date ==');
for (const bad of ['27 August', 'next Thursday', 'unclear', '2026-13-45']) {
  const out = parseLetterResponse(
    `{"status":"ACTION_REQUIRED","sender":"X","summary_english":"y","action_items":[],"amount_due":"NIL","deadline":"${bad}","source_quote":"z"}`
  );
  check(
    `"${bad}" -> null`,
    out.ok && out.result.deadline === null,
    out.ok ? String(out.result.deadline) : 'unparsed'
  );
}

console.log('\n== parser: unclassifiable letters default to CONDITIONAL ==');
{
  const out = parseLetterResponse(
    '{"status":"WHO_KNOWS","sender":"X","summary_english":"Something happened.","action_items":[],"amount_due":"NIL","deadline":null,"source_quote":"q"}'
  );
  check(
    'unknown status is read-this, not ignore-this',
    out.ok && out.result.status === 'CONDITIONAL',
    out.ok ? out.result.status : 'unparsed'
  );
}

console.log('\n== speech templates: every fixture x every language ==');
for (const f of FIXTURES) {
  for (const lang of LANGS as Lang[]) {
    const text = buildSpeechText(f.expected, lang);
    const ok =
      text.length > 10 &&
      !text.includes('undefined') &&
      !text.includes('null') &&
      !text.includes('NaN') &&
      !text.includes('[object');
    if (!ok) {
      check(`fixture ${f.id} / ${lang}`, false, text);
    }
  }
}
check('no template produced undefined/null/NaN', failures === 0);

console.log('\n== the two that matter, in Hokkien ==');
for (const f of FIXTURES.filter((x) => x.viabilityGate || x.id === 3 || x.id === 5)) {
  console.log(`  ${f.id}. ${f.name}`);
  console.log(`     ${buildSpeechText(f.expected, 'nan')}`);
}

console.log(
  failures === 0
    ? '\nALL PASS\n'
    : `\n${failures} FAILURE(S)\n`
);
process.exit(failures === 0 ? 0 : 1);
