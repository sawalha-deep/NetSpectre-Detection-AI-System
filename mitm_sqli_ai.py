#!/usr/bin/env python3
# ======================================================
# mitmproxy + Deep Learning SQL Injection IDS (FINAL)
# ======================================================

from mitmproxy import http
import numpy as np
import pandas as pd
from time import sleep


from library.functions import *

MODEL     = load_model(MODEL_SQLI)
SCALER    = joblib.load(SCALER_SQLI)
TOKENIZER = joblib.load(TOKENIZER_SQLI)

sql_banner()
sleep(.3)

print(f"[✅] Loading 🧠 {BLUE}SQL-Injection AI{RESET} models...\n")
sleep(.3)

# ================= MITMPROXY ADDON =================
class SQLiAI:

    FEATURE_COLUMNS = [
    "method_get","method_post","uri_length","payload_length",
    "param_count","payload_entropy","token_count",
    "longest_token","avg_token_len","digit_ratio",
    "special_ratio","quote_ratio","dquote_ratio",
    "comment_ratio","operator_ratio","semicolon_ratio",
    "paren_ratio","encoded_ratio","space_ratio",
    "frame_len","retransmission"
    ]


    SQL_KEYWORDS = [
        " union ", " select ", " insert ", " update ", " delete ",
        " drop ", " or ", " and ", "--", "/*", "*/",
        " sleep", " benchmark", "'"
    ]


    def __init__(self):
        self.soc = SOCProducer()
    # ---------- HELPERS ----------
    def entropy(self, s):
        if not s:
            return 0
        p = [s.count(c)/len(s) for c in set(s)]
        return -sum(x * math.log2(x) for x in p)

    def ratio(self, x, total):
        return x / total if total else 0

    def is_simple_numeric_param(self, payload):
        if "=" not in payload:
            return False
        for p in payload.split("&"):
            if "=" not in p:
                continue
            _, v = p.split("=", 1)
            if not v.isdigit() or len(v) > 6:
                return False
        return True

    def has_sql_keywords(self, payload):
        p = payload.lower()
        return any(k in p for k in self.SQL_KEYWORDS)

    # ---------- FEATURE EXTRACTION ----------
    def extract_numeric_features(self, payload, req):
        payload = urllib.parse.unquote(payload.lower())
        tokens = payload.split()

        features = {
            "method_get": int(req.method == "GET"),
            "method_post": int(req.method == "POST"),
            "uri_length": len(req.path),
            "payload_length": len(payload),
            "param_count": payload.count("="),
            "payload_entropy": self.entropy(payload),
            "token_count": len(tokens),
            "longest_token": max((len(t) for t in tokens), default=0),
            "avg_token_len": np.mean([len(t) for t in tokens]) if tokens else 0,
            "digit_ratio": self.ratio(sum(c.isdigit() for c in payload), len(payload)),
            "special_ratio": self.ratio(sum(not c.isalnum() for c in payload), len(payload)),
            "quote_ratio": self.ratio(payload.count("'"), len(payload)),
            "dquote_ratio": self.ratio(payload.count('"'), len(payload)),
            "comment_ratio": self.ratio(payload.count("--"), len(payload)),
            "operator_ratio": self.ratio(sum(payload.count(o) for o in "=<>*/+"), len(payload)),
            "semicolon_ratio": self.ratio(payload.count(";"), len(payload)),
            "paren_ratio": self.ratio(payload.count("(")+payload.count(")"), len(payload)),
            "encoded_ratio": self.ratio(payload.count("%"), len(payload)),
            "space_ratio": self.ratio(payload.count(" "), len(payload)),
            "frame_len": len(req.raw_content or b""),
            "retransmission": 0
        }

        df = pd.DataFrame([features])[self.FEATURE_COLUMNS]
        return SCALER.transform(df)

    def extract_text_features(self, payload):
        seq = TOKENIZER.texts_to_sequences([payload])
        return pad_sequences(seq, maxlen=MAX_LEN_SQLI)

    # ---------- AI SCAN ----------
    def scan_payload(self, payload, req):
        if not payload.strip():
            return 0.0

        X_num = self.extract_numeric_features(payload, req)
        X_txt = self.extract_text_features(payload)

        return float(MODEL.predict([X_num, X_txt], verbose=0)[0][0])

    # ---------- MITMPROXY HOOK ----------
    def request(self, flow: http.HTTPFlow):
        req = flow.request

        try:
            query  = "&".join(f"{k}={v}" for k,v in req.query.items(multi=True))
            body   = req.get_text() or ""
            cookie = ";".join(f"{k}={v}" for k,v in req.cookies.items())

            scores = {
                "query":  self.scan_payload(query, req),
                "body":   self.scan_payload(body, req),
                "cookie": self.scan_payload(cookie, req)
            }

            final_score = max(scores.values())
            src = max(scores, key=scores.get)

            # ---- False Positive Mitigation ----
            if src == "query":
                if self.is_simple_numeric_param(query) and not self.has_sql_keywords(query):
                    final_score *= 0.15

            client_ip = flow.client_conn.peername[0] if flow.client_conn.peername else "UNKNOWN"
            soc_event = {
                "attack_type": "SQL_Injection",
                "confidence": round(final_score, 4),
                "severity": (
                    "high" if final_score >= THRESHOLD_BLOCK_SQLI
                    else "medium" if final_score >= THRESHOLD_WARN_SQLI
                    else "low"
                ),
                "vector": src,
                "client_ip": client_ip,
                "method": req.method,
                "url": req.url,
                "user_agent": req.headers.get("User-Agent", "unknown"),
                "payload_size": len((query or body or cookie)),
                "blocked": final_score >= THRESHOLD_BLOCK_SQLI,
                "engine": "SQLi-DeepLearning",
                "model": "CNN+Tokenizer",
            }


            src_icon = {
                "query": "😈 query",
                "body": "💉 body",
                "cookie": "🍪 cookie"
            }[src]

            # ---- DECISION ----
            if final_score >= THRESHOLD_BLOCK_SQLI:
                self.soc.send(
                    source="SQLi_AI_IDS",
                    event=soc_event
                )
                flow.response = http.Response.make(
                    403,
                    b"Blocked by AI SQL Injection IDS",
                    {"Content-Type": "text/plain"}
                )
                print(f"🔴 [{RED} SQLI {RESET}] 🖥️  {client_ip} 🌐 {req.url} | 🧠 prob: {RED}{final_score:.3f}{RESET} [ {src_icon} ]")

            elif final_score >= THRESHOLD_WARN_SQLI:
                self.soc.send(
                    source="SQLi_AI_IDS",
                    event=soc_event
                )
                print(f"⚠️ [{YELLOW}SUSPICIOUS{RESET}] 🖥️  {client_ip} 🌐 {req.url} | 🧠 prob: {YELLOW}{final_score:.3f}{RESET} [ {src_icon} ]")

            else:
                print(f"🟢 [{GREEN}NORMAL{RESET}] 🖥️  {client_ip} 🌐 {req.url} | 🧠 prob: {GREEN}{final_score:.3f}{RESET}")

        except Exception as e:
            print("[SQL-AI ERROR]", e)


addons = [SQLiAI()]
