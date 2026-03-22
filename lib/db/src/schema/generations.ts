import { pgTable, serial, varchar, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const generationsTable = pgTable("generations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  transitionPath: text("transition_path").notNull(),
  aiModel: text("ai_model").notNull(),
  projectStartDate: text("project_start_date").notNull(),
  totalWeeks: integer("total_weeks").notNull(),
  planData: jsonb("plan_data"),
  downloaded: boolean("downloaded").notNull().default(false),
  downloadedAt: timestamp("downloaded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  visitorEmail: text("visitor_email"),
  visitorName: text("visitor_name"),
  ipAddress: text("ip_address"),
  location: text("location"),
  device: text("device"),
  userAgent: text("user_agent"),
  emailSent: boolean("email_sent").notNull().default(false),
  downloadToken: text("download_token"),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ id: true, createdAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;
