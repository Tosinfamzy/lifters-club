CREATE INDEX "logged_sets_exercise_created_idx" ON "training"."logged_sets" USING btree ("exercise_id","created_at");--> statement-breakpoint
CREATE INDEX "logged_sets_workout_log_idx" ON "training"."logged_sets" USING btree ("workout_log_id");--> statement-breakpoint
CREATE INDEX "readiness_checks_user_created_idx" ON "training"."readiness_checks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "training_blocks_user_status_idx" ON "training"."training_blocks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "workout_logs_user_created_idx" ON "training"."workout_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "workout_logs_workout_idx" ON "training"."workout_logs" USING btree ("workout_id");--> statement-breakpoint
CREATE INDEX "workouts_block_date_idx" ON "training"."workouts" USING btree ("training_block_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "workouts_status_idx" ON "training"."workouts" USING btree ("status");