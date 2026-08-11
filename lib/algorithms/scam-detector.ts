import { z } from 'zod';
import { clamp } from '@/lib/utils';
import { trustLevelFor, type ScamCategory, type ScamCheckResult } from '@/types';

/**
 * 8.2 Scam Detector.
 *
 * Pasted message → classification → score → Trust Ring. A local rule pass runs
 * alongside the AI verdict so the obvious cases (OTP requests, lottery wins,
 * lookalike UPI handles) are caught even when the model hedges.
 *
 * Pure, like 8.1 and 8.4 — the Gemini call lives in lib/ai/extract.ts and hands
 * its parsed output to `buildResult` here.
 */

export const classificationSchema = z.object({
  category: z.enum(['safe', 'suspicious', 'scam']),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(1).max(400),
  signals: z.array(z.string().max(120)).max(6).default([]),
  /** 3–6 word label used to group repeat reports into a city alert. */
  pattern: z.string().min(3).max(60),
});

export type ScamClassification = z.infer<typeof classificationSchema>;

/* --------------------------- Local rule pass ----------------------------- */

interface Rule {
  id: string;
  label: string;
  test: RegExp;
  weight: number;
}

const RULES: Rule[] = [
  { id: 'otp', label: 'Asks for an OTP or PIN', test: /\b(otp|one[-\s]?time\s?password|cvv|upi\s?pin|mpin)\b/i, weight: 3 },
  { id: 'kyc', label: 'KYC / account-block threat', test: /\b(kyc|aadhaar|pan\s?card)\b.{0,40}\b(expir|block|suspend|update|verif)/i, weight: 3 },
  { id: 'prize', label: 'Prize or lottery win', test: /\b(congratulation|you have won|lucky (winner|draw)|lottery|jackpot)\b/i, weight: 3 },
  { id: 'urgency', label: 'Artificial urgency', test: /\b(within \d+ (min|hour|hrs)|immediately|urgent(ly)?|last warning|account will be)\b/i, weight: 1 },
  { id: 'fee', label: 'Advance fee to release something', test: /\b(customs|clearance|processing|registration|security)\s?(fee|charge|deposit)\b/i, weight: 2 },
  { id: 'link', label: 'Shortened or lookalike link', test: /(bit\.ly|tinyurl|t\.me|is\.gd|rb\.gy|cutt\.ly|[a-z0-9-]+\.(?:xyz|top|club|online|shop)\b)/i, weight: 2 },
  { id: 'refund', label: 'UPI "refund" that collects money', test: /\b(refund|cashback)\b.{0,40}\b(upi|scan|qr|collect request|approve)\b/i, weight: 3 },
  { id: 'authority', label: 'Impersonates an authority', test: /\b(police|cyber cell|income tax|trai|customs officer|court notice|arrest)\b/i, weight: 2 },
  { id: 'job', label: 'Work-from-home / task job bait', test: /\b(work from home|part[-\s]?time job|daily (income|earning)|task (based )?job)\b/i, weight: 2 },
  { id: 'contact', label: 'Pushes you to WhatsApp/Telegram', test: /\b(whatsapp|telegram)\b.{0,30}\b(\+?\d[\d\s-]{7,})/i, weight: 1 },
];

export interface RuleHit {
  id: string;
  label: string;
  weight: number;
}

export function applyRules(text: string): RuleHit[] {
  return RULES.filter((rule) => rule.test.test(text)).map(({ id, label, weight }) => ({
    id,
    label,
    weight,
  }));
}

/* ------------------------------- Scoring --------------------------------- */

/** Section 8.2 step 3 base scores, then adjusted by the model's confidence. */
const BASE_SCORE: Record<ScamCategory, number> = { safe: 90, suspicious: 55, scam: 15 };

export function scoreForClassification(category: ScamCategory, confidence: number): number {
  const base = BASE_SCORE[category];
  const certainty = clamp(confidence, 0, 1);

  // Low confidence pulls every verdict toward the neutral middle, so a shaky
  // "safe" cannot show a reassuring green ring it has not earned.
  const neutral = 55;
  return Math.round(clamp(neutral + (base - neutral) * certainty, 0, 100));
}

const ACTION: Record<ScamCategory, string> = {
  safe: 'Nothing here looks like a scam, but never share an OTP with anyone.',
  suspicious: 'Do not click any link or send money. Verify through an official app or number first.',
  scam: 'Do not reply, click, pay or share any code. Block the sender and report it at cybercrime.gov.in.',
};

export function buildResult(
  classification: ScamClassification,
  ruleHits: RuleHit[],
): ScamCheckResult {
  let { category, confidence } = classification;

  // Hard local evidence overrides a soft AI verdict — an OTP request is a scam
  // regardless of how politely it is worded.
  const ruleWeight = ruleHits.reduce((sum, hit) => sum + hit.weight, 0);
  if (ruleWeight >= 3 && category === 'safe') {
    category = 'suspicious';
    confidence = Math.max(confidence, 0.6);
  }
  if (ruleWeight >= 5 && category !== 'scam') {
    category = 'scam';
    confidence = Math.max(confidence, 0.7);
  }

  const score = scoreForClassification(category, confidence);
  const signals = Array.from(
    new Set([...ruleHits.map((hit) => hit.label), ...classification.signals]),
  ).slice(0, 6);

  return {
    id: null,
    category,
    confidence: Math.round(confidence * 100) / 100,
    score,
    verdict: trustLevelFor(score),
    explanation: classification.explanation,
    signals,
    recommendedAction: ACTION[category],
  };
}

/**
 * Deterministic grouping key so repeat reports roll into one city alert.
 *
 * This deliberately does not key on the model's `pattern` label. That label is
 * free text regenerated per call, and the same fake-KYC message came back as
 * "Fake Bank KYC Phishing Scam", "Fake Bank KYC Expiry Scam" and "Fake bank KYC
 * update scam" across three runs — so grouping on it produced three separate
 * one-report alerts and the feed could never show a repeat, which is the entire
 * point of 8.2 step 4.
 *
 * The local rule ids are stable, so they key the group whenever any fired.
 * `urgency` is excluded as an identifier: nearly every scam is urgent, so it
 * describes tone rather than type and would merge unrelated scams into one
 * bucket. The normalised label remains the fallback for a message the rules
 * missed entirely.
 */
export function patternKey(pattern: string, ruleIds: readonly string[] = []): string {
  const identifying = Array.from(new Set(ruleIds)).filter((id) => id !== 'urgency').sort();
  if (identifying.length > 0) return identifying.join('+');

  return pattern.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
