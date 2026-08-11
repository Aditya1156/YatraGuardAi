/**
 * Seeds the pilot city's reference data.
 *
 * Idempotent — every write is an upsert keyed on (city, normalizedName), so
 * running it repeatedly refreshes the seed rows without duplicating them or
 * clobbering prices users have already confirmed.
 *
 *   npm run seed
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { PILOT_CITY } from '../lib/config';
import { connectToDatabase } from '../lib/db/mongoose';
import {
  AllergenItemModel,
  DestinationModel,
  PriceReferenceModel,
  RiskZoneModel,
} from '../lib/db/models';
import { BENGALURU_PRICES } from '../lib/data/price-references';
import { BENGALURU_RISK_ZONES } from '../lib/data/risk-zones';
import { BENGALURU_ALLERGEN_ITEMS } from '../lib/data/allergen-items';
import { KARNATAKA_DESTINATIONS } from '../lib/data/destinations';
import { normalizeName } from '../lib/utils';

async function seedPrices(): Promise<number> {
  const operations = BENGALURU_PRICES.map((price) => ({
    updateOne: {
      filter: { city: PILOT_CITY, normalizedName: normalizeName(price.itemName) },
      update: {
        $set: {
          city: PILOT_CITY,
          itemName: price.itemName,
          normalizedName: normalizeName(price.itemName),
          category: price.category,
          aliases: price.aliases.map(normalizeName),
          unit: price.unit,
        },
        // Never overwrite a median that users have already refined.
        $setOnInsert: {
          medianPrice: price.medianPrice,
          samples: [price.medianPrice],
          sampleCount: 1,
          source: 'seed' as const,
        },
      },
      upsert: true,
    },
  }));

  const result = await PriceReferenceModel.bulkWrite(operations);
  return result.upsertedCount + result.modifiedCount;
}

type RiskZoneBulkOps = Parameters<typeof RiskZoneModel.bulkWrite>[0];

async function seedRiskZones(): Promise<number> {
  // Mongoose infers a nested DocumentArray type for the GeoJSON coordinates,
  // which plain number[][][] does not structurally satisfy. The runtime value
  // is exactly what the schema expects, so the cast is at the boundary only.
  const operations = BENGALURU_RISK_ZONES.map((zone) => ({
    updateOne: {
      filter: { city: PILOT_CITY, name: zone.name },
      update: {
        $set: {
          city: PILOT_CITY,
          name: zone.name,
          riskLevel: zone.riskLevel,
          notes: zone.notes,
          activeHours: zone.activeHours,
          source: 'curated' as const,
          polygon: { type: 'Polygon' as const, coordinates: zone.polygon },
        },
      },
      upsert: true,
    },
  })) as unknown as RiskZoneBulkOps;

  const result = await RiskZoneModel.bulkWrite(operations);
  return result.upsertedCount + result.modifiedCount;
}

async function seedAllergenItems(): Promise<number> {
  const operations = BENGALURU_ALLERGEN_ITEMS.map((item) => ({
    updateOne: {
      filter: { city: PILOT_CITY, normalizedName: normalizeName(item.dishName) },
      update: {
        $set: {
          city: PILOT_CITY,
          dishName: item.dishName,
          normalizedName: normalizeName(item.dishName),
          allergens: item.allergens,
          aliases: item.aliases.map(normalizeName),
          note: item.note,
        },
      },
      upsert: true,
    },
  }));

  const result = await AllergenItemModel.bulkWrite(operations);
  return result.upsertedCount + result.modifiedCount;
}

async function seedDestinations(): Promise<number> {
  const operations = KARNATAKA_DESTINATIONS.map((destination) => ({
    updateOne: {
      filter: { name: destination.name },
      update: { $set: destination },
      upsert: true,
    },
  }));

  const result = await DestinationModel.bulkWrite(operations);
  return result.upsertedCount + result.modifiedCount;
}

async function main(): Promise<void> {
  console.log(`Seeding reference data for ${PILOT_CITY}…\n`);
  await connectToDatabase();

  const prices = await seedPrices();
  console.log(`  prices        ${String(prices).padStart(3)} written  (${BENGALURU_PRICES.length} in file)`);

  const zones = await seedRiskZones();
  console.log(`  risk zones    ${String(zones).padStart(3)} written  (${BENGALURU_RISK_ZONES.length} in file)`);

  const dishes = await seedAllergenItems();
  console.log(`  allergen list ${String(dishes).padStart(3)} written  (${BENGALURU_ALLERGEN_ITEMS.length} in file)`);

  const destinations = await seedDestinations();
  console.log(`  destinations  ${String(destinations).padStart(3)} written  (${KARNATAKA_DESTINATIONS.length} in file)`);

  console.log('\nDone.');
}

main()
  .catch((error: unknown) => {
    console.error('\nSeeding failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void mongoose.disconnect();
  });
