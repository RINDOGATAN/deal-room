-- AlterTable: capture IP + User-Agent at signing time so a later
-- dispute over "who signed?" has more than just a typed name and
-- a timestamp to lean on. Nullable — historical rows have no
-- forensic envelope, and some hosts strip the originating IP.
ALTER TABLE "signing_requests" ADD COLUMN "initiatorSignatureIp" TEXT;
ALTER TABLE "signing_requests" ADD COLUMN "initiatorSignatureUa" TEXT;
ALTER TABLE "signing_requests" ADD COLUMN "respondentSignatureIp" TEXT;
ALTER TABLE "signing_requests" ADD COLUMN "respondentSignatureUa" TEXT;
