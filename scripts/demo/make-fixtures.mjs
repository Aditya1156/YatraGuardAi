/**
 * Renders the demo fixtures: a photographed-looking bill and a menu board.
 *
 * The bill is built from real seeded Bengaluru items with a deliberate spread —
 * two items at the local rate, three marked up the way a tourist-facing place
 * marks them up — so the engine has something meaningful to disagree with
 * rather than a uniformly fair or uniformly fake receipt.
 *
 *   node scripts/demo/make-fixtures.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderText } from '../lib/bitmap-font.mjs';
import { encodePng } from '../lib/png.mjs';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** Seeded median → what this fictional MG Road cafe charges. */
const BILL_ITEMS = [
  { name: 'MASALA DOSA', qty: 2, unit: 150, seeded: 60 },
  { name: 'FILTER COFFEE', qty: 2, unit: 90, seeded: 20 },
  { name: 'IDLI', qty: 1, unit: 30, seeded: 30 },
  { name: 'MINERAL WATER 1L', qty: 2, unit: 60, seeded: 20 },
  { name: 'GOBI MANCHURIAN', qty: 1, unit: 130, seeded: 120 },
];

function money(value) {
  return String(value).padStart(6);
}

function buildBill() {
  const lines = [
    '   SRI LAKSHMI CAFE',
    '  MG ROAD, BENGALURU',
    '  GSTIN 29ABCDE1234F1Z5',
    '=========================',
    'BILL NO 4471   TABLE 07',
    '-------------------------',
    'ITEM            QTY  AMT',
    '-------------------------',
  ];

  let total = 0;
  for (const item of BILL_ITEMS) {
    const amount = item.qty * item.unit;
    total += amount;
    lines.push(`${item.name.slice(0, 15).padEnd(15)} ${String(item.qty).padStart(2)}${money(amount)}`);
  }

  const tax = Math.round(total * 0.05);
  lines.push(
    '-------------------------',
    `SUB TOTAL          ${money(total)}`,
    `CGST 2.5 PCT       ${money(Math.round(tax / 2))}`,
    `SGST 2.5 PCT       ${money(Math.round(tax / 2))}`,
    `TOTAL              ${money(total + tax)}`,
    '=========================',
    '   THANK YOU  VISIT AGAIN',
  );

  return lines;
}

const MENU_LINES = [
  '    ANNAPURNA MESS',
  '   PURE VEG - SINCE 1978',
  '=============================',
  'TIFFIN',
  '  IDLI VADA SAMBAR      45',
  '  BENNE DOSA            70',
  '  RAVA IDLI             45',
  '  KHARA BATH            35',
  '  POORI SAGU            50',
  '',
  'RICE',
  '  BISI BELE BATH        60',
  '  CURD RICE             45',
  '  VEG BIRYANI          170',
  '  NEER DOSA             55',
  '',
  'NORTH INDIAN',
  '  PANEER BUTTER MASALA 220',
  '  BUTTER NAAN           60',
  '  GOBI MANCHURIAN      120',
  '',
  'DRINKS',
  '  FILTER COFFEE         20',
  '  BADAM MILK            40',
  '  LASSI                 50',
];

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'bill.png', lines: buildBill(), scale: 5 },
  { file: 'menu.png', lines: MENU_LINES, scale: 5 },
];

for (const target of targets) {
  const { pixels, width, height } = renderText(target.lines, { scale: target.scale, padding: 30 });
  writeFileSync(join(OUT_DIR, target.file), encodePng(pixels, width, height));
  console.log(`  wrote fixtures/${target.file} (${width}x${height})`);
}
