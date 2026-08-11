import 'server-only';

import { z } from 'zod';
import { generateJson, type ImagePart } from './gemini';
import {
  buildResult,
  applyRules,
  classificationSchema,
  patternKey,
} from '@/lib/algorithms/scam-detector';
import type { ExtractedItem } from '@/lib/algorithms/price-fairness';
import type { ScamCheckResult } from '@/types';
import { normalizeName } from '@/lib/utils';

/**
 * Every call the app makes to Gemini lives here.
 *
 * The AI has exactly one job in this system: turning a photo or a message into
 * structured text. All the judgement that follows — matching, deviation,
 * weighting, allergen conflicts — is deterministic code in lib/algorithms,
 * which stays free of this module so it can be run and reasoned about without
 * a key. Keeping the boundary in one file is what makes that true.
 */

/* ----------------------------- 8.1 Bill OCR ------------------------------ */

const BILL_SYSTEM_PROMPT = `You read photographed Indian restaurant bills, shop receipts and price boards.
Return ONLY the line items a customer was charged for.

Rules:
- Prices are Indian Rupees. Strip currency symbols and thousands separators.
- Ignore subtotals, taxes, service charge, discounts, totals and change.
- Keep the item name exactly as printed, minus quantity prefixes.
- If a line has a quantity, set "quantity" and report "price" as the UNIT price.
- If the image is not a bill or price list, return an empty items array.
- Never invent items you cannot actually read.`;

const billSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        price: z.number().nonnegative().max(1_000_000),
        quantity: z.number().positive().max(100).optional(),
      }),
    )
    .max(60),
  readable: z.boolean().optional(),
});

export async function extractBillItems(image: ImagePart): Promise<ExtractedItem[]> {
  const result = await generateJson(
    {
      systemInstruction: BILL_SYSTEM_PROMPT,
      prompt:
        'Extract the charged line items from this bill. Respond as JSON: {"items":[{"name":string,"price":number,"quantity":number}],"readable":boolean}',
      image,
      temperature: 0,
    },
    billSchema,
  );

  return result.items.map((item) => ({
    name: item.name.trim(),
    price: item.price,
    quantity: item.quantity ?? 1,
  }));
}

/* ----------------------------- 8.4 Menu OCR ------------------------------ */

const MENU_SYSTEM_PROMPT = `You read photographed Indian restaurant menus and food boards.
Return every dish name you can read, in the order printed.

Rules:
- Dish names only — no prices, no section headers like "STARTERS", no descriptions.
- Keep regional spellings exactly as printed (e.g. "Dose", "Bisi Bele Bath").
- If the image is not a menu, return an empty dishes array.
- Never invent dishes.`;

const menuSchema = z.object({
  dishes: z.array(z.string().min(1).max(120)).max(80),
  readable: z.boolean().optional(),
});

export async function extractDishNames(image: ImagePart): Promise<string[]> {
  const result = await generateJson(
    {
      systemInstruction: MENU_SYSTEM_PROMPT,
      prompt:
        'List the dishes on this menu. Respond as JSON: {"dishes":[string],"readable":boolean}',
      image,
      temperature: 0,
    },
    menuSchema,
  );

  const seen = new Set<string>();
  return result.dishes
    .map((dish) => dish.trim())
    .filter((dish) => {
      const key = normalizeName(dish);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/* -------------------------- 8.2 Scam classification ---------------------- */

const SCAM_SYSTEM_PROMPT = `You classify messages received by tourists in India as scam, suspicious or safe.

Typical Indian scams to weigh heavily: OTP/PIN requests, KYC-expiry threats, fake
courier/customs fees, lottery or prize wins, fake police/FedEx/TRAI calls, UPI
"refund" requests that actually collect money, job-offer advance fees, fake hotel
or cab booking confirmations, and shortened links to non-official domains.

Judge the message itself, not the sender. Explain in one plain sentence a tired
traveller would understand. Never tell the user to comply with the message.`;

export async function classifyMessage(
  text: string,
): Promise<{ result: ScamCheckResult; pattern: string; patternKey: string }> {
  // The local rule pass runs regardless of what the model says, and can
  // override a soft verdict upward (see buildResult).
  const ruleHits = applyRules(text);

  const classification = await generateJson(
    {
      systemInstruction: SCAM_SYSTEM_PROMPT,
      prompt: `Classify this message a traveller received.

Respond as JSON:
{"category":"safe|suspicious|scam","confidence":0-1,"explanation":"one sentence","signals":["short phrase"],"pattern":"3-6 word label for this scam type"}

Message:
"""
${text.slice(0, 4000)}
"""`,
      temperature: 0.1,
    },
    classificationSchema,
  );

  return {
    result: buildResult(classification, ruleHits),
    pattern: classification.pattern,
    patternKey: patternKey(
      classification.pattern,
      ruleHits.map((hit) => hit.id),
    ),
  };
}
