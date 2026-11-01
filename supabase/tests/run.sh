#!/usr/bin/env bash
# Runs the migration + RLS isolation tests against a throwaway local Postgres.
# Usage: PGHOST=/path/to/socket PGPORT=5544 PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
psql -q -v ON_ERROR_STOP=1 -c "drop database if exists familyfit_test" -c "create database familyfit_test"
psql -q -v ON_ERROR_STOP=1 -d familyfit_test -f supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d familyfit_test -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d familyfit_test -f supabase/seed.sql
psql -q -At -v ON_ERROR_STOP=1 -d familyfit_test -f supabase/tests/rls_test.sql
psql -q -At -v ON_ERROR_STOP=1 -d familyfit_test -f supabase/tests/fasting_recipes_test.sql
