ALTER TABLE "exercise_lib"."exercises" ADD COLUMN "grip" varchar(16);--> statement-breakpoint
ALTER TABLE "training"."athlete_constraints" ADD COLUMN "grip" jsonb DEFAULT '[]'::jsonb NOT NULL;