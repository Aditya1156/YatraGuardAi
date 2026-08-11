import { NextResponse } from 'next/server';
import { ok, route } from '@/lib/api/respond';
import { PILOT_CITY, integrations } from '@/lib/config';
import { connectToDatabase } from '@/lib/db/mongoose';
import { PriceReferenceModel, RiskZoneModel, AllergenItemModel } from '@/lib/db/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/status — setup diagnostics.
 *
 * Reports which integrations are configured and whether the pilot city has
 * been seeded. Public on purpose: it exposes only booleans and row counts, and
 * it is the fastest way to tell a teammate why a module is not working yet.
 */
export const GET = route(async (): Promise<NextResponse> => {
  const configured = {
    database: integrations.database,
    gemini: integrations.gemini,
    routing: integrations.routing,
    firebaseAdmin: integrations.firebaseAdmin,
    firebaseClient: integrations.firebaseClient,
  };

  // Reported separately because `ready` below requires everything in
  // `configured` — an optional integration listed there would make a fully
  // working deployment report itself as not ready.
  const optional = {
    aiFallback: integrations.aiFallback,
  };

  let seed: { prices: number; riskZones: number; dishes: number } | null = null;
  let databaseReachable = false;

  if (configured.database) {
    try {
      await connectToDatabase();
      databaseReachable = true;
      const [prices, riskZones, dishes] = await Promise.all([
        PriceReferenceModel.countDocuments({ city: PILOT_CITY }),
        RiskZoneModel.countDocuments({ city: PILOT_CITY }),
        AllergenItemModel.countDocuments({ city: PILOT_CITY }),
      ]);
      seed = { prices, riskZones, dishes };
    } catch (error) {
      console.error('[status] database unreachable', error);
    }
  }

  const ready = Object.values(configured).every(Boolean) && databaseReachable && (seed?.prices ?? 0) > 0;

  return ok({ city: PILOT_CITY, configured, optional, databaseReachable, seed, ready });
});
