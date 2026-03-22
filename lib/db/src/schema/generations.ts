import { pgTable, serial, integer, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const generationsTable = pgTable("generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  transitionPath: text("transition_path").notNull(),
  aiModel: text("ai_model").notNull(),
  projectStartDate: text("project_start_date").notNull(),
  totalWeeks: integer("total_weeks").notNull(),
  planData: jsonb("plan_data"),
  downloaded: boolean("downloaded").notNull().default(false),
  downloadedAt: timestamp("downloaded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ id: true, createdAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;
