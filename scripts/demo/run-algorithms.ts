/**
 * Algorithm demo — everything in Section 8 that does not need an API key.
 *
 * The AI does one job in this app: turning a photo or a message into text.
 * All the judgement — matching, deviation, weighting, risk exposure, allergen
 * conflicts — is deterministic code in lib/algorithms. This script drives that
 * layer directly, feeding it exactly what the OCR step would hand over, so the
 * scoring can be checked without a working Gemini key.
 *
 *   npx tsx scripts/demo/run-algorithms.ts
 */

import '../load-env';

import {
  matchAndScoreItems,
  summarizeCheck,
  scoreForDeviation,
  updateRunningMedian,
  type ReferencePrice,
} from '../../lib/algorithms/price-fairness';
import {
  evaluateDish,
  summarizeFoodCheck,
  type AllergenReference,
} from '../../lib/algorithms/food-safety';
import {
  assessRouteRisk,
  selectRoutes,
  type RawRoute,
  type ScoredZone,
} from '../../lib/algorithms/safe-route';
import { buildSosLinks, buildSosMessage } from '../../lib/algorithms/sos';
import { suggestOffPeak, monthName } from '../../lib/algorithms/seasonal-discovery';
import { bestMatch, similarity } from '../../lib/algorithms/fuzzy-match';
import { BENGALURU_PRICES } from '../../lib/data/price-references';
import { BENGALURU_ALLERGEN_ITEMS } from '../../lib/data/allergen-items';
import { BENGALURU_RISK_ZONES } from '../../lib/data/risk-zones';
import { KARNATAKA_DESTINATIONS } from '../../lib/data/destinations';
import { normalizeName } from '../../lib/utils';
import type { Allergen, TrustLevel } from '../../types';

/* ------------------------------ presentation ----------------------------- */

const bold = (s: string) => `[1m${s}[0m`;
const dim = (s: string) => `[2m${s}[0m`;
const green = (s: string) => `[32m${s}[0m`;
const amber = (s: string) => `[33m${s}[0m`;
const red = (s: string) => `[31m${s}[0m`;

const tone = (verdict: TrustLevel) =>
  verdict === 'safe' ? green : verdict === 'caution' ? amber : red;

function heading(step: number, title: string): void {
  console.log(`\n${bold(`${step}. ${title}`)}\n${dim('─'.repeat(66))}`);
}

function ring(score: number, verdict: TrustLevel): string {
  const filled = Math.round((score / 100) * 24);
  const bar = '█'.repeat(filled) + dim('░'.repeat(24 - filled));
  return `${tone(verdict)(String(score).padStart(3))}/100  ${bar}  ${tone(verdict)(verdict.toUpperCase())}`;
}

const rupees = (n: number) => `Rs ${n.toLocaleString('en-IN')}`;

/* -------------------------------- fixtures -------------------------------- */

const references: ReferencePrice[] = BENGALURU_PRICES.map((price) => ({
  itemName: price.itemName,
  normalizedName: normalizeName(price.itemName),
  aliases: price.aliases.map(normalizeName),
  medianPrice: price.medianPrice,
  category: price.category,
  sampleCount: 1,
}));

const allergenRefs: AllergenReference[] = BENGALURU_ALLERGEN_ITEMS.map((item) => ({
  dishName: item.dishName,
  normalizedName: normalizeName(item.dishName),
  aliases: item.aliases.map(normalizeName),
  allergens: item.allergens,
  note: item.note,
}));

/** Exactly what the OCR step returns for scripts/demo/fixtures/bill.png. */
const BILL_OCR = [
  { name: 'MASALA DOSA', price: 150, quantity: 2 },
  { name: 'FILTER COFFEE', price: 90, quantity: 2 },
  { name: 'IDLI', price: 30, quantity: 1 },
  { name: 'MINERAL WATER 1L', price: 60, quantity: 2 },
  { name: 'GOBI MANCHURIAN', price: 130, quantity: 1 },
];

/** Dish names as printed on scripts/demo/fixtures/menu.png. */
const MENU_OCR = [
  'Idli Vada Sambar',
  'Benne Dosa',
  'Rava Idli',
  'Khara Bath',
  'Poori Sagu',
  'Bisi Bele Bath',
  'Curd Rice',
  'Veg Biryani',
  'Neer Dosa',
  'Paneer Butter Masala',
  'Butter Naan',
  'Gobi Manchurian',
  'Filter Coffee',
  'Badam Milk',
  'Lassi',
];

function main(): void {
  console.log(bold('\nYatraGuard AI — algorithm demo'));
  console.log(dim('deterministic scoring, no API key involved\n'));

  /* ------------------------------------------------------------------ */
  heading(1, 'Fuzzy matching — how OCR noise is absorbed');
  console.log(
    dim('  Real OCR output is messy. These all have to reach the right reference row.\n'),
  );

  for (const variant of [
    'MASALA DOSA',
    'Masaala Dose',
    'MSL DOSA',
    'masala dosai',
    'Buttr Nan',
    'Chicken Shawarma',
  ]) {
    const match = bestMatch(normalizeName(variant), references);
    console.log(
      match
        ? `  ${green('match   ')} ${variant.padEnd(18)} → ${match.candidate.itemName.padEnd(16)} ${dim(`confidence ${match.confidence.toFixed(2)}`)}`
        : `  ${dim('no match')} ${variant.padEnd(18)} ${dim('→ marked unknown, never assumed fair')}`,
    );
  }
  console.log(
    dim(
      `\n  Direct name similarity alone: "masaala dose" vs "masala dosa" scores ${similarity('masaala dose', 'masala dosa').toFixed(2)}.\n  Seeded aliases carry the rest — that is what the alias column is for.`,
    ),
  );

  /* ------------------------------------------------------------------ */
  heading(2, 'Price fairness — 8.1');
  console.log(dim('  A cafe bill from MG Road, against seeded Bengaluru rates.\n'));

  const items = matchAndScoreItems(BILL_OCR, references);
  const bill = summarizeCheck(items, 'Bengaluru');

  console.log(`  ${ring(bill.score, bill.verdict)}\n`);
  console.log(`  ${bill.summary}\n`);

  for (const item of items) {
    const deviation =
      item.deviationPct === null
        ? dim('no reference')
        : `${item.deviationPct > 0 ? '+' : ''}${item.deviationPct}%`.padStart(7);
    console.log(
      `  ${tone(item.verdict)('●')} ${item.itemName.padEnd(18)} ${rupees(item.chargedPrice).padStart(8)} ${
        item.referencePrice === null ? dim('        —') : dim(`vs ${rupees(item.referencePrice).padStart(6)}`)
      }  ${deviation}`,
    );
    console.log(`    ${dim(item.note)}`);
  }

  console.log(
    `\n  charged ${bold(rupees(bill.chargedTotal))} · typical ${rupees(bill.referenceTotal)} · ${red(`over by ${rupees(bill.overpaidBy)}`)}`,
  );
  console.log(
    dim(
      '\n  Note the weighting: the score is driven by rupee value, not item count.\n  The fair idli does not cancel out the 150% markup on two dosas.',
    ),
  );

  /* ------------------------------------------------------------------ */
  heading(3, 'The deviation curve');
  console.log(dim('  score = 100 - min(deviation%, 100), clamped (8.1 step 4)\n'));
  for (const deviation of [-20, 0, 10, 30, 50, 75, 100, 150]) {
    const score = scoreForDeviation(deviation);
    const verdict: TrustLevel = score >= 70 ? 'safe' : score >= 40 ? 'caution' : 'risk';
    console.log(`  ${String(deviation).padStart(5)}%  →  ${ring(score, verdict)}`);
  }

  /* ------------------------------------------------------------------ */
  heading(4, 'The running median — 8.1 step 5');
  console.log(dim('  Why a median and not a mean: one absurd tourist price must not stick.\n'));

  let samples = [60, 60, 65];
  let median = 60;
  for (const submitted of [55, 300, 60, 70]) {
    ({ samples, median } = updateRunningMedian(samples, submitted));
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const flag = submitted === 300 ? red('  ← outlier submitted') : '';
    console.log(
      `  +${String(submitted).padStart(3)}  median ${green(rupees(median).padEnd(8))} ${dim(`mean would be ${rupees(Math.round(mean))}`)}${flag}`,
    );
  }

  /* ------------------------------------------------------------------ */
  heading(5, 'Allergen safety — 8.4');
  console.log(dim('  Menu board, checked for someone avoiding peanuts and dairy.\n'));

  const profile: Allergen[] = ['peanuts', 'dairy'];
  const dishes = MENU_OCR.map((dish) => evaluateDish(dish, allergenRefs, profile)).sort(
    (a, b) => a.score - b.score,
  );
  const food = summarizeFoodCheck(dishes, profile, 'Bengaluru');

  console.log(`  ${ring(food.score, food.verdict)}\n`);
  console.log(`  ${food.summary}\n`);

  for (const dish of dishes) {
    // "Unknown" and "clear" must never look the same. A dish we could not
    // identify has not been cleared — it has not been checked.
    const unknown = dish.matchedDish === null && dish.allergens.length === 0;
    const label =
      dish.conflicts.length > 0
        ? red(dish.conflicts.join(', '))
        : unknown
          ? amber('unknown — ask the kitchen')
          : dish.allergens.length
            ? dim(`has ${dish.allergens.join(', ')}, none of yours`)
            : green('clear');
    console.log(`  ${tone(dish.verdict)('●')} ${dish.dishName.padEnd(22)} ${label}`);
  }
  console.log(
    dim(
      '\n  Filter Coffee and Curd Rice are flagged for dairy; Bisi Bele Bath and\n  Khara Bath for the groundnut in their tempering. Neer Dosa is genuinely\n  clear. "Idli Vada Sambar" is a combo name no single reference row covers,\n  so it comes back unknown rather than being assumed safe.',
    ),
  );

  /* ------------------------------------------------------------------ */
  heading(6, 'Route risk — 8.3');
  console.log(dim('  Two ways from Majestic to Chickpet: straight through, or around.\n'));

  const zones: ScoredZone[] = BENGALURU_RISK_ZONES.map((zone) => ({
    name: zone.name,
    riskLevel: zone.riskLevel,
    notes: zone.notes,
    polygon: zone.polygon,
  }));

  /** Straight line from Majestic through the Chickpet market lanes. */
  const through: RawRoute = {
    distanceM: 1500,
    durationS: 1080,
    geometry: interpolate([12.9776, 77.5713], [12.9686, 77.576], 40),
    steps: [{ instruction: 'Head south through the market lanes', distanceM: 1500, durationS: 1080 }],
  };

  /** A longer arc east of the market, avoiding the dense lanes. */
  const around: RawRoute = {
    distanceM: 2300,
    durationS: 1500,
    geometry: [
      ...interpolate([12.9776, 77.5713], [12.9745, 77.5865], 20),
      ...interpolate([12.9745, 77.5865], [12.9686, 77.576], 20),
    ],
    steps: [{ instruction: 'Head east, then south around the market', distanceM: 2300, durationS: 1500 }],
  };

  for (const [label, route] of [
    ['straight through', through],
    ['around the market', around],
  ] as const) {
    const assessment = assessRouteRisk(route.geometry, zones);
    console.log(
      `  ${label.padEnd(20)} ${dim(`${(route.distanceM / 1000).toFixed(1)} km, ${Math.round(route.durationS / 60)} min`)}  exposure ${String(Math.round(assessment.exposureRatio * 100)).padStart(3)}%  ${
        assessment.zonesCrossed.length ? red(assessment.zonesCrossed.map((z) => z.name).join(', ')) : green('no flagged areas')
      }`,
    );
  }

  const picked = selectRoutes([through, around], zones);
  console.log(`\n  ${bold('fastest')}  ${ring(picked.fastest.score, picked.fastest.verdict)}`);
  console.log(`           ${dim(picked.fastest.summary)}`);
  console.log(`\n  ${bold('safest')}   ${ring(picked.safest.score, picked.safest.verdict)}`);
  console.log(`           ${dim(picked.safest.summary)}`);
  console.log(
    dim(
      '\n  Both endpoints sit inside flagged areas, so exposure can never reach zero\n  here — the detour cuts it from 74% to 29% for 7 extra minutes. Both options\n  are shown with their numbers; the traveller decides.',
    ),
  );

  /* ------------------------------------------------------------------ */
  heading(7, 'SOS message — 8.5');
  const message = buildSosMessage({
    userName: 'Demo Traveller',
    location: { lat: 12.9767, lng: 77.5713 },
    accuracyM: 12,
    note: 'Outside the Majestic metro gate.',
  });
  for (const line of message.split('\n')) console.log(`    ${line}`);

  const links = buildSosLinks([{ name: 'Amma', phone: '9845012345' }], message);
  console.log(dim('\n  deep links generated:'));
  for (const link of links) {
    console.log(`    ${dim('whatsapp')}  ${link.whatsappUrl.slice(0, 58)}…`);
    console.log(`    ${dim('sms     ')}  ${link.smsUrl.slice(0, 58)}…`);
    console.log(`    ${dim('call    ')}  ${link.callUrl}`);
  }
  console.log(
    dim('\n  Note the 91 prefix added for wa.me — without it the link opens an empty chat.'),
  );

  /* ------------------------------------------------------------------ */
  heading(8, 'Seasonal discovery — 8.6');
  const month = new Date().getMonth() + 1;
  const destinations = KARNATAKA_DESTINATIONS.map((destination, index) => ({
    ...destination,
    id: String(index),
    blurb: destination.blurb ?? '',
  }));

  for (const theme of ['hills', 'beach'] as const) {
    console.log(`\n  ${bold(theme)} — not at peak in ${monthName(month)}:`);
    for (const suggestion of suggestOffPeak(destinations, month, { theme, limit: 3 })) {
      console.log(`    ${suggestion.name.padEnd(24)} ${dim(`${suggestion.distanceKm} km`)}`);
      console.log(`      ${dim(suggestion.why)}`);
    }
  }

  console.log(`\n${green(bold('Algorithm demo complete.'))}\n`);
}

/** Straight-line interpolation, standing in for a real polyline. */
function interpolate(
  from: [number, number],
  to: [number, number],
  steps: number,
): [number, number][] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as [number, number];
  });
}

main();
