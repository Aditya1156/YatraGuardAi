import { z } from 'zod';
import { generateJson, type ImagePart } from '@/lib/ai/gemini';
import { bestMatch } from '@/lib/algorithms/fuzzy-match';
import { clamp, formatRupees, normalizeName } from '@/lib/utils';
import { trustLevelFor, type PriceCategory, type PriceCheckResult, type PriceLineItem } from '@/types';

/**
 * 8.1 Price Fairness Engine.
 *
 * Bill photo → Gemini OCR → fuzzy match against PriceReference → deviation →
 * Trust Ring score. Pure functions here; the API route owns I/O and persistence.
 */

/* ------------------------------- OCR step -------------------------------- */

const OCR_SYSTEM_PROMPT = `You read photographed Indian restaurant bills, shop receipts and price boards.
Return ONLY the line items a customer was charged for.

Rules:
- Prices are Indian Rupees. Strip currency symbols and thousands separators.
- Ignore subtotals, taxes, service charge, discounts, totals and change.
- Keep the item name exactly as printed, minus quantity prefixes.
- If a line has a quantity, set "quantity" and report "price" as the UNIT price.
- If the image is not a bill or price list, return an empty items array.
- Never invent items you cannot actually read.`;

const ocrSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        price: z.number().nonnegative().max(1_000_000),
        quantity: z.number().positive().max(100).optional(),
      }),
    )
    .max(60),
  currency: z.string().optional(),
  readable: z.boolean().optional(),
});

export interface ExtractedItem {
  name: string;
  price: number;
  quantity: number;
}

export async function extractBillItems(image: ImagePart): Promise<ExtractedItem[]> {
  const result = await generateJson(
    {
      systemInstruction: OCR_SYSTEM_PROMPT,
      prompt:
        'Extract the charged line items from this bill. Respond as JSON: {"items":[{"name":string,"price":number,"quantity":number}],"readable":boolean}',
      image,
      temperature: 0,
    },
    ocrSchema,
  );

  return result.items.map((item) => ({
    name: item.name.trim(),
    price: item.price,
    quantity: item.quantity ?? 1,
  }));
}

/* ---------------------------- Scoring step ------------------------------- */

export interface ReferencePrice {
  itemName: string;
  normalizedName: string;
  aliases: string[];
  medianPrice: number;
  category: PriceCategory;
  sampleCount: number;
}

/**
 * Section 8.1 step 4: score = 100 − min(deviation%, 100), clamped to 0–100.
 * Being charged *less* than the reference is not a problem, so negative
 * deviation scores a clean 100.
 */
export function scoreForDeviation(deviationPct: number): number {
  if (deviationPct <= 0) return 100;
  return clamp(Math.round(100 - Math.min(deviationPct, 100)), 0, 100);
}

export function deviationPercent(charged: number, reference: number): number {
  if (reference <= 0) return 0;
  return ((charged - reference) / reference) * 100;
}

function noteFor(reference: number | null, deviationPct: number | null): string {
  if (reference === null) {
    return 'No local reference price yet — confirm the fair price to add it.';
  }
  const deviation = deviationPct ?? 0;
  const referenceText = formatRupees(reference);

  if (deviation <= 5) return `Around the local rate of ${referenceText}.`;
  if (deviation <= 40) {
    return `About ${Math.round(deviation)}% over the local rate of ${referenceText}.`;
  }
  return `${Math.round(deviation)}% over the local rate of ${referenceText} — worth pushing back.`;
}

export function matchAndScoreItems(
  extracted: ExtractedItem[],
  references: ReferencePrice[],
): PriceLineItem[] {
  return extracted.map((item) => {
    const query = normalizeName(item.name);
    const match = bestMatch(query, references);

    const reference = match ? match.candidate.medianPrice : null;
    const deviation = reference !== null ? deviationPercent(item.price, reference) : null;
    const score = deviation !== null ? scoreForDeviation(deviation) : 50;

    return {
      itemName: item.name,
      matchedItem: match?.candidate.itemName ?? null,
      category: match?.candidate.category ?? null,
      chargedPrice: item.price,
      referencePrice: reference,
      deviationPct: deviation === null ? null : Math.round(deviation * 10) / 10,
      score,
      // An unmatched item is genuinely unknown, not safe — never show it green.
      verdict: reference === null ? 'caution' : trustLevelFor(score),
      matchConfidence: match ? Math.round(match.confidence * 100) / 100 : 0,
      note: noteFor(reference, deviation),
    };
  });
}

/**
 * Rolls line items into one bill verdict.
 *
 * The overall score is weighted by rupee value, not by item count — one ₹500
 * overcharge matters more than three fair ₹20 teas, and a plain average would
 * hide exactly that.
 */
export function summarizeCheck(items: PriceLineItem[], city: string): PriceCheckResult {
  const matched = items.filter((item) => item.referencePrice !== null);
  const chargedTotal = items.reduce((sum, item) => sum + item.chargedPrice, 0);
  const referenceTotal = matched.reduce((sum, item) => sum + (item.referencePrice ?? 0), 0);
  const matchedCharged = matched.reduce((sum, item) => sum + item.chargedPrice, 0);

  let score = 100;
  if (matched.length > 0) {
    const weighted = matched.reduce(
      (sum, item) => sum + item.score * Math.max(item.chargedPrice, 1),
      0,
    );
    const weight = matched.reduce((sum, item) => sum + Math.max(item.chargedPrice, 1), 0);
    score = Math.round(weighted / weight);
  } else if (items.length > 0) {
    score = 50; // nothing recognised — we genuinely do not know
  }

  const overpaidBy = Math.max(0, Math.round(matchedCharged - referenceTotal));
  const unmatchedCount = items.length - matched.length;

  return {
    id: null,
    city,
    items,
    chargedTotal: Math.round(chargedTotal),
    referenceTotal: Math.round(referenceTotal),
    overpaidBy,
    score,
    verdict: matched.length === 0 && items.length > 0 ? 'caution' : trustLevelFor(score),
    summary: buildSummary({ score, overpaidBy, matchedCount: matched.length, unmatchedCount, city }),
    unmatchedCount,
  };
}

function buildSummary(input: {
  score: number;
  overpaidBy: number;
  matchedCount: number;
  unmatchedCount: number;
  city: string;
}): string {
  if (input.matchedCount === 0) {
    return `Nothing on this bill matches a ${input.city} reference price yet. Confirm the items to help build the local list.`;
  }
  if (input.score >= 70) {
    return `This bill is close to typical ${input.city} prices.`;
  }
  if (input.score >= 40) {
    return `Some items run above typical ${input.city} prices — about ${formatRupees(input.overpaidBy)} extra.`;
  }
  return `This bill is well above typical ${input.city} prices — roughly ${formatRupees(input.overpaidBy)} extra.`;
}

/**
 * Section 8.1 step 5: fold a user-confirmed price into the running median.
 * A median (not a mean) so a single absurd tourist price cannot drag the
 * reference upward and legitimise itself over time.
 */
export function updateRunningMedian(samples: number[], newPrice: number, cap = 50): {
  samples: number[];
  median: number;
} {
  const next = [...samples, newPrice].slice(-cap).sort((a, b) => a - b);
  const middle = Math.floor(next.length / 2);
  const median =
    next.length % 2 === 0
      ? ((next[middle - 1] ?? 0) + (next[middle] ?? 0)) / 2
      : (next[middle] ?? newPrice);

  return { samples: next, median: Math.round(median * 100) / 100 };
}
