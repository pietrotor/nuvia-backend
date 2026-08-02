import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
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
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('Migrations completed successfully.');

  await pool.end();
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
