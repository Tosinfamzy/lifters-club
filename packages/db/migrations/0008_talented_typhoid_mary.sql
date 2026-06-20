CREATE TABLE "training"."gym_equipment_instances" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"exercise_id" varchar(64) NOT NULL,
	"increment_constraint" real,
	"min_weight" real,
	"confirmed_working_weight" real,
	"label" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training"."gym_equipment_instances" ADD CONSTRAINT "gym_equipment_instances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "training"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gym_equipment_instances_user_id_idx" ON "training"."gym_equipment_instances" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_equipment_instances_user_exercise_idx" ON "training"."gym_equipment_instances" USING btree ("user_id","exercise_id");