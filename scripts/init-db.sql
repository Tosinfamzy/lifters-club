-- Initialize database schemas
-- This runs automatically when the PostgreSQL container starts for the first time

-- Create schemas
CREATE SCHEMA IF NOT EXISTS exercise_lib;
CREATE SCHEMA IF NOT EXISTS training;

-- Grant permissions (if needed for specific users)
-- GRANT ALL ON SCHEMA exercise_lib TO gymapp;
-- GRANT ALL ON SCHEMA training TO gymapp;
