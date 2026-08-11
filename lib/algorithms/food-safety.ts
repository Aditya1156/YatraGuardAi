import { z } from 'zod';
import { generateJson, type ImagePart } from '@/lib/ai/gemini';
import { bestMatch } from '@/lib/algorithms/fuzzy-match';
import { normalizeName } from '@/lib/utils';
import {
  ALLERGENS,
  ALLERGEN_LABELS,
  type Allergen,
  type FlaggedDish,
  type FoodCheckResult,
} from '@/types';

/**
 * 8.4 Food & Health Safety.
 *
 * Menu photo → dish names (same OCR pipeline shape as 8.1) → fuzzy match
 * against the curated AllergenItem list → cross-reference the user's profile.
 *
 * Design rule from the master prompt: a flagged dish always names the specific
 * allergen. "Risky" alone is useless to someone with a peanut allergy.
 */

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

/* ------------------------- Allergen inference ---------------------------- */

export interface AllergenReference {
  dishName: string;
  normalizedName: string;
  aliases: string[];
  allergens: Allergen[];
  note: string;
}

/**
 * Ingredient words that betray an allergen even when the dish is not in the
 * curated list — a safety net so an unknown dish is not silently cleared.
 */
const INGREDIENT_HINTS: { allergen: Allergen; test: RegExp }[] = [
  { allergen: 'peanuts', test: /\b(peanut|groundnut|kadalekai|mungphali|chikki)\b/i },
  { allergen: 'dairy', test: /\b(paneer|butter|ghee|cheese|curd|dahi|malai|kheer|lassi|milk|khoya|rabri|kulfi)\b/i },
  { allergen: 'gluten', test: /\b(roti|naan|chapati|paratha|puri|bread|samosa|kachori|maida|wheat|rumali|bhatura|noodle|pasta)\b/i },
  { allergen: 'shellfish', test: /\b(prawn|shrimp|crab|lobster|squid|calamari|clam|mussel)\b/i },
  { allergen: 'eggs', test: /\b(egg|omelette|omlet|anda|bhurji|mayonnaise)\b/i },
  { allergen: 'soy', test: /\b(soy|soya|tofu|manchurian|schezwan|hakka|szechuan)\b/i },
];

export function inferAllergensFromName(dishName: string): Allergen[] {
  return INGREDIENT_HINTS.filter((hint) => hint.test.test(dishName)).map((hint) => hint.allergen);
}

function describe(allergens: Allergen[]): string {
  const labels = allergens.map((a) => ALLERGEN_LABELS[a].split(' / ')[0] ?? a);
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

export function evaluateDish(
  dishName: string,
  references: AllergenReference[],
  profile: Allergen[],
): FlaggedDish {
  const query = normalizeName(dishName);
  const match = bestMatch(query, references);

  const curated = match?.candidate.allergens ?? [];
  const inferred = inferAllergensFromName(dishName);
  const allergens = Array.from(new Set([...curated, ...inferred])) as Allergen[];
  const conflicts = allergens.filter((allergen) => profile.includes(allergen));

  const known = match !== null || inferred.length > 0;

  let verdict: FlaggedDish['verdict'];
  let score: number;
  let note: string;

  if (conflicts.length > 0) {
    verdict = 'risk';
    score = 10;
    note = match?.candidate.note
      ? `Contains ${describe(conflicts)}. ${match.candidate.note}`
      : `Contains ${describe(conflicts)} — one of your flagged allergens.`;
  } else if (!known) {
    // Unknown is never green: we have no basis to tell an allergic user it is fine.
    verdict = 'caution';
    score = 55;
    note = 'Not in the local list yet — ask the kitchen before ordering.';
  } else if (allergens.length > 0) {
    verdict = 'safe';
    score = 85;
    note = `Contains ${describe(allergens)}, none of which you flagged.`;
  } else {
    verdict = 'safe';
    score = 95;
    note = 'No tracked allergens recorded for this dish.';
  }

  return {
    dishName,
    matchedDish: match?.candidate.dishName ?? null,
    allergens,
    conflicts,
    verdict,
    score,
    matchConfidence: match ? Math.round(match.confidence * 100) / 100 : 0,
    note,
  };
}

export function summarizeFoodCheck(
  items: FlaggedDish[],
  profile: Allergen[],
  city: string,
): FoodCheckResult {
  const flagged = items.filter((item) => item.conflicts.length > 0);
  const unknownCount = items.filter((item) => item.matchedDish === null && item.allergens.length === 0).length;

  let score: number;
  let summary: string;

  if (profile.length === 0) {
    score = 100;
    summary = 'No allergens are set on your profile, so nothing could be flagged. Add them in Profile.';
  } else if (items.length === 0) {
    score = 50;
    summary = 'No dishes could be read from that photo. Try a straighter, closer shot.';
  } else if (flagged.length === 0) {
    score = unknownCount > 0 ? 75 : 95;
    summary =
      unknownCount > 0
        ? `Nothing on this menu matches your allergens, but ${unknownCount} ${unknownCount === 1 ? 'dish is' : 'dishes are'} unrecognised — ask before ordering those.`
        : 'Nothing on this menu matches your flagged allergens.';
  } else {
    // Score reflects how much of the menu is unsafe for this specific user.
    const ratio = flagged.length / items.length;
    score = Math.max(5, Math.round(40 - ratio * 35));
    const names = flagged.slice(0, 3).map((item) => item.dishName).join(', ');
    summary = `${flagged.length} of ${items.length} ${flagged.length === 1 ? 'dish contains' : 'dishes contain'} something you flagged — ${names}${flagged.length > 3 ? ' and more' : ''}.`;
  }

  return {
    city,
    items,
    score,
    verdict: flagged.length > 0 ? 'risk' : score >= 90 ? 'safe' : 'caution',
    summary,
    checkedAgainst: profile.length > 0 ? profile : [],
    unknownCount,
  };
}

export function isAllergen(value: string): value is Allergen {
  return (ALLERGENS as readonly string[]).includes(value);
}
