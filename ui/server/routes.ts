import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { opensearch } from "./opensearch";
import { broadcastAlert, broadcastEvent, getConnectionCount } from "./websocket";
import { getSOCTelemetry, buildSOCContextPrompt, buildFallbackResponse } from "./socContext";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  ingestEventSchema,
  createDataSourceSchema,
  type DataSource,
} from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "netspectre-jwt-secret-" + randomUUID();
const JWT_EXPIRY = "24h";

function signToken(userId: string, email: string, role: string) {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function deriveSeverity(pred: number, confidence: number): string {
  if (pred === 0) return "low";
  if (confidence >= 0.9) return "critical";
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

interface AuthRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

const SOFT_DELETE_EVENTS = process.env.SOFT_DELETE_EVENTS !== "false";

interface ApiKeyValidation {
  valid: boolean;
  dataSource?: DataSource;
  error?: string;
  status?: number;
}

async function validateApiKey(req: Request): Promise<ApiKeyValidation> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "API key required. Use: Authorization: Bearer <api_key>", status: 401 };
  }

  const apiKey = authHeader.split(" ")[1];
  const dataSource = await storage.getDataSourceByApiKey(apiKey);

  if (!dataSource) {
    return { valid: false, error: "Invalid API key", status: 401 };
  }

  if (!dataSource.enabled) {
    return { valid: false, error: "Data source is disabled", status: 403 };
  }

  if (dataSource.status === "inactive") {
    return { valid: false, error: "Data source is inactive", status: 403 };
  }

  return { valid: true, dataSource };
}

async function seedDefaultAdmin() {
  const existing = await storage.getUserByEmail("admin@netspectre.ai");
  if (!existing) {
    const hashedPassword = await bcrypt.hash("netspectre", 12);
    await storage.createUser({
      email: "admin@netspectre.ai",
      password: hashedPassword,
      name: "Admin",
      organization: "NetSpectre Security",
      role: "admin",
      mustChangePassword: true,
    });
    console.log("[seed] Default admin created: admin@netspectre.ai");
  }
}

async function seedDefaultDataSource() {
  const sources = await storage.getDataSources();
  if (sources.length > 0) return;

  const apiKey = `ns_${randomUUID().replace(/-/g, '')}`;
  await storage.createDataSource({
    name: "NetSpectre IDS",
    sourceType: "internal",
    connectionMethod: "http",
    description: "Built-in intrusion detection system powered by NetSpectre AI engine",
    enabled: true,
    apiKey,
    status: "active",
    createdBy: "system",
  });
  console.log("[seed] Default data source created: NetSpectre IDS");
}



export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: "Too many login attempts. Try again later." },
  });

  // Auth Routes
  app.post("/api/auth/login", loginLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });

      const user = await storage.getUserByEmail(parsed.data.email);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      const validPassword = await bcrypt.compare(parsed.data.password, user.password);
      if (!validPassword) return res.status(401).json({ message: "Invalid credentials" });

      const token = signToken(user.id, user.email, user.role);
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organization: user.organization,
          mustChangePassword: user.mustChangePassword,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });

      const existing = await storage.getUserByEmail(parsed.data.email);
      if (existing) return res.status(409).json({ message: "Email already registered" });

      const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
      const user = await storage.createUser({
        email: parsed.data.email,
        password: hashedPassword,
        name: parsed.data.name,
        organization: parsed.data.organization || null,
        role: "analyst",
        mustChangePassword: false,
      });

      const token = signToken(user.id, user.email, user.role);
      return res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organization: user.organization,
          mustChangePassword: user.mustChangePassword,
        },
      });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/change-password", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });

      const user = await storage.getUser(req.user!.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const validCurrent = await bcrypt.compare(parsed.data.currentPassword, user.password);
      if (!validCurrent) return res.status(401).json({ message: "Current password is incorrect" });

      const hashedNew = await bcrypt.hash(parsed.data.newPassword, 12);
      await storage.updateUserPassword(user.id, hashedNew, false);

      return res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    const user = await storage.getUser(req.user!.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
      mustChangePassword: user.mustChangePassword,
    });
  });

  // Events / Traffic Routes
  app.post("/api/events/ingest", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const body = Array.isArray(req.body) ? req.body : [req.body];
      const results = [];
      const osResults = { indexed: 0, failed: 0 };

      for (const raw of body) {
        const parsed = ingestEventSchema.safeParse(raw);
        if (!parsed.success) {
          results.push({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
          continue;
        }

        const d = parsed.data;
        const severity = deriveSeverity(d.pred, d.confidence);
        const eventId = `EVT-${randomUUID().slice(0, 8).toUpperCase()}`;

        const event = await storage.insertEvent({
          eventId,
          timestamp: new Date(d.timestamp).toISOString(),
          srcIp: d.src_ip,
          dstIp: d.dst_ip,
          attackType: d.attack_type,
          confidence: d.confidence,
          pred: d.pred,
          srcModel: d.src_model || null,
          severity,
        });

        const osOk = await opensearch.indexEvent(event);
        if (osOk) osResults.indexed++;
        else if (opensearch.isEnabled()) osResults.failed++;

        broadcastEvent(event);
        if (event.pred === 1) broadcastAlert(event);

        results.push(event);
      }

      return res.status(201).json({ 
        ingested: results.length, 
        events: results,
        opensearch: opensearch.isEnabled() ? osResults : undefined,
      });
    } catch (error) {
      console.error("Ingest error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/events", authMiddleware, async (req: AuthRequest, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const events = await storage.getEvents(limit, offset);
    const total = await storage.getEventCount();
    return res.json({ events, total, limit, offset });
  });

  app.get("/api/alerts", authMiddleware, async (req: AuthRequest, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const alerts = await storage.getAlerts(limit, offset);
    const total = await storage.getAlertCount();
    return res.json({ alerts, total, limit, offset });
  });

  app.get("/api/stats", authMiddleware, async (_req: AuthRequest, res: Response) => {
    const stats = await storage.getEventStats();
    return res.json(stats);
  });

  app.get("/api/system-info", authMiddleware, async (_req: AuthRequest, res: Response) => {
    const osStatus = await opensearch.getStatus();
    return res.json({
      version: "2.5.0-stable",
      platform: "NetSpectre AI SIEM",
      uptime: process.uptime(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      opensearch: {
        enabled: opensearch.isEnabled(),
        ...osStatus,
      },
      websocket: {
        activeConnections: getConnectionCount(),
      },
    });
  });

  // System Management Routes (admin only)
  function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  }

  app.get("/api/admin/users", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const sanitized = allUsers.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        organization: u.organization,
        mustChangePassword: u.mustChangePassword,
        createdAt: u.createdAt,
      }));
      return res.json({ users: sanitized });
    } catch (error) {
      console.error("List users error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/users/:id/role", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const { role } = req.body;
      if (!role || !["admin", "analyst", "viewer"].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be admin, analyst, or viewer." });
      }
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      await storage.updateUserRole(id, role);
      return res.json({ message: "Role updated", userId: id, role });
    } catch (error) {
      console.error("Update role error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/users/:id", authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (req.user!.userId === id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      await storage.deleteUser(id);
      return res.json({ message: "User deleted" });
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/system-health", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
    try {
      const memUsage = process.memoryUsage();
      const eventCount = await storage.getEventCount();
      const alertCount = await storage.getAlertCount();
      const userCount = await storage.getUserCount();
      return res.json({
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
        },
        database: {
          totalEvents: eventCount,
          totalAlerts: alertCount,
          totalUsers: userCount,
        },
        version: "2.4.0-stable",
      });
    } catch (error) {
      console.error("System health error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/events/clear", authMiddleware, adminOnly, async (_req: AuthRequest, res: Response) => {
    try {
      await storage.clearEvents();
      return res.json({ message: "All events cleared" });
    } catch (error) {
      console.error("Clear events error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Data Sources Routes (auth required)
  function generateApiKey(): string {
    return `ns_${randomUUID().replace(/-/g, '')}`;
  }

  app.get("/api/data-sources", authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
      const sources = await storage.getDataSources();
      const masked = sources.map(s => ({
        ...s,
        apiKey: s.apiKey.slice(0, 6) + "..." + s.apiKey.slice(-4),
        apiKeyFull: s.apiKey,
      }));
      return res.json({ sources: masked });
    } catch (error) {
      console.error("List data sources error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/data-sources", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createDataSourceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });

      const apiKey = generateApiKey();
      const source = await storage.createDataSource({
        name: parsed.data.name,
        sourceType: parsed.data.sourceType,
        connectionMethod: parsed.data.connectionMethod,
        description: parsed.data.description || null,
        enabled: parsed.data.enabled ?? true,
        apiKey,
        status: "active",
        createdBy: req.user!.userId,
      });

      return res.status(201).json({ source, apiKey });
    } catch (error) {
      console.error("Create data source error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  const updateDataSourceSchema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    enabled: z.boolean().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  });

  app.patch("/api/data-sources/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const ds = await storage.getDataSource(id);
      if (!ds) return res.status(404).json({ message: "Data source not found" });

      const parsed = updateDataSourceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });

      const updates: any = {};
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.description !== undefined) updates.description = parsed.data.description;
      if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
      if (parsed.data.status !== undefined) updates.status = parsed.data.status;

      await storage.updateDataSource(id, updates);
      return res.json({ message: "Data source updated" });
    } catch (error) {
      console.error("Update data source error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/data-sources/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const ds = await storage.getDataSource(id);
      if (!ds) return res.status(404).json({ message: "Data source not found" });

      let eventsAffected = 0;
      let eventAction: string;

      if (SOFT_DELETE_EVENTS) {
        eventsAffected = await storage.orphanEventsBySource(ds.name);
        eventAction = "orphaned";
      } else {
        eventsAffected = await storage.deleteEventsBySource(ds.name);
        eventAction = "deleted";
      }

      if (opensearch.isEnabled()) {
        if (!SOFT_DELETE_EVENTS) {
          await opensearch.deleteEventsBySource(ds.name);
        }
      }

      await storage.deleteDataSource(id);

      console.log(`[data-source] Deleted source "${ds.name}" (id=${id}), API key revoked, ${eventsAffected} events ${eventAction}`);

      return res.json({
        message: "Data source deleted",
        details: {
          sourceName: ds.name,
          apiKeyRevoked: true,
          eventsAffected,
          eventAction,
        },
      });
    } catch (error) {
      console.error("Delete data source error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Suricata EVE JSON Ingestion Endpoint — accepts native Suricata alert format
  const suricataHandler = async (req: Request, res: Response) => {
    try {
      const validation = await validateApiKey(req);
      if (!validation.valid) {
        return res.status(validation.status!).json({ message: validation.error });
      }
      const dataSource = validation.dataSource!;

      const body = Array.isArray(req.body) ? req.body : [req.body];
      const results = [];
      let ingested = 0;
      const osResults = { indexed: 0, failed: 0 };

      for (const eve of body) {
        const alertData = eve.alert || {};
        const severityMap: Record<string, number> = { "1": 0.95, "2": 0.75, "3": 0.5, "4": 0.2 };
        const severityStr = String(alertData.severity || "3");
        const confidence = severityMap[severityStr] ?? 0.5;
        const pred = (severityStr === "1" || severityStr === "2" || severityStr === "critical" || severityStr === "high") ? 1 : (confidence >= 0.4 ? 1 : 0);

        const attackType = alertData.signature || alertData.category || eve.event_type || "Unknown Alert";
        const srcIp = eve.src_ip || "0.0.0.0";
        const dstIp = eve.dest_ip || eve.dst_ip || "0.0.0.0";
        const timestamp = eve.timestamp || new Date().toISOString();

        const severity = deriveSeverity(pred, confidence);
        const eventId = `EVT-${randomUUID().slice(0, 8).toUpperCase()}`;

        const event = await storage.insertEvent({
          eventId,
          timestamp: new Date(timestamp).toISOString(),
          srcIp,
          dstIp,
          attackType,
          confidence,
          pred,
          srcModel: dataSource.name,
          severity,
        });

        const osOk = await opensearch.indexEvent(event);
        if (osOk) osResults.indexed++;
        else if (opensearch.isEnabled()) osResults.failed++;

        broadcastEvent(event);
        if (event.pred === 1) broadcastAlert(event);

        await storage.incrementDataSourceEventCount(dataSource.id);
        ingested++;
        results.push(event);
      }

      return res.status(201).json({
        ingested,
        source: dataSource.name,
        events: results,
        opensearch: opensearch.isEnabled() ? osResults : undefined,
      });
    } catch (error) {
      console.error("Suricata ingest error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  app.post("/ingest/suricata", suricataHandler);
  app.post("/api/ingest/suricata", suricataHandler);

  // Secure Ingestion Endpoint — authenticated via data source API key
  const eventsHandler = async (req: Request, res: Response) => {
    try {
      const validation = await validateApiKey(req);
      if (!validation.valid) {
        return res.status(validation.status!).json({ message: validation.error });
      }
      const dataSource = validation.dataSource!;

      const body = Array.isArray(req.body) ? req.body : [req.body];
      const results = [];
      let ingested = 0;
      const osResults = { indexed: 0, failed: 0 };

      for (const raw of body) {
        const parsed = ingestEventSchema.safeParse(raw);
        if (!parsed.success) {
          results.push({ error: "Validation failed", details: parsed.error.flatten().fieldErrors });
          continue;
        }

        const d = parsed.data;
        const severity = deriveSeverity(d.pred, d.confidence);
        const eventId = `EVT-${randomUUID().slice(0, 8).toUpperCase()}`;

        const event = await storage.insertEvent({
          eventId,
          timestamp: new Date(d.timestamp).toISOString(),
          srcIp: d.src_ip,
          dstIp: d.dst_ip,
          attackType: d.attack_type,
          confidence: d.confidence,
          pred: d.pred,
          srcModel: d.src_model || dataSource.name,
          severity,
        });

        const osOk = await opensearch.indexEvent(event);
        if (osOk) osResults.indexed++;
        else if (opensearch.isEnabled()) osResults.failed++;

        broadcastEvent(event);
        if (event.pred === 1) broadcastAlert(event);

        await storage.incrementDataSourceEventCount(dataSource.id);
        ingested++;
        results.push(event);
      }

      return res.status(201).json({ 
        ingested, 
        source: dataSource.name, 
        events: results,
        opensearch: opensearch.isEnabled() ? osResults : undefined,
      });
    } catch (error) {
      console.error("External ingest error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
  app.post("/ingest/events", eventsHandler);

  app.post("/api/ingest/events", eventsHandler);

  const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "netspectre-soc-ai:latest";

  const SOC_SYSTEM_PROMPT = `You are NetSpectre SOC AI, an elite cybersecurity analyst operating inside a live Security Operations Center. Created by Yanal Sawalha.

Your role:
- Analyze the live telemetry data provided below
- Produce concise, professional SOC-grade threat analysis
- Assess risk levels using severity tiers: CRITICAL, HIGH, MEDIUM, LOW
- Recommend specific defensive actions
- Use short, precise SOC/DFIR terminology
- Never fabricate data not present in the telemetry
- Reference specific IPs, attack types, and severity counts from the data

Greeting Behavior:

If the user sends a greeting message only (such as "hello", "hi", or similar), respond with a brief greeting only.

The greeting response must be concise and similar in style to:
"Hello! I'm NetSpectre SOC AI, an elite cybersecurity analyst operating inside a live Security Operations Center."

Do not include threat analysis, telemetry discussion, or recommendations in greeting-only responses.

OPENSEARCH EVIDENCE RULE (CRITICAL)

The ONLY trusted source of truth for attacks is telemetry retrieved from OpenSearch.

If OpenSearch contains:
- No events
- No alerts
- No logs
- No matching time range

Then you MUST:

• NOT declare any attack
• NOT assume any malicious activity
• NOT fabricate IPs, timestamps, domains, or severity
• NOT generate hypothetical scenarios

Instead, you MUST return:

attack_type = "None"
severity = "Low"
confidence ≤ 0.2
reasoning = "No security events found in OpenSearch telemetry."

Any claim of an attack without OpenSearch evidence is a CRITICAL ANALYSIS FAILURE.
SOC decisions must be evidence-driven strictly from OpenSearch data.
`;
  app.post("/api/chat", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "messages array required" });
      }

      const telemetry = await getSOCTelemetry();
      const contextPrompt = buildSOCContextPrompt(telemetry);
      const fullSystemPrompt = `${SOC_SYSTEM_PROMPT}\n\n${contextPrompt}`;

      const ollamaMessages = [
        { role: "system", content: fullSystemPrompt },
        ...messages.slice(-10),
      ];

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 40000);

        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: ollamaMessages,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (ollamaRes.ok) {
          const data = await ollamaRes.json() as any;
          return res.json({
            response: data.message?.content || "No response from model.",
            source: "ollama",
            telemetrySource: telemetry.source,
          });
        }

        console.error(`[chat] Ollama returned ${ollamaRes.status}`);
      } catch (ollamaErr: any) {
        console.error("[chat] Ollama unavailable, using fallback:", ollamaErr.message);
      }

      const lastMsg = messages[messages.length - 1]?.content || "";
      return res.json({
        response: "SOC AI unavailable. Unable to generate response from model.",
        source: "error",
        telemetrySource: telemetry.source,
      });
      
    } catch (error) {
      console.error("Chat error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/about", (_req: Request, res: Response) => {
    return res.json({
      name: "NetSpectre AI",
      tagline: "AI-Powered SOC / IDS Platform",
      description:
        "NetSpectre is an advanced AI-powered Security Operations Center (SOC) and Intrusion Detection System (IDS) platform currently under active development. Built with cutting-edge machine learning algorithms and real-time network analysis capabilities, NetSpectre aims to provide enterprise-grade threat detection and automated incident response.",
      status: "In Active Development",
      developer: "Yanal Sawalha",
      features: [
        "Real-time network traffic monitoring",
        "AI-driven anomaly detection",
        "Automated threat classification",
        "OpenSearch-ready data architecture",
        "Enterprise SOC dashboard interface",
      ],
    });
  });

  // Seed data on startup
  await seedDefaultAdmin();
  await seedDefaultDataSource();

  return httpServer;
}