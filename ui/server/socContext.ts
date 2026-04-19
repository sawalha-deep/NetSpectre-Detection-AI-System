import { opensearch } from "./opensearch";
import { storage } from "./storage";

export interface SOCTelemetry {
  totalEvents: number;
  activeAlerts: number;
  severityBreakdown: Record<string, number>;
  topAttackTypes: Array<{ type: string; count: number }>;
  topSourceIPs: Array<{ ip: string; count: number }>;
  eventsLast24h: number;
  recentAlerts: any[];
  source: "opensearch" | "sqlite";
}

async function getFromOpenSearch(): Promise<SOCTelemetry | null> {
  if (!opensearch.isEnabled()) return null;

  try {
    const status = await opensearch.getStatus();
    if (!status.connected || !status.indexExists || status.docCount === 0) return null;

    const [recentAlerts, topAttackTypes, topSourceIPs, severityBreakdown, eventsLast24h] =
      await Promise.all([
        opensearch.getRecentAlerts(10),
        opensearch.getTopAttackTypes(5),
        opensearch.getTopSourceIPs(5),
        opensearch.getSeverityDistribution(),
        opensearch.getEventsLast24h(),
      ]);

    return {
      totalEvents: status.docCount,
      activeAlerts: recentAlerts.length,
      severityBreakdown,
      topAttackTypes,
      topSourceIPs,
      eventsLast24h,
      recentAlerts,
      source: "opensearch",
    };
  } catch (e) {
    console.error("[socContext] OpenSearch query failed, falling back to SQLite:", e);
    return null;
  }
}

async function getFromSQLite(): Promise<SOCTelemetry> {
  const [stats, alerts, allEvents] = await Promise.all([
    storage.getEventStats(),
    storage.getAlerts(10),
    storage.getEvents(100),
  ]);

  const attackCounts: Record<string, number> = {};
  const ipCounts: Record<string, number> = {};
  const now = Date.now();
  let last24h = 0;

  for (const ev of allEvents) {
    attackCounts[ev.attackType] = (attackCounts[ev.attackType] || 0) + 1;
    if (ev.pred === 1) {
      ipCounts[ev.srcIp] = (ipCounts[ev.srcIp] || 0) + 1;
    }
    if (new Date(ev.timestamp).getTime() > now - 86400000) {
      last24h++;
    }
  }

  const topAttackTypes = Object.entries(attackCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  const topSourceIPs = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ip, count]) => ({ ip, count }));

  return {
    totalEvents: stats.total,
    activeAlerts: stats.alerts,
    severityBreakdown: {
      critical: stats.critical,
      high: stats.high,
      medium: stats.medium,
      low: stats.low,
    },
    topAttackTypes,
    topSourceIPs,
    eventsLast24h: last24h,
    recentAlerts: alerts.map((a) => ({
      event_id: a.eventId,
      timestamp: a.timestamp,
      src_ip: a.srcIp,
      dst_ip: a.dstIp,
      attack_type: a.attackType,
      severity: a.severity,
      confidence: a.confidence,
    })),
    source: "sqlite",
  };
}

export async function getSOCTelemetry(): Promise<SOCTelemetry> {
  const osData = await getFromOpenSearch();
  if (osData) return osData;
  return getFromSQLite();
}

export function buildSOCContextPrompt(telemetry: SOCTelemetry): string {
  const severityLine = Object.entries(telemetry.severityBreakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const attacksLine = telemetry.topAttackTypes
    .map((a) => `${a.type} (${a.count})`)
    .join(", ");

  const ipsLine = telemetry.topSourceIPs
    .map((i) => `${i.ip} (${i.count} alerts)`)
    .join(", ");

  const recentLine = telemetry.recentAlerts
    .slice(0, 5)
    .map(
      (a: any) =>
        `[${a.severity?.toUpperCase()}] ${a.attack_type} from ${a.src_ip} → ${a.dst_ip} (conf: ${a.confidence})`
    )
    .join("\n  ");

  return `=== LIVE SOC TELEMETRY (${new Date().toISOString()}) ===
Source: ${telemetry.source === "opensearch" ? "OpenSearch index" : "SQLite primary DB"}
Total Events: ${telemetry.totalEvents}
Active Alerts: ${telemetry.activeAlerts}
Events (Last 24h): ${telemetry.eventsLast24h}
Severity Distribution: ${severityLine || "No data"}
Top Attack Types: ${attacksLine || "No data"}
Top Attacker IPs: ${ipsLine || "No data"}
Recent Alerts:
  ${recentLine || "No recent alerts"}
=== END TELEMETRY ===`;
}

export function buildFallbackResponse(
  telemetry: SOCTelemetry,
  userMessage: string
): string {
  const msg = userMessage.toLowerCase();
  const sev = telemetry.severityBreakdown;
  const topAttack = telemetry.topAttackTypes[0];
  const topIP = telemetry.topSourceIPs[0];

  if (msg.includes("status") || msg.includes("health")) {
    return `[SOC STATUS] ${telemetry.totalEvents} events ingested | ${telemetry.activeAlerts} active alerts | ${telemetry.eventsLast24h} events in last 24h. Severity breakdown — ${Object.entries(sev).filter(([,v]) => v > 0).map(([k,v]) => `${k}: ${v}`).join(", ")}. Detection engines operational.`;
  }

  if (msg.includes("threat") || msg.includes("risk")) {
    const level = (sev.critical || 0) > 0 ? "CRITICAL" : (sev.high || 0) > 0 ? "HIGH" : "MODERATE";
    return `[THREAT ASSESSMENT] Current risk level: ${level}. ${telemetry.activeAlerts} active alerts detected. ${topAttack ? `Primary threat vector: ${topAttack.type} (${topAttack.count} occurrences).` : ""} ${topIP ? `Top attacker IP: ${topIP.ip} (${topIP.count} alerts).` : ""} Recommend immediate triage of critical incidents.`;
  }

  if (msg.includes("alert") || msg.includes("incident")) {
    const recent = telemetry.recentAlerts.slice(0, 3);
    const alertLines = recent.map((a: any) => `  • [${(a.severity || "").toUpperCase()}] ${a.attack_type} from ${a.src_ip} → ${a.dst_ip}`).join("\n");
    return `[ALERT SUMMARY] ${telemetry.activeAlerts} active incidents.\n${alertLines || "  No recent alerts."}\n${topAttack ? `Most frequent: ${topAttack.type}.` : ""} Navigate to Incidents view for full triage.`;
  }

  if (msg.includes("traffic") || msg.includes("network")) {
    return `[NETWORK ANALYSIS] ${telemetry.totalEvents} total events observed. ${telemetry.eventsLast24h} events in last 24h. ${topAttack ? `Dominant pattern: ${topAttack.type}.` : ""} ${topIP ? `Highest volume source: ${topIP.ip}.` : ""} Traffic levels: ${telemetry.activeAlerts > 10 ? "ELEVATED" : "NORMAL"}.`;
  }

  if (msg.includes("attacker") || msg.includes("source") || msg.includes("ip")) {
    const ipLines = telemetry.topSourceIPs.map((i) => `  • ${i.ip}: ${i.count} alert(s)`).join("\n");
    return `[ATTACKER INTEL] Top source IPs generating alerts:\n${ipLines || "  No attacker data available."}\nRecommend blocking or monitoring these addresses.`;
  }

  return `[SOC AI] ${telemetry.totalEvents} events tracked, ${telemetry.activeAlerts} active alerts. ${topAttack ? `Primary threat: ${topAttack.type}.` : ""} ${topIP ? `Top attacker: ${topIP.ip}.` : ""} Use keywords like "status", "threat", "alerts", "traffic", or "attacker" for detailed analysis.`;
}
