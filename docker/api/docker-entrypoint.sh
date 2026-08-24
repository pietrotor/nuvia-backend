#!/bin/sh
set -eu

./node_modules/.bin/tsx src/infrastructure/persistence/drizzle/migrate.ts
exec node dist/main.js
