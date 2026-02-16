-- Add visual style field for persisted bloodline card template selection

ALTER TABLE "BloodlineCard"
ADD COLUMN IF NOT EXISTS "visualStyle" TEXT DEFAULT 'noir';

