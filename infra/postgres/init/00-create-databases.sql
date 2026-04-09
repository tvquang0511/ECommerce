-- This script runs only on FIRST initialization (empty data volume).
-- It creates one "admin" DB (POSTGRES_DB) and additional per-service DBs.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'user') THEN
    CREATE DATABASE "user";
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'payments') THEN
    CREATE DATABASE payments;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'inventory') THEN
    CREATE DATABASE inventory;
  END IF;
END $$;
