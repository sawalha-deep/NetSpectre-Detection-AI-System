#!/usr/bin/env python3
"""
import pandas as pd
import math
import re
from urllib.parse import urlparse, parse_qs, unquote
from collections import Counter

# ================= CONFIG =================
INPUT_CSV  = "http_extracted.csv"
OUTPUT_CSV = "sql_dataset_final.csv"

# ================= UTILS =================
def shannon_entropy(s):
    if not s:
        return 0
    freq = Counter(s)
    return -sum((c/len(s)) * math.log2(c/len(s)) for c in freq.values())

def extract_payload_from_uri(uri):
    if not uri or "?" not in uri:
        return ""
    parsed = urlparse(uri)
    params = parse_qs(parsed.query)
    values = []
    for v in params.values():
        values.extend(v)
    return unquote(" ".join(values))

def tokenize(payload):
    tokens = re.split(r"[=&\s]", payload)
    return [t for t in tokens if t]

# ================= FEATURE EXTRACT =================
def extract_features(payload, method, frame_len, retrans):
    payload = payload or ""
    method = (method or "").upper()

    length = len(payload)
    digits = sum(c.isdigit() for c in payload)
    specials = sum(not c.isalnum() for c in payload)
    spaces = payload.count(" ")
    encoded = payload.count("%")

    tokens = tokenize(payload)

    return {
        # ===== METHOD (One-Hot) =====
        "method_get": 1 if method == "GET" else 0,
        "method_post": 1 if method == "POST" else 0,

        # ===== PAYLOAD STATS =====
        "length": length,
        "param_count": payload.count("="),
        "digit_ratio": digits / length if length else 0,
        "special_char_ratio": specials / length if length else 0,
        "whitespace_ratio": spaces / length if length else 0,
        "encoded_ratio": encoded / length if length else 0,
        "entropy": shannon_entropy(payload),
        "longest_token": max((len(t) for t in tokens), default=0),
        "avg_token_len": sum(len(t) for t in tokens)/len(tokens) if tokens else 0,

        # ===== NETWORK =====
        "frame_len": frame_len,
        "retransmission": int(bool(retrans))
    }

# ================= MAIN =================
df = pd.read_csv(INPUT_CSV)
rows = []

#for _, r in df.iterrows():
#    uri = r.get("http.request.uri", "")
#    method = r.get("http.request.method", "")

#    payload = extract_payload_from_uri(uri)

#    features = extract_features(
#        payload=payload,
#        method=method,
#        frame_len=r.get("frame.len", 0),
#        retrans=r.get("tcp.analysis.retransmission", 0)
#    )
#
#    features["payload"] = payload
#
#    # ⚠️ label:
#    # 1 = SQLi
#    # 0 = Normal
#    features["label"] = r.get("label", 0)

#   rows.append(features)

#out = pd.DataFrame(rows)
#out.to_csv(OUTPUT_CSV, index=False)

#print(f"[+] Dataset created: {OUTPUT_CSV}")
#print(f"[+] Samples: {len(out)}")
"""

#!/usr/bin/env python3

import pandas as pd
import numpy as np
import math
import re
from urllib.parse import urlparse, parse_qs, unquote
from collections import Counter

# ================= CONFIG =================
INPUT_CSV  = "http_extracted3.csv"
OUTPUT_CSV = "sql_dataset3.csv"

# ================= UTILS =================
def shannon_entropy(s):
    if not s:
        return 0
    freq = Counter(s)
    return -sum((v/len(s))*math.log2(v/len(s)) for v in freq.values())

def extract_get_payload(uri):
    if not uri or "?" not in uri:
        return ""
    parsed = urlparse(uri)
    params = parse_qs(parsed.query)
    values = []
    for v in params.values():
        values.extend(v)
    return unquote(" ".join(values))

def clean_payload(p):
    return re.sub(r"\s+", " ", p.strip())

def char_ratios(payload):
    L = len(payload) or 1
    return {
        "digit_ratio": sum(c.isdigit() for c in payload)/L,
        "special_ratio": sum(not c.isalnum() for c in payload)/L,
        "quote_ratio": payload.count("'")/L,
        "dquote_ratio": payload.count('"')/L,
        "comment_ratio": (payload.count("--")+payload.count("#"))/L,
        "operator_ratio": sum(payload.count(x) for x in "=<>+-*/")/L,
        "semicolon_ratio": payload.count(";")/L,
        "paren_ratio": (payload.count("(")+payload.count(")"))/L,
        "encoded_ratio": payload.count("%")/L,
        "space_ratio": payload.count(" ")/L
    }

# ================= LOAD =================
df = pd.read_csv(INPUT_CSV)
dataset = []

for _, row in df.iterrows():

    method = str(row.get("http.request.method",""))
    uri    = str(row.get("http.request.uri",""))
    body   = str(row.get("http.file_data",""))

    # ================= PAYLOAD =================
    get_payload  = extract_get_payload(uri)
    post_payload = unquote(body)
    payload = clean_payload(get_payload + " " + post_payload)

    tokens = re.split(r"[^\w]", payload)

    features = {
        # ---------- HTTP ----------
        "method_get": 1 if method == "GET" else 0,
        "method_post": 1 if method == "POST" else 0,

        # ---------- LENGTH ----------
        "uri_length": len(uri),
        "payload_length": len(payload),
        "param_count": payload.count("="),

        # ---------- ENTROPY ----------
        "payload_entropy": shannon_entropy(payload),

        # ---------- TOKENS ----------
        "token_count": len(tokens),
        "longest_token": max([len(t) for t in tokens], default=0),
        "avg_token_len": np.mean([len(t) for t in tokens]) if tokens else 0,

        # ---------- NETWORK ----------
        "frame_len": row.get("frame.len",0),
        "retransmission": 0 if pd.isna(row.get("tcp.analysis.retransmission")) else 1,

        # ---------- PAYLOAD ----------
        "payload": payload,

        # ---------- LABEL ----------
        "label": 1,  # SQL INJECTION
        "type": "SQL-Inject\n"
    }

    features.update(char_ratios(payload))
    dataset.append(features)

# ================= SAVE =================
out = pd.DataFrame(dataset)
out.to_csv(OUTPUT_CSV, index=False)

print("[+] SQL Injection dataset created")
print("[+] Rows:", len(out))
print("[+] Saved as:", OUTPUT_CSV)
