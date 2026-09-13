-- ScheduleKind (PLANNED vs SCHEDULED) + opt-in auto-enter for SCHEDULED catch-up
ALTER TABLE "ScheduledTransaction" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "ScheduledTransaction" ADD COLUMN "autoEnter" BOOLEAN NOT NULL DEFAULT false;
