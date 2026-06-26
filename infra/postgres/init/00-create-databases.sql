-- This script runs only on FIRST initialization (empty data volume).
-- It creates one "admin" DB (POSTGRES_DB) and additional per-service DBs.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'user') THEN
    CREATE DATABASE "user" OWNER ecommerce;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'order') THEN
    CREATE DATABASE "order" OWNER ecommerce;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'payments') THEN
    CREATE DATABASE payments OWNER ecommerce;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'inventory') THEN
    CREATE DATABASE inventory OWNER ecommerce;
  END IF;
END $$;
