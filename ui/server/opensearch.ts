import type { SecurityEvent } from "@shared/schema";

const OPENSEARCH_URL = process.env.OPENSEARCH_URL || "http://localhost:9200";
const OPENSEARCH_INDEX = process.env.OPENSEARCH_INDEX || "netspectre-events";
const OPENSEARCH_USER = process.env.OPENSEARCH_USER || "";
const OPENSEARCH_PASS = process.env.OPENSEARCH_PASS || "";

function isEnabled(): boolean {
  return !!OPENSEARCH_URL;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (OPENSEARCH_USER && OPENSEARCH_PASS) {
    headers["Authorization"] = "Basic " + Buffer.from(`${OPENSEARCH_USER}:${OPENSEARCH_PASS}`).toString("base64");
  }
  return headers;
}

const INDEX_MAPPING = {
  mappings: {
    properties: {
      event_id: { type: "keyword" },
      timestamp: { type: "date" },
      src_ip: { type: "keyword" },
      dst_ip: { type: "keyword" },
      attack_type: { type: "keyword" },
      confidence: { type: "float" },
      pred: { type: "integer" },
      severity: { type: "keyword" },
      src_model: { type: "keyword" },
      ingest_time: { type: "date" },
    },
  },
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
};

async function ensureIndex(): Promise<void> {
  if (!isEnabled()) return;

  try {
    const checkRes = await fetch(`${OPENSEARCH_URL}/${OPENSEARCH_INDEX}`, {
      method: "HEAD",
      headers: getHeaders(),
    });

    if (checkRes.status === 404) {
      const createRes = await fetch(`${OPENSEARCH_URL}/${OPENSEARCH_INDEX}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(INDEX_MAPPING),
      });

      if (createRes.ok) {
        console.log(`[opensearch] Index '${OPENSEARCH_INDEX}' created`);
      } else {
        const err = await createRes.text();
        console.error(`[opensearch] Failed to create index: ${err}`);
      }
    }
  } catch (error) {
    console.error("[opensearch] Connection error during index check:", error);
  }
}

function eventToDocument(event: SecurityEvent): Record<string, any> {
  return {
    event_id: event.eventId,
    timestamp: event.timestamp,
    src_ip: event.srcIp,
    dst_ip: event.dstIp,
    attack_type: event.attackType,
    confidence: event.confidence,
    pred: event.pred,
    severity: event.severity,
    src_model: event.srcModel,
    ingest_time: event.ingestTime,
  };
}

async function indexEvent(event: SecurityEvent): Promise<boolean> {
  if (!isEnabled()) return false;

  try {
    const doc = eventToDocument(event);
    const res = await fetch(`${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_doc/${event.eventId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(doc),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[opensearch] Index failed for ${event.eventId}: ${err}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[opensearch] Index error for ${event.eventId}:`, error);
    return false;
  }
}

async function indexEvents(events: SecurityEvent[]): Promise<{ indexed: number; failed: number }> {
  if (!isEnabled() || events.length === 0) return { indexed: 0, failed: 0 };

  try {
    let bulkBody = "";
    for (const event of events) {
      bulkBody += JSON.stringify({ index: { _index: OPENSEARCH_INDEX, _id: event.eventId } }) + "\n";
      bulkBody += JSON.stringify(eventToDocument(event)) + "\n";
    }

    const res = await fetch(`${OPENSEARCH_URL}/_bulk`, {
      method: "POST",
      headers: { ...getHeaders(), "Content-Type": "application/x-ndjson" },
      body: bulkBody,
    });

    if (res.ok) {
      const data = await res.json();
      const failed = data.items?.filter((i: any) => i.index?.error).length || 0;
      return { indexed: events.length - failed, failed };
    }
    return { indexed: 0, failed: events.length };
  } catch (error) {
    console.error("[opensearch] Bulk index error:", error);
    return { indexed: 0, failed: events.length };
  }
}

async function getStatus(): Promise<{ connected: boolean; indexExists: boolean; docCount: number }> {
  if (!isEnabled()) return { connected: false, indexExists: false, docCount: 0 };

  try {
    const res = await fetch(`${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_count`, {
      headers: getHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      return { connected: true, indexExists: true, docCount: data.count || 0 };
    }
    if (res.status === 404) {
      return { connected: true, indexExists: false, docCount: 0 };
    }
    return { connected: false, indexExists: false, docCount: 0 };
  } catch {
    return { connected: false, indexExists: false, docCount: 0 };
  }
}

async function searchQuery(body: Record<string, any>): Promise<any> {
  const res = await fetch(`${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_search`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenSearch query failed: ${res.status}`);
  return res.json();
}

async function getRecentAlerts(limit = 20): Promise<any[]> {
  if (!isEnabled()) return [];
  try {
    const data = await searchQuery({
      size: limit,
      query: { term: { pred: 1 } },
      sort: [{ timestamp: { order: "desc" } }],
    });
    return data.hits?.hits?.map((h: any) => h._source) || [];
  } catch (e) {
    console.error("[opensearch] getRecentAlerts error:", e);
    return [];
  }
}

async function getTopAttackTypes(limit = 10): Promise<Array<{ type: string; count: number }>> {
  if (!isEnabled()) return [];
  try {
    const data = await searchQuery({
      size: 0,
      aggs: {
        attack_types: {
          terms: { field: "attack_type", size: limit },
        },
      },
    });
    return (data.aggregations?.attack_types?.buckets || []).map((b: any) => ({
      type: b.key,
      count: b.doc_count,
    }));
  } catch (e) {
    console.error("[opensearch] getTopAttackTypes error:", e);
    return [];
  }
}

async function getTopSourceIPs(limit = 10): Promise<Array<{ ip: string; count: number }>> {
  if (!isEnabled()) return [];
  try {
    const data = await searchQuery({
      size: 0,
      query: { term: { pred: 1 } },
      aggs: {
        top_ips: {
          terms: { field: "src_ip", size: limit },
        },
      },
    });
    return (data.aggregations?.top_ips?.buckets || []).map((b: any) => ({
      ip: b.key,
      count: b.doc_count,
    }));
  } catch (e) {
    console.error("[opensearch] getTopSourceIPs error:", e);
    return [];
  }
}

async function getSeverityDistribution(): Promise<Record<string, number>> {
  if (!isEnabled()) return {};
  try {
    const data = await searchQuery({
      size: 0,
      aggs: {
        severities: {
          terms: { field: "severity", size: 10 },
        },
      },
    });
    const result: Record<string, number> = {};
    for (const b of data.aggregations?.severities?.buckets || []) {
      result[b.key] = b.doc_count;
    }
    return result;
  } catch (e) {
    console.error("[opensearch] getSeverityDistribution error:", e);
    return {};
  }
}

async function getEventsLast24h(): Promise<number> {
  if (!isEnabled()) return 0;
  try {
    const data = await searchQuery({
      size: 0,
      query: {
        range: { timestamp: { gte: "now-24h" } },
      },
    });
    return data.hits?.total?.value || 0;
  } catch (e) {
    console.error("[opensearch] getEventsLast24h error:", e);
    return 0;
  }
}

async function deleteEventsBySource(sourceName: string): Promise<number> {
  if (!isEnabled()) return 0;
  try {
    const res = await fetch(`${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_delete_by_query`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        query: { term: { src_model: sourceName } },
      }),
    });
    if (res.ok) {
      const data = await res.json() as any;
      return data.deleted || 0;
    }
    return 0;
  } catch (error) {
    console.error("[opensearch] deleteEventsBySource error:", error);
    return 0;
  }
}

export const opensearch = {
  isEnabled,
  ensureIndex,
  indexEvent,
  indexEvents,
  getStatus,
  getRecentAlerts,
  getTopAttackTypes,
  getTopSourceIPs,
  getSeverityDistribution,
  getEventsLast24h,
  deleteEventsBySource,
};
