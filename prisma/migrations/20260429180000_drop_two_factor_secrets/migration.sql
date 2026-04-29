-- DropTable: legacy admin auth used this table; the code that read
-- and wrote it was removed in the previous commit. The rows are
-- now orphaned. CASCADE drops the foreign-key constraint pointing
-- at users(id) along with the table.
DROP TABLE "two_factor_secrets" CASCADE;
