# NetSpectre AI - Cybersecurity SOC/SIEM Dashboard

## Overview
NetSpectre AI is a production-ready, full-stack cybersecurity SOC/SIEM dashboard built with React + Express + SQLite. It features JWT authentication with mandatory password change on first login, real-time security event monitoring, and an AI-powered chat assistant.

## Architecture
- **Frontend**: React + TypeScript, Wouter routing, TanStack Query, shadcn/ui, Framer Motion
- **Backend**: Express.js with JWT auth, bcrypt password hashing, rate limiting
- **Database**: SQLite (netspectre.db) with Drizzle ORM + better-sqlite3
- **Styling**: Tailwind CSS with dark cyber theme (Oxanium headers, Inter UI, JetBrains Mono data)

## Key Files
- `shared/schema.ts` - Database schema (users, securityEvents, dataSources) and Zod validation schemas
- `server/routes.ts` - API routes (auth, events, stats, system-info, data-sources, ingest, about)
- `server/storage.ts` - Database storage layer with Drizzle queries
- `client/src/lib/auth-context.tsx` - JWT auth context with token management
- `client/src/pages/dashboard.tsx` - Main SOC dashboard with live data
- `client/src/pages/login.tsx` - Login page
- `client/src/pages/register.tsx` - Registration page
- `client/src/pages/change-password.tsx` - Mandatory password change page
- `client/src/pages/about.tsx` - About page

## Default Admin
- Email: admin@netspectre.ai
- Password: netspectre
- Must change password on first login

## API Endpoints
- POST /api/auth/login - JWT login
- POST /api/auth/register - User registration
- POST /api/auth/change-password - Change password (auth required)
- GET /api/auth/me - Get current user (auth required)
- GET /api/events - List events (auth required)
- GET /api/alerts - List alerts (pred=1) (auth required)
- GET /api/stats - Event statistics (auth required)
- GET /api/system-info - System info (auth required)
- POST /api/events/ingest - Ingest new events (auth required)
- GET /api/data-sources - List data sources (auth required)
- POST /api/data-sources - Create data source (auth required)
- PATCH /api/data-sources/:id - Update data source (auth required)
- DELETE /api/data-sources/:id - Delete data source (auth required)
- POST /ingest/events - External ingestion endpoint (API key auth)
- GET /api/about - Platform info (public)

## Dashboard Views
- **Security Hub**: Main overview with threat level indicator, system status panels, global ingress vectors map, event stream
- **Traffic Monitor**: Real-time traffic analysis with bandwidth/throughput stats, protocol breakdown, filterable live traffic feed
- **Global Map**: Worldwide attack origin tracking with interactive region points, top attack sources and targets
- **Incidents**: Active threat management with severity filtering (critical/high/medium), search, detailed incident table
- **Data Sources**: External IDS/Firewall/API integrations management with API key generation, enable/disable, event count tracking
- **System Mgmt** (admin-only): User management with role editing/deletion, system health monitoring, memory usage, database operations

## Data Sources Architecture
- Data sources send logs → POST /ingest/events (API key auth)
- Ingestion API validates → stores in SQLite + indexes in OpenSearch (dual-write)
- Events appear in dashboard alerts/incidents views via WebSocket (real-time)
- Each source gets unique API key (ns_xxx format)
- Supports: Suricata, Snort, Firewall, Custom API
- Connection methods: HTTP (active), Syslog (future), Agent (future)

## OpenSearch Integration
- `server/opensearch.ts` - Modular OpenSearch service (env-var config, dual-write, bulk indexing)
- Env vars: OPENSEARCH_URL, OPENSEARCH_INDEX, OPENSEARCH_USER, OPENSEARCH_PASS
- SQLite remains primary storage; OpenSearch is optional dual-write target
- Index mapping: SOC-optimized (keyword fields for IPs, attack types; date for timestamps; float for confidence)

## Real-Time WebSocket Alerts
- `server/websocket.ts` - WebSocket server on /ws/alerts path
- Broadcasts `alert` (pred=1) and `event` messages to all connected clients
- Dashboard connects via WebSocket, receives instant alerts with toast notifications
- Fallback polling reduced to 15s (WebSocket handles real-time updates)
- Auto-reconnect on disconnect with 5s delay

## AI Chat Integration
- `Modelfile` - Ollama Modelfile for netspectre-soc-ai:v1 (based on qwen2:0.5b) with SOC-tuned system prompt
- POST /api/chat - AI chat endpoint (auth required), proxies to Ollama with fallback to pattern-based responses
- Ollama config: OLLAMA_URL (default: http://localhost:11434), OLLAMA_MODEL (default: netspectre-soc-ai)
- Frontend chat sends full conversation history to backend, shows loading state with animated spinner
- When Ollama is unavailable, falls back to keyword-based SOC responses with live stats
- `server/socContext.ts` - SOC intelligence context builder with OpenSearch + SQLite dual-source telemetry
- SOC context provides: total events, active alerts, top attacker IPs, top attack types, severity distribution, last 24h activity, recent alerts
- Chat responses include `source` (ollama/fallback) and `telemetrySource` (opensearch/sqlite) metadata
- Frontend renders SOC-style responses with severity color coding (red=CRITICAL, amber=HIGH, yellow=MEDIUM) and terminal-like formatting
- OpenSearch analytics: getRecentAlerts, getTopAttackTypes, getTopSourceIPs, getSeverityDistribution, getEventsLast24h (all with DSL aggregation queries)

## Data Source Lifecycle
- Centralized `validateApiKey()` helper validates API keys on every ingest request
- Disabled sources return HTTP 403, deleted/invalid keys return HTTP 401
- `SOFT_DELETE_EVENTS` env var (default: true) controls event cleanup on source deletion
  - true: events tagged `[deleted-source] <name>` (orphaned, preserved for audit)
  - false: events hard-deleted from SQLite + OpenSearch
- DELETE /api/data-sources/:id returns `{ message, details: { sourceName, apiKeyRevoked, eventsAffected, eventAction } }`
- Ingestion endpoints: POST /ingest/events, POST /ingest/suricata, POST /api/ingest/events, POST /api/ingest/suricata
- OpenSearch: `deleteEventsBySource()` uses `_delete_by_query` on `src_model` field

## Recent Changes
- 2026-02-08: Implemented full data source lifecycle: centralized API key validation, delete with event cleanup, revoke key on delete
- 2026-02-08: Added /ingest/suricata endpoint for native Suricata EVE JSON ingestion
- 2026-02-08: Registered /api/ingest/* routes for external access compatibility
- 2026-02-08: Updated Modelfile and backend system prompt with production-grade SOC AI prompt
- 2026-02-06: Added System Management view (admin-only) with user management, system health, memory monitoring, database operations
- 2026-02-06: Added admin API routes: GET/PATCH/DELETE /api/admin/users, GET /api/admin/system-health, POST /api/admin/events/clear
- 2026-02-06: Added functional sidebar navigation with 5 views (Security Hub, Traffic Monitor, Global Map, Incidents, System Mgmt)
- 2026-02-06: Built Traffic Monitor with real-time stats, protocol breakdown, and searchable traffic feed
- 2026-02-06: Built Incidents view with severity filtering, search, and comprehensive alert table
- 2026-02-06: Built Global Map with interactive attack origin regions, top sources/targets analysis
- 2026-02-06: Added functional notification bell with recent critical/high alerts dropdown
- 2026-02-06: Switched database from PostgreSQL to SQLite (netspectre.db)
- 2026-02-06: Full backend implementation with SQLite, JWT auth, event APIs
- 2026-02-06: Connected frontend to real backend APIs
- 2026-02-06: Added change-password page with mandatory flow for default admin
- 2026-02-06: Added About page with developer credits
- 2026-02-06: 50 demo security events seeded on startup

## Color System
- Background: Deep slate (222 47% 11%)
- Primary: Electric cyan (190 100% 50%)
- Critical: Red
- Fonts: Oxanium (headers), Inter (UI), JetBrains Mono (data/code)