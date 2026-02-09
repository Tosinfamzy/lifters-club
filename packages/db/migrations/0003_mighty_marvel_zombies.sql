CREATE TABLE "training"."standalone_workouts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"template_id" varchar(64),
	"weekly_plan_id" varchar(64),
	"name" varchar(255) NOT NULL,
	"scheduled_date" date NOT NULL,
	"day_of_week" integer,
	"planned_exercises" jsonb NOT NULL,
	"focus_muscles" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."weekly_plans" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"days_per_week" integer NOT NULL,
	"goal" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."workout_templates" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"focus_muscles" jsonb NOT NULL,
	"exercises" jsonb NOT NULL,
	"estimated_duration_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training"."workout_logs" ADD COLUMN "standalone_workout_id" varchar(64);--> statement-breakpoint
ALTER TABLE "training"."standalone_workouts" ADD CONSTRAINT "standalone_workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."standalone_workouts" ADD CONSTRAINT "standalone_workouts_template_id_workout_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "training"."workout_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."standalone_workouts" ADD CONSTRAINT "standalone_workouts_weekly_plan_id_weekly_plans_id_fk" FOREIGN KEY ("weekly_plan_id") REFERENCES "training"."weekly_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."weekly_plans" ADD CONSTRAINT "weekly_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."workout_templates" ADD CONSTRAINT "workout_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standalone_workouts_user_date_idx" ON "training"."standalone_workouts" USING btree ("user_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "standalone_workouts_weekly_plan_idx" ON "training"."standalone_workouts" USING btree ("weekly_plan_id");--> statement-breakpoint
CREATE INDEX "standalone_workouts_status_idx" ON "training"."standalone_workouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "weekly_plans_user_status_idx" ON "training"."weekly_plans" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "workout_templates_user_id_idx" ON "training"."workout_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workout_logs_standalone_workout_idx" ON "training"."workout_logs" USING btree ("standalone_workout_id");