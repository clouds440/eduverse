import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { PrismaClient } from '../generated/prisma/client';
export { Prisma, PrismaClient } from '../generated/prisma/client';
export * from '../generated/prisma/client';

type PrismaClientOptions = ConstructorParameters<typeof PrismaClient>[0];
type PoolConnectCallback = (
  err: Error | undefined,
  client: PoolClient | undefined,
  done: (release?: any) => void,
) => void;

const serializedQueryQueue = Symbol('serializedQueryQueue');

type SerializedPoolClient = PoolClient & {
  [serializedQueryQueue]?: Promise<void>;
};

function serializeCheckedOutClientQueries(client: PoolClient): PoolClient {
  const serializedClient = client as SerializedPoolClient;

  if (serializedClient[serializedQueryQueue]) {
    return client;
  }

  const originalQuery = client.query.bind(client) as (
    ...args: any[]
  ) => unknown;
  let queue = Promise.resolve();

  (client as { query: (...args: any[]) => unknown }).query = (
    ...args: any[]
  ) => {
    const callbackIndex = args.findIndex((arg) => typeof arg === 'function');

    const run = () => {
      if (callbackIndex === -1) {
        // `pg` exposes overloaded variadic query signatures that cannot be preserved by a wrapper.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return originalQuery(...args);
      }

      return new Promise<void>((resolve, reject) => {
        const nextArgs = [...args];
        const callback = nextArgs[callbackIndex] as (
          ...callbackArgs: any[]
        ) => void;

        nextArgs[callbackIndex] = (...callbackArgs: any[]) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            callback(...callbackArgs);
            resolve();
          } catch (error) {
            reject(toError(error));
          }
        };

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          originalQuery(...nextArgs);
        } catch (error) {
          reject(toError(error));
        }
      });
    };

    const result = queue.then(run, run);
    queue = Promise.resolve(result).then(
      () => undefined,
      () => undefined,
    );
    serializedClient[serializedQueryQueue] = queue;

    return callbackIndex === -1 ? result : undefined;
  };

  serializedClient[serializedQueryQueue] = queue;

  return client;
}

class SerializedTransactionPool extends Pool {
  connect(): Promise<PoolClient>;
  connect(callback: PoolConnectCallback): void;
  connect(callback?: PoolConnectCallback): Promise<PoolClient> | void {
    if (callback) {
      return super.connect(callback);
    }

    return super.connect().then(serializeCheckedOutClientQueries);
  }
}

function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize PrismaClient.');
  }

  return databaseUrl;
}

export function createDatabasePoolConfig(
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  return {
    connectionString: getDatabaseUrl(env),
    max: positiveInteger(env.DATABASE_POOL_MAX, 10),
    idleTimeoutMillis: positiveInteger(
      env.DATABASE_POOL_IDLE_TIMEOUT_MS,
      30_000,
    ),
    connectionTimeoutMillis: positiveInteger(
      env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
      5_000,
    ),
  };
}

export function createPrismaClientOptions(): PrismaClientOptions {
  const poolConfig = createDatabasePoolConfig();

  return {
    adapter: new PrismaPg(new SerializedTransactionPool(poolConfig), {
      disposeExternalPool: true,
    }),
  };
}

export function createPrismaClient() {
  return new PrismaClient(createPrismaClientOptions());
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function toError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value));
}
