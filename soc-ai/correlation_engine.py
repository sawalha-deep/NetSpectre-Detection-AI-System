import time
import re
from collections import defaultdict, deque

class CorrelationEngine:
    def __init__(self, window_seconds=15):
        self.window = window_seconds
        self.events = defaultdict(deque)

    # ======================
    # SAFE ENTRY POINT
    # ======================
    def process(self, wrapper_event):

        # 🔒 HARD VALIDATION
        if not isinstance(wrapper_event, dict):
            return None

        event = wrapper_event.get("event")
        if not isinstance(event, dict):
            return None   # ⛔ THIS FIXES YOUR ERROR

        src_ip = event.get("src_ip")
        if not src_ip:
            return None

        ts = wrapper_event.get("timestamp")
        if not isinstance(ts, (int, float)):
            ts = time.time()
            wrapper_event["timestamp"] = ts

        self.events[src_ip].append(wrapper_event)

        # cleanup window
        while (
            self.events[src_ip]
            and ts - self.events[src_ip][0].get("timestamp", ts) > self.window
        ):
            self.events[src_ip].popleft()

        return self.classify(src_ip)

    # ======================
    # CLASSIFICATION
    # ======================
    def classify(self, src_ip):
        events = list(self.events.get(src_ip, []))
        if len(events) < 3:
            return None

        f = self.extract_features(events)

        if not f:
            return None

        # WEB ENUMERATION
        if (
            f["http_gets"] >= 5
            and f["unique_paths"] >= 5
            and f["unique_ports"] <= 3
            and f["tool_ua"]
        ):
            return self.alert("Web Enumeration / Content Discovery", "medium", f, src_ip)

        # BRUTE FORCE
        if (
            f["http_posts"] >= 5
            and f["unique_paths"] == 1
            and f["auth_keywords"]
        ):
            return self.alert("Brute Force Authentication", "high", f, src_ip)

        return None

    # ======================
    # FEATURE EXTRACTION (SAFE)
    # ======================
    def extract_features(self, events):
        paths, ports, uas = set(), set(), set()
        gets = posts = 0
        auth_keywords = False

        for w in events:
            event = w.get("event")
            if not isinstance(event, dict):
                continue  # ⛔ skip broken events

            ports.add(event.get("dst_port"))

            payload = event.get("payload")
            if not isinstance(payload, dict):
                continue

            content = payload.get("content", "")
            if not isinstance(content, str):
                continue

            cl = content.lower()

            if content.startswith("GET"):
                gets += 1
            elif content.startswith("POST"):
                posts += 1

            m = re.search(r"(GET|POST)\s+([^\s]+)", content)
            if m:
                paths.add(m.group(2))

            ua = re.search(r"user-agent:\s*(.+)", cl)
            if ua:
                uas.add(ua.group(1))

            if any(k in cl for k in ["login", "password", "auth"]):
                auth_keywords = True

        return {
            "http_gets": gets,
            "http_posts": posts,
            "unique_paths": len(paths),
            "unique_ports": len(ports),
            "tool_ua": any(t in ua for ua in uas for t in ["feroxbuster","gobuster","ffuf","dirbuster"]),
            "auth_keywords": auth_keywords
        }

    # ======================
    # ALERT FORMAT
    # ======================
    def alert(self, attack, severity, features, src_ip):
        return {
            "attack_type": attack,
            "severity": severity,
            "confidence": 0.85,
            "source_ip": src_ip,
            "window": self.window,
            "features": features
        }
