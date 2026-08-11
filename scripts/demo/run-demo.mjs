/**
 * End-to-end demo driver.
 *
 * Walks a real user journey against a running server — sign in, scan a bill,
 * check messages, set allergens, scan a menu, add a contact, fire SOS, read the
 * city feed — and prints what came back. Everything here goes through the same
 * HTTP API the PWA uses; nothing is stubbed.
 *
 *   npm run build && npx next start -p 3111
 *   node scripts/demo/run-demo.mjs http://localhost:3111
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:3111';
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

let cookie = '';

const bold = (s) => `[1m${s}[0m`;
const dim = (s) => `[2m${s}[0m`;
const green = (s) => `[32m${s}[0m`;
const amber = (s) => `[33m${s}[0m`;
const red = (s) => `[31m${s}[0m`;

const tone = (verdict) =>
  verdict === 'safe' ? green : verdict === 'caution' ? amber : red;

function heading(step, title) {
  console.log(`\n${bold(`${step}. ${title}`)}\n${dim('─'.repeat(64))}`);
}

/** Shows the Trust Ring the way the UI would, as a text gauge. */
function ring(score, verdict) {
  const filled = Math.round((score / 100) * 24);
  const bar = '█'.repeat(filled) + dim('░'.repeat(24 - filled));
  return `${tone(verdict)(String(score).padStart(3))}/100  ${bar}  ${tone(verdict)(verdict.toUpperCase())}`;
}

/** Thrown for expected API failures so the runner can decide whether to skip. */
class ApiFailure extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function call(path, { method = 'GET', body, form } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];

  const payload = await response.json();
  if (!payload.ok) {
    throw new ApiFailure(`${method} ${path} → ${response.status}: ${payload.error}`, payload.code);
  }
  return payload.data;
}

/**
 * Runs a step that depends on Gemini. If the AI is unreachable or the key is
 * rejected, the demo says so and carries on — the point is to show what the
 * deployment can and cannot currently do, not to die at the first missing key.
 */
async function aiStep(name, run) {
  try {
    await run();
    return true;
  } catch (error) {
    if (error instanceof ApiFailure && String(error.code ?? '').startsWith('AI_')) {
      console.log(`\n  ${amber('SKIPPED')} — ${name} needs the Gemini API.`);
      console.log(`  ${dim(error.message.replace(/^POST \S+ → \d+: /, ''))}`);
      return false;
    }
    throw error;
  }
}

async function imageForm(file) {
  const form = new FormData();
  form.append('image', new Blob([readFileSync(join(FIXTURES, file))], { type: 'image/png' }), file);
  return form;
}

const rupees = (n) => `Rs ${n.toLocaleString('en-IN')}`;

async function main() {
  console.log(bold('\nYatraGuard AI — end-to-end demo'));
  console.log(dim(`against ${BASE}\n`));

  /* ---------------------------------------------------------------- */
  heading(1, 'Deployment status');
  const status = await call('/api/status');
  console.log(`  city            ${status.city}`);
  for (const [name, ready] of Object.entries(status.configured)) {
    console.log(`  ${name.padEnd(15)} ${ready ? green('configured') : dim('not configured')}`);
  }
  console.log(
    `  seeded          ${status.seed.prices} prices, ${status.seed.riskZones} flagged areas, ${status.seed.dishes} dishes`,
  );

  /* ---------------------------------------------------------------- */
  heading(2, 'Sign in');
  const session = await call('/api/auth/session', {
    method: 'POST',
    body: { guest: true, name: 'Demo Traveller' },
  });
  console.log(`  signed in as ${session.user.name} (${session.user.city})`);

  /* ---------------------------------------------------------------- */
  heading(3, 'Price check — 8.1');
  await aiStep('reading the bill photo', async () => {
    console.log(dim('  photographing a cafe bill from MG Road…'));
    const price = await call('/api/price/check', {
      method: 'POST',
      form: await imageForm('bill.png'),
    });

    console.log(`\n  ${ring(price.score, price.verdict)}\n`);
    console.log(`  ${price.summary}\n`);
    for (const item of price.items) {
      const deviation =
        item.deviationPct === null
          ? dim('no reference')
          : `${item.deviationPct > 0 ? '+' : ''}${item.deviationPct}%`;
      console.log(
        `  ${tone(item.verdict)('●')} ${item.itemName.padEnd(22).slice(0, 22)} ${rupees(item.chargedPrice).padStart(9)}  ${
          item.referencePrice === null ? dim('     —') : dim(`vs ${rupees(item.referencePrice)}`)
        }  ${deviation}`,
      );
    }
    console.log(
      `\n  charged ${rupees(price.chargedTotal)} · typical ${rupees(price.referenceTotal)} · ${red(`over by ${rupees(price.overpaidBy)}`)}`,
    );
  });

  /* ---------------------------------------------------------------- */
  heading(4, 'Scam check — 8.2');
  const messages = [
    {
      label: 'Fake KYC threat',
      text: 'Dear Customer, your SBI account KYC has EXPIRED. Your account will be blocked within 24 hours. Update immediately at http://sbi-kyc-verify.xyz/update or share your OTP with our executive on 9876543210.',
    },
    {
      label: 'Airbnb-style off-platform payment',
      text: 'Hi! Thanks for booking the homestay in Indiranagar. Our payment gateway is down, so please transfer the Rs 8,000 advance to UPI id host.bengaluru@okaxis and send a screenshot. Booking will be cancelled in 2 hours otherwise.',
    },
    {
      label: 'Genuine delivery notification',
      text: 'Your Swiggy order from Vidyarthi Bhavan has been picked up and will arrive by 1:15 PM. Track it in the app.',
    },
  ];

  await aiStep('classifying messages', async () => {
    for (const message of messages) {
      const result = await call('/api/scam/check', { method: 'POST', body: { text: message.text } });
      console.log(`\n  ${bold(message.label)}`);
      console.log(`  ${ring(result.score, result.verdict)}`);
      console.log(
        `  verdict     ${tone(result.verdict)(result.category)} (confidence ${Math.round(result.confidence * 100)}%)`,
      );
      console.log(`  why         ${result.explanation}`);
      if (result.signals.length) console.log(`  signals     ${result.signals.join(' · ')}`);
      console.log(`  do          ${result.recommendedAction}`);
    }
  });

  /* ---------------------------------------------------------------- */
  heading(5, 'Menu check — 8.4');
  await call('/api/profile', {
    method: 'PATCH',
    body: { allergyProfile: ['peanuts', 'dairy'] },
  });
  console.log(dim('  profile set to: peanuts, dairy'));

  await aiStep('reading the menu photo', async () => {
    console.log(dim('  photographing a mess menu board…'));
    const food = await call('/api/food/check', {
      method: 'POST',
      form: await imageForm('menu.png'),
    });

    console.log(`\n  ${ring(food.score, food.verdict)}\n`);
    console.log(`  ${food.summary}\n`);
    for (const dish of food.items.slice(0, 12)) {
      const flag =
        dish.conflicts.length > 0
          ? red(dish.conflicts.join(', '))
          : dish.allergens.length
            ? dim(dish.allergens.join(', '))
            : dim('clear');
      console.log(`  ${tone(dish.verdict)('●')} ${dish.dishName.padEnd(24).slice(0, 24)} ${flag}`);
    }
    if (food.items.length > 12) console.log(dim(`  …and ${food.items.length - 12} more`));
  });

  /* ---------------------------------------------------------------- */
  heading(6, 'TrustCircle + SOS — 8.5');
  await call('/api/contacts', {
    method: 'POST',
    body: { name: 'Amma', phone: '9845012345' },
  });
  const sos = await call('/api/sos/trigger', {
    method: 'POST',
    body: {
      location: { lat: 12.9767, lng: 77.5713 },
      accuracyM: 12,
      note: 'Outside the Majestic metro gate.',
    },
  });
  console.log('  message that would be sent:\n');
  for (const line of sos.message.split('\n')) console.log(`    ${line}`);
  console.log(`\n  links prepared for ${sos.links.length} contact(s):`);
  for (const link of sos.links) {
    console.log(`    ${link.contact.name.padEnd(8)} whatsapp ${dim(link.whatsappUrl.slice(0, 46) + '…')}`);
  }

  /* ---------------------------------------------------------------- */
  heading(7, 'City scam feed — 8.2');
  const alerts = await call('/api/scam/alerts');
  for (const alert of alerts.alerts) {
    console.log(`  ${tone(alert.category === 'scam' ? 'risk' : 'caution')('●')} ${alert.pattern} ${dim(`(${alert.reportCount} report)`)}`);
  }

  /* ---------------------------------------------------------------- */
  heading(8, 'Flagged areas — 8.3');
  const zones = await call('/api/riskzones');
  for (const zone of zones.zones) {
    console.log(`  ${tone(zone.riskLevel >= 4 ? 'risk' : 'caution')('●')} L${zone.riskLevel} ${zone.name}`);
  }

  /* ---------------------------------------------------------------- */
  heading(9, 'Seasonal discovery — 8.6');
  const discover = await call('/api/destinations/suggest?theme=hills&limit=3');
  console.log(dim(`  off-peak hill stations for month ${discover.month}:\n`));
  for (const suggestion of discover.suggestions) {
    console.log(`  ${bold(suggestion.name)} ${dim(`${suggestion.distanceKm} km`)}`);
    console.log(`    ${suggestion.why}`);
  }

  console.log(`\n${green(bold('Demo complete.'))}\n`);
}

main().catch((error) => {
  console.error(`\n${red('Demo failed:')} ${error.message}\n`);
  process.exitCode = 1;
});
