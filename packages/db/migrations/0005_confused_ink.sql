CREATE TABLE "training"."permanent_substitutions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"original_exercise_id" varchar(64) NOT NULL,
	"substitute_exercise_id" varchar(64) NOT NULL,
	"reason" varchar(32) NOT NULL,
	"note" text,
	"weight_carries" boolean DEFAULT true NOT NULL,
	"confirmed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training"."permanent_substitutions" ADD CONSTRAINT "permanent_substitutions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "permanent_substitutions_user_id_idx" ON "training"."permanent_substitutions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "permanent_substitutions_user_original_idx" ON "training"."permanent_substitutions" USING btree ("user_id","original_exercise_id");