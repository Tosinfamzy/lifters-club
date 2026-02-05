CREATE SCHEMA "exercise_lib";
--> statement-breakpoint
CREATE SCHEMA "training";
--> statement-breakpoint
CREATE TABLE "exercise_lib"."exercises" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb,
	"equipment" jsonb NOT NULL,
	"movement_patterns" jsonb NOT NULL,
	"primary_muscles" jsonb NOT NULL,
	"secondary_muscles" jsonb DEFAULT '[]'::jsonb,
	"is_compound" boolean NOT NULL,
	"is_unilateral" boolean DEFAULT false NOT NULL,
	"difficulty" varchar(20) NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."decision_outcomes" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"decision_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"success" boolean,
	"override_reason" varchar(50),
	"expected_value" jsonb,
	"actual_value" jsonb,
	"evaluated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."decisions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"workout_id" varchar(64),
	"type" varchar(50) NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb NOT NULL,
	"reasoning" text NOT NULL,
	"algorithm_version" varchar(20) DEFAULT '1.0.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."logged_sets" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workout_log_id" varchar(64) NOT NULL,
	"exercise_id" varchar(64) NOT NULL,
	"set_number" integer NOT NULL,
	"weight" real NOT NULL,
	"reps" integer NOT NULL,
	"rpe" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."programs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"days_per_week" integer NOT NULL,
	"goal" varchar(20) NOT NULL,
	"level" varchar(20) NOT NULL,
	"template" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."push_tokens" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(20) NOT NULL,
	"device_id" varchar(255),
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."readiness_checks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"workout_log_id" varchar(64),
	"sleep_quality" integer NOT NULL,
	"muscle_soreness" integer NOT NULL,
	"stress_level" integer NOT NULL,
	"energy_level" integer NOT NULL,
	"score" integer NOT NULL,
	"recommendation" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."training_blocks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"program_id" varchar(64) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"current_week" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."user_baselines" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"exercise_id" varchar(64) NOT NULL,
	"baseline_weight" real NOT NULL,
	"baseline_reps" integer NOT NULL,
	"estimated_e1rm" real,
	"source" varchar(20) NOT NULL,
	"established_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"training_level" varchar(20) NOT NULL,
	"primary_goal" varchar(20) NOT NULL,
	"preferences" jsonb NOT NULL,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"baseline_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "training"."workout_logs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workout_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"overall_rpe" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training"."workouts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"training_block_id" varchar(64) NOT NULL,
	"scheduled_date" date NOT NULL,
	"week_number" integer NOT NULL,
	"day_number" integer NOT NULL,
	"planned_exercises" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training"."decision_outcomes" ADD CONSTRAINT "decision_outcomes_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "training"."decisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."decision_outcomes" ADD CONSTRAINT "decision_outcomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."decisions" ADD CONSTRAINT "decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."decisions" ADD CONSTRAINT "decisions_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "training"."workouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."logged_sets" ADD CONSTRAINT "logged_sets_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "training"."workout_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."readiness_checks" ADD CONSTRAINT "readiness_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."readiness_checks" ADD CONSTRAINT "readiness_checks_workout_log_id_workout_logs_id_fk" FOREIGN KEY ("workout_log_id") REFERENCES "training"."workout_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."training_blocks" ADD CONSTRAINT "training_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."training_blocks" ADD CONSTRAINT "training_blocks_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "training"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."user_baselines" ADD CONSTRAINT "user_baselines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."workout_logs" ADD CONSTRAINT "workout_logs_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "training"."workouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."workout_logs" ADD CONSTRAINT "workout_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training"."workouts" ADD CONSTRAINT "workouts_training_block_id_training_blocks_id_fk" FOREIGN KEY ("training_block_id") REFERENCES "training"."training_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decision_outcomes_user_id_idx" ON "training"."decision_outcomes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "decision_outcomes_decision_id_idx" ON "training"."decision_outcomes" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "decisions_user_id_idx" ON "training"."decisions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "decisions_type_idx" ON "training"."decisions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "decisions_created_at_idx" ON "training"."decisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_baselines_user_id_idx" ON "training"."user_baselines" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_baselines_exercise_id_idx" ON "training"."user_baselines" USING btree ("exercise_id");