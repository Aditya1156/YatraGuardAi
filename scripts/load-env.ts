import { config } from 'dotenv';

/**
 * Loads environment files with Next.js's precedence: `.env.local` wins, `.env`
 * is the fallback.
 *
 * This lives in its own module and must be imported *first* by any script that
 * reads config. ES module imports are hoisted and evaluated before any
 * statement in the importing file runs, so calling dotenv inline would happen
 * after `lib/config` had already snapshotted an empty `process.env`.
 */
config({ path: '.env.local' });
config({ path: '.env' });
