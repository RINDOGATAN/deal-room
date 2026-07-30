-- Express-setup presets authored in the skill's presets.json
ALTER TABLE "contract_templates" ADD COLUMN "presets" JSONB;
