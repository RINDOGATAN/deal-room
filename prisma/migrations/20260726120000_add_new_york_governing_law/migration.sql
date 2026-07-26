-- Add NEW_YORK as a first-class GoverningLaw value.
-- ADD VALUE is additive-only: existing enum values and rows are untouched.
ALTER TYPE "GoverningLaw" ADD VALUE IF NOT EXISTS 'NEW_YORK';
