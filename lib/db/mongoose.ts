import mongoose from 'mongoose';
import { ConfigError, serverEnv } from '@/lib/config';

/**
 * Serverless-safe Mongoose connection.
 *
 * Vercel reuses warm lambdas, so the connection promise is cached on
 * `globalThis` — without this, every request opens a new pool and an M0 free
 * cluster hits its 500-connection ceiling almost immediately.
 */

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { __yatraguardMongoose?: MongooseCache };

const cache: MongooseCache = globalForMongoose.__yatraguardMongoose ?? {
  conn: null,
  promise: null,
};
globalForMongoose.__yatraguardMongoose = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!serverEnv.mongodbUri) {
    throw new ConfigError('MongoDB', ['MONGODB_URI']);
  }

  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    mongoose.set('strictQuery', true);
    cache.promise = mongoose
      .connect(serverEnv.mongodbUri, {
        dbName: serverEnv.mongodbDb,
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
      })
      .catch((error: unknown) => {
        // Clear the cached promise so the next request can retry a cold cluster.
        cache.promise = null;
        throw error;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(serverEnv.mongodbUri);
}
