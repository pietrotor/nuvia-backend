import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_FOLDER = './drizzle/migrations';

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

/**
 * Drizzle only runs journal entries whose `when` is greater than the last one
 * already applied, so an out-of-order timestamp makes it skip the migration
 * while still reporting success.
 */
function assertJournalIsOrdered(): void {
  const { entries } = JSON.parse(
    readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: JournalEntry[] };

  const details = entries
    .filter(
      (entry, index) => index > 0 && entry.when <= entries[index - 1].when,
    )
    .map(
      (entry) =>
        `${entry.tag} (when ${entry.when}) must come after ${entries[entries.indexOf(entry) - 1].tag} (when ${entries[entries.indexOf(entry) - 1].when})`,
    );
  if (details.length === 0) return;

  throw new Error(
    `Migration journal timestamps must strictly increase, otherwise Drizzle skips migrations silently. ${details.join('; ')}.`,
  );
}

async function main() {
  assertJournalIsOrdered();

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const db = drizzle(pool);

  console.log(
    `Running migrations on ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}...`,
  );
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log('Migrations completed successfully.');

  await pool.end();
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
