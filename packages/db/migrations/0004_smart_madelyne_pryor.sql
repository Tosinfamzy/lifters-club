CREATE TABLE "training"."athlete_constraints" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mobility" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"injuries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"banned_exercise_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"corrective_priority_exercise_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training"."athlete_constraints" ADD CONSTRAINT "athlete_constraints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "athlete_constraints_user_id_idx" ON "training"."athlete_constraints" USING btree ("user_id");