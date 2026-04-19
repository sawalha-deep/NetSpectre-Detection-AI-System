import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  organization: text("organization"),
  role: text("role").notNull().default("analyst"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const securityEvents = sqliteTable("security_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id").notNull().unique(),
  timestamp: text("timestamp").notNull(),
  srcIp: text("src_ip").notNull(),
  dstIp: text("dst_ip").notNull(),
  attackType: text("attack_type").notNull(),
  confidence: real("confidence").notNull(),
  pred: integer("pred").notNull().default(0),
  srcModel: text("src_model"),
  severity: text("severity").notNull().default("low"),
  ingestTime: text("ingest_time").notNull().$defaultFn(() => new Date().toISOString()),
});

export const insertEventSchema = createInsertSchema(securityEvents).omit({
  id: true,
  ingestTime: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type SecurityEvent = typeof securityEvents.$inferSelect;

export const dataSources = sqliteTable("data_sources", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  connectionMethod: text("connection_method").notNull(),
  description: text("description"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  apiKey: text("api_key").notNull().unique(),
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  lastEventAt: text("last_event_at"),
  eventCount: integer("event_count").notNull().default(0),
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({
  id: true,
  createdAt: true,
  lastEventAt: true,
  eventCount: true,
});

export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;

export const createDataSourceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  sourceType: z.enum(["suricata", "snort", "firewall", "custom_api"]),
  connectionMethod: z.enum(["http", "syslog", "agent"]),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  organization: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
});

export const ingestEventSchema = z.object({
  timestamp: z.string(),
  src_ip: z.string(),
  dst_ip: z.string(),
  attack_type: z.string(),
  confidence: z.number().min(0).max(1),
  pred: z.number().int().min(0).max(1),
  src_model: z.string().optional(),
});