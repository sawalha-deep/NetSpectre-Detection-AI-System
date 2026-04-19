import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { SecurityEvent } from "@shared/schema";

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws/alerts") {
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected", message: "NetSpectre real-time alert stream active" }));

    ws.on("error", (err) => {
      console.error("[ws] Client error:", err.message);
    });
  });

  console.log("[ws] WebSocket alert server initialized on /ws/alerts");
}

export function broadcastAlert(event: SecurityEvent): void {
  if (!wss) return;

  const payload = JSON.stringify({
    type: "alert",
    event: {
      id: event.id,
      eventId: event.eventId,
      timestamp: event.timestamp,
      srcIp: event.srcIp,
      dstIp: event.dstIp,
      attackType: event.attackType,
      confidence: event.confidence,
      pred: event.pred,
      severity: event.severity,
      srcModel: event.srcModel,
      ingestTime: event.ingestTime,
    },
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

export function broadcastEvent(event: SecurityEvent): void {
  if (!wss) return;

  const payload = JSON.stringify({
    type: "event",
    event: {
      id: event.id,
      eventId: event.eventId,
      timestamp: event.timestamp,
      srcIp: event.srcIp,
      dstIp: event.dstIp,
      attackType: event.attackType,
      confidence: event.confidence,
      pred: event.pred,
      severity: event.severity,
      srcModel: event.srcModel,
      ingestTime: event.ingestTime,
    },
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

export function getConnectionCount(): number {
  return wss?.clients.size || 0;
}
