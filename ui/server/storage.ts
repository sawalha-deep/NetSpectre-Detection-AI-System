import { eq, desc, count, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
  users,
  securityEvents,
  dataSources,
  type User,
  type InsertUser,
  type SecurityEvent,
  type InsertEvent,
  type DataSource,
  type InsertDataSource,
} from "@shared/schema";

const sqlite = new Database("netspectre.db");
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    organization TEXT,
    role TEXT NOT NULL DEFAULT 'analyst',
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    timestamp TEXT NOT NULL,
    src_ip TEXT NOT NULL,
    dst_ip TEXT NOT NULL,
    attack_type TEXT NOT NULL,
    confidence REAL NOT NULL,
    pred INTEGER NOT NULL DEFAULT 0,
    src_model TEXT,
    severity TEXT NOT NULL DEFAULT 'low',
    ingest_time TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS data_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    connection_method TEXT NOT NULL,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    api_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_event_at TEXT,
    event_count INTEGER NOT NULL DEFAULT 0
  );
`);

const db = drizzle(sqlite);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string, mustChange?: boolean): Promise<void>;
  getUserCount(): Promise<number>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;
  updateUserRole(id: string, role: string): Promise<void>;

  insertEvent(event: InsertEvent): Promise<SecurityEvent>;
  insertEvents(events: InsertEvent[]): Promise<SecurityEvent[]>;
  getEvents(limit?: number, offset?: number): Promise<SecurityEvent[]>;
  getAlerts(limit?: number, offset?: number): Promise<SecurityEvent[]>;
  getEventCount(): Promise<number>;
  getAlertCount(): Promise<number>;
  getEventStats(): Promise<{
    total: number;
    alerts: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  clearEvents(): Promise<void>;

  createDataSource(ds: InsertDataSource): Promise<DataSource>;
  getDataSources(): Promise<DataSource[]>;
  getDataSource(id: string): Promise<DataSource | undefined>;
  getDataSourceByApiKey(apiKey: string): Promise<DataSource | undefined>;
  updateDataSource(id: string, updates: Partial<{ name: string; description: string | null; enabled: boolean; status: string }>): Promise<void>;
  deleteDataSource(id: string): Promise<void>;
  incrementDataSourceEventCount(id: string): Promise<void>;
  deleteEventsBySource(sourceName: string): Promise<number>;
  orphanEventsBySource(sourceName: string): Promise<number>;
  getEventsBySource(sourceName: string): Promise<SecurityEvent[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const results = db.select().from(users).where(eq(users.id, id)).all();
    return results[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const results = db.select().from(users).where(eq(users.email, email)).all();
    return results[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const results = db.insert(users).values(user).returning().all();
    return results[0];
  }

  async updateUserPassword(id: string, hashedPassword: string, mustChange = false): Promise<void> {
    db.update(users)
      .set({ password: hashedPassword, mustChangePassword: mustChange })
      .where(eq(users.id, id))
      .run();
  }

  async getUserCount(): Promise<number> {
    const results = db.select({ count: count() }).from(users).all();
    return results[0].count;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt)).all();
  }

  async deleteUser(id: string): Promise<void> {
    db.delete(users).where(eq(users.id, id)).run();
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    db.update(users).set({ role }).where(eq(users.id, id)).run();
  }

  async insertEvent(event: InsertEvent): Promise<SecurityEvent> {
    const results = db.insert(securityEvents).values(event).returning().all();
    return results[0];
  }

  async insertEvents(events: InsertEvent[]): Promise<SecurityEvent[]> {
    if (events.length === 0) return [];
    return db.insert(securityEvents).values(events).returning().all();
  }

  async getEvents(limit = 50, offset = 0): Promise<SecurityEvent[]> {
    return db
      .select()
      .from(securityEvents)
      .orderBy(desc(securityEvents.timestamp))
      .limit(limit)
      .offset(offset)
      .all();
  }

  async getAlerts(limit = 50, offset = 0): Promise<SecurityEvent[]> {
    return db
      .select()
      .from(securityEvents)
      .where(eq(securityEvents.pred, 1))
      .orderBy(desc(securityEvents.timestamp))
      .limit(limit)
      .offset(offset)
      .all();
  }

  async getEventCount(): Promise<number> {
    const results = db.select({ count: count() }).from(securityEvents).all();
    return results[0].count;
  }

  async getAlertCount(): Promise<number> {
    const results = db
      .select({ count: count() })
      .from(securityEvents)
      .where(eq(securityEvents.pred, 1))
      .all();
    return results[0].count;
  }

  async getEventStats() {
    const totalCount = await this.getEventCount();
    const alertCount = await this.getAlertCount();

    const severityCounts = db
      .select({
        severity: securityEvents.severity,
        count: count(),
      })
      .from(securityEvents)
      .groupBy(securityEvents.severity)
      .all();

    const severityMap: Record<string, number> = {};
    for (const row of severityCounts) {
      severityMap[row.severity] = row.count;
    }

    return {
      total: totalCount,
      alerts: alertCount,
      critical: severityMap["critical"] || 0,
      high: severityMap["high"] || 0,
      medium: severityMap["medium"] || 0,
      low: severityMap["low"] || 0,
    };
  }
  async clearEvents(): Promise<void> {
    db.delete(securityEvents).run();
  }

  async createDataSource(ds: InsertDataSource): Promise<DataSource> {
    const results = db.insert(dataSources).values(ds).returning().all();
    return results[0];
  }

  async getDataSources(): Promise<DataSource[]> {
    return db.select().from(dataSources).orderBy(desc(dataSources.createdAt)).all();
  }

  async getDataSource(id: string): Promise<DataSource | undefined> {
    const results = db.select().from(dataSources).where(eq(dataSources.id, id)).all();
    return results[0];
  }

  async getDataSourceByApiKey(apiKey: string): Promise<DataSource | undefined> {
    const results = db.select().from(dataSources).where(eq(dataSources.apiKey, apiKey)).all();
    return results[0];
  }

  async updateDataSource(id: string, updates: Partial<{ name: string; description: string | null; enabled: boolean; status: string }>): Promise<void> {
    db.update(dataSources).set(updates).where(eq(dataSources.id, id)).run();
  }

  async deleteDataSource(id: string): Promise<void> {
    db.delete(dataSources).where(eq(dataSources.id, id)).run();
  }

  async incrementDataSourceEventCount(id: string): Promise<void> {
    const ds = await this.getDataSource(id);
    if (ds) {
      db.update(dataSources)
        .set({ 
          eventCount: ds.eventCount + 1, 
          lastEventAt: new Date().toISOString() 
        })
        .where(eq(dataSources.id, id))
        .run();
    }
  }

  async getEventsBySource(sourceName: string): Promise<SecurityEvent[]> {
    return db.select().from(securityEvents)
      .where(eq(securityEvents.srcModel, sourceName))
      .all();
  }

  async deleteEventsBySource(sourceName: string): Promise<number> {
    const events = await this.getEventsBySource(sourceName);
    if (events.length === 0) return 0;
    db.delete(securityEvents)
      .where(eq(securityEvents.srcModel, sourceName))
      .run();
    return events.length;
  }

  async orphanEventsBySource(sourceName: string): Promise<number> {
    const events = await this.getEventsBySource(sourceName);
    if (events.length === 0) return 0;
    db.update(securityEvents)
      .set({ srcModel: "[deleted-source] " + sourceName })
      .where(eq(securityEvents.srcModel, sourceName))
      .run();
    return events.length;
  }
}

export const storage = new DatabaseStorage();