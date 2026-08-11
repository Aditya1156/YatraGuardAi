import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';
import { ALLERGENS, PRICE_CATEGORIES } from '@/types';

/**
 * Mongoose schemas for Section 6 of the master prompt.
 *
 * Every model is registered through `defineModel`, which reuses an existing
 * compiled model — Next.js hot-reload re-executes this file and Mongoose throws
 * `OverwriteModelError` otherwise.
 */
function defineModel<S extends Schema>(name: string, schema: S): Model<InferSchemaType<S>> {
  // The cast is needed because Mongoose's `model()` returns a richer generic
  // than `Model<InferSchemaType<S>>`; the runtime shape is identical.
  return (models[name] ?? model(name, schema)) as unknown as Model<InferSchemaType<S>>;
}

const timestamps = { timestamps: true } as const;

/* -------------------------------------------------------------------------- */
/* User                                                                        */
/* -------------------------------------------------------------------------- */

const trustedContactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    /** Firebase UID, or `guest:<id>` when demo sign-in is enabled. */
    authId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 20 },
    city: { type: String, required: true, index: true },
    allergyProfile: { type: [String], enum: ALLERGENS, default: [] },
    trustedContacts: { type: [trustedContactSchema], default: [] },
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  timestamps,
);

export const UserModel = defineModel('User', userSchema);
export type UserDoc = InferSchemaType<typeof userSchema>;

/* -------------------------------------------------------------------------- */
/* Price reference + checks (8.1)                                              */
/* -------------------------------------------------------------------------- */

const priceReferenceSchema = new Schema(
  {
    city: { type: String, required: true, index: true },
    category: { type: String, enum: PRICE_CATEGORIES, required: true },
    itemName: { type: String, required: true, trim: true },
    /** Lowercased, punctuation-stripped form used for fuzzy matching. */
    normalizedName: { type: String, required: true, index: true },
    aliases: { type: [String], default: [] },
    medianPrice: { type: Number, required: true, min: 0 },
    /** Kept so the running median can be recomputed from confirmed checks. */
    samples: { type: [Number], default: [] },
    sampleCount: { type: Number, default: 1, min: 0 },
    unit: { type: String, default: 'each' },
    source: { type: String, enum: ['seed', 'user-confirmed'], default: 'seed' },
  },
  timestamps,
);
priceReferenceSchema.index({ city: 1, normalizedName: 1 }, { unique: true });

export const PriceReferenceModel = defineModel('PriceReference', priceReferenceSchema);
export type PriceReferenceDoc = InferSchemaType<typeof priceReferenceSchema>;

const priceCheckSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    city: { type: String, required: true, index: true },
    items: [
      {
        _id: false,
        itemName: String,
        matchedItem: String,
        chargedPrice: Number,
        referencePrice: Number,
        deviationPct: Number,
        verdict: String,
      },
    ],
    chargedTotal: { type: Number, required: true },
    referenceTotal: { type: Number, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    verdict: { type: String, enum: ['safe', 'caution', 'risk'], required: true },
  },
  timestamps,
);

export const PriceCheckModel = defineModel('PriceCheck', priceCheckSchema);
export type PriceCheckDoc = InferSchemaType<typeof priceCheckSchema>;

/* -------------------------------------------------------------------------- */
/* Scam reports (8.2)                                                          */
/* -------------------------------------------------------------------------- */

const scamReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    city: { type: String, required: true, index: true },
    rawText: { type: String, required: true, maxlength: 5000 },
    category: { type: String, enum: ['safe', 'suspicious', 'scam'], required: true, index: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    score: { type: Number, required: true, min: 0, max: 100 },
    explanation: { type: String, required: true },
    signals: { type: [String], default: [] },
    /** Short human-readable label shown on the alert card. Model-generated, so
     * the exact wording varies between reports of the same scam. */
    pattern: { type: String, required: true, index: true },
    /** Deterministic key the alert feed groups on — see patternKey(). */
    patternKey: { type: String, required: true, index: true },
  },
  timestamps,
);

export const ScamReportModel = defineModel('ScamReport', scamReportSchema);
export type ScamReportDoc = InferSchemaType<typeof scamReportSchema>;

/* -------------------------------------------------------------------------- */
/* Risk zones (8.3)                                                            */
/* -------------------------------------------------------------------------- */

const riskZoneSchema = new Schema(
  {
    city: { type: String, required: true, index: true },
    name: { type: String, required: true },
    /** GeoJSON Polygon — coordinates are [lng, lat], per the spec. */
    polygon: {
      type: { type: String, enum: ['Polygon'], default: 'Polygon' },
      coordinates: { type: [[[Number]]], required: true },
    },
    riskLevel: { type: Number, required: true, min: 1, max: 5 },
    source: { type: String, enum: ['curated', 'user-report'], default: 'curated' },
    notes: { type: String, default: '' },
    /** When this zone is worst, e.g. "after 21:00" — shown in the route summary. */
    activeHours: { type: String, default: '' },
  },
  timestamps,
);
riskZoneSchema.index({ polygon: '2dsphere' });

export const RiskZoneModel = defineModel('RiskZone', riskZoneSchema);
export type RiskZoneDoc = InferSchemaType<typeof riskZoneSchema>;

/* -------------------------------------------------------------------------- */
/* Allergen items (8.4)                                                        */
/* -------------------------------------------------------------------------- */

const allergenItemSchema = new Schema(
  {
    dishName: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, index: true },
    city: { type: String, required: true, index: true },
    allergens: { type: [String], enum: ALLERGENS, default: [] },
    aliases: { type: [String], default: [] },
    /** Free text shown to the user, e.g. "chutney is usually groundnut-based". */
    note: { type: String, default: '' },
  },
  timestamps,
);
allergenItemSchema.index({ city: 1, normalizedName: 1 }, { unique: true });

export const AllergenItemModel = defineModel('AllergenItem', allergenItemSchema);
export type AllergenItemDoc = InferSchemaType<typeof allergenItemSchema>;

/* -------------------------------------------------------------------------- */
/* Destinations (8.6 stretch)                                                  */
/* -------------------------------------------------------------------------- */

const destinationSchema = new Schema(
  {
    name: { type: String, required: true },
    region: { type: String, required: true, index: true },
    theme: { type: String, enum: ['hills', 'beach', 'heritage', 'wildlife'], required: true },
    peakMonths: { type: [Number], default: [] },
    distanceKm: { type: Number },
    blurb: { type: String, default: '' },
  },
  timestamps,
);

export const DestinationModel = defineModel('Destination', destinationSchema);
export type DestinationDoc = InferSchemaType<typeof destinationSchema>;

/* -------------------------------------------------------------------------- */
/* SOS events (8.5)                                                            */
/* -------------------------------------------------------------------------- */

const sosEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    accuracyM: { type: Number },
    triggeredAt: { type: Date, default: () => new Date() },
    contactsNotified: { type: [String], default: [] },
    note: { type: String, default: '' },
  },
  timestamps,
);

export const SosEventModel = defineModel('SOSEvent', sosEventSchema);
export type SosEventDoc = InferSchemaType<typeof sosEventSchema>;
