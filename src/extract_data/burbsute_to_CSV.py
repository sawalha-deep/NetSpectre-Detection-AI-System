#!/usr/bin/env python3
import base64
import re
import math
import argparse
import pandas as pd
from lxml import etree
from urllib.parse import urlparse, parse_qs, unquote

LABEL = 1
ATTACK_TYPE = "SQLi"

# ==================== UTILS ====================
def shannon_entropy(s):
    if not s:
        return 0
    probs = [s.count(c) / len(s) for c in set(s)]
    return -sum(p * math.log2(p) for p in probs)

def ratios(payload):
    if not payload:
        return [0]*9

    l = len(payload)
    return [
        sum(c.isdigit() for c in payload) / l,
        sum(not c.isalnum() for c in payload) / l,
        payload.count("'") / l,
        payload.count('"') / l,
        len(re.findall(r'(--|#|/\*)', payload)) / l,
        len(re.findall(r'[=<>]', payload)) / l,
        payload.count(';') / l,
        payload.count('(') / l,
        payload.count('%') / l
    ]

def extract_cookie(headers):
    for line in headers.splitlines():
        if line.lower().startswith("cookie:"):
            return line.split(":", 1)[1].strip()
    return ""

# ==================== PARSER ====================
def parse_burp_xml(xml_file, extract_mode):
    tree = etree.parse(xml_file)
    root = tree.getroot()

    rows = []

    for item in root.findall("item"):
        try:
            request_node = item.find("request")
            if request_node is None:
                continue

            request_b64 = request_node.text
            method = item.findtext("method", "").upper()
            url = item.findtext("url", "")
            frame_len = int(item.findtext("responseLength", "0"))
            retransmission = 0

            raw = base64.b64decode(request_b64).decode(errors="ignore")

            parts = raw.split("\r\n\r\n", 1)
            headers = parts[0]
            body = parts[1] if len(parts) > 1 else ""

            parsed = urlparse(url)
            query = parsed.query
            params = parse_qs(query)
            cookie = extract_cookie(headers)

            # ===== PAYLOAD SELECTION =====
            payload_parts = []

            if extract_mode == "query":
                payload_parts.append(query)
            elif extract_mode == "body":
                payload_parts.append(body)
            elif extract_mode == "cookie":
                payload_parts.append(cookie)
            else:  # all
                payload_parts.extend([query, body, cookie])

            payload = unquote(" ".join(payload_parts)).strip().lower()

            tokens = re.findall(r"[a-z0-9_]+", payload)
            token_lengths = [len(t) for t in tokens]

            (
                digit_ratio, special_ratio, quote_ratio, dquote_ratio,
                comment_ratio, operator_ratio, semicolon_ratio,
                paren_ratio, encoded_ratio
            ) = ratios(payload)

            rows.append([
                1 if method == "GET" else 0,
                1 if method == "POST" else 0,
                len(url),
                len(payload),
                len(params),
                shannon_entropy(payload),
                len(tokens),
                max(token_lengths) if token_lengths else 0,
                sum(token_lengths)/len(token_lengths) if token_lengths else 0,
                digit_ratio,
                special_ratio,
                quote_ratio,
                dquote_ratio,
                comment_ratio,
                operator_ratio,
                semicolon_ratio,
                paren_ratio,
                encoded_ratio,
                payload.count(" ") / len(payload) if payload else 0,
                frame_len,
                retransmission,
                payload,
                LABEL,
                ATTACK_TYPE
            ])

        except Exception:
            continue

    return rows

# ==================== MAIN ====================
def main():
    parser = argparse.ArgumentParser(
        description="Extract SQL Injection features from Burp XML"
    )
    parser.add_argument("-f", "--file", required=True, help="Burp XML input file")
    parser.add_argument("-o", "--output", required=True, help="Output CSV file")
    parser.add_argument(
        "-ex", "--extract",
        choices=["query", "body", "cookie", "all"],
        default="all",
        help="Where to extract payload from"
    )

    args = parser.parse_args()

    data = parse_burp_xml(args.file, args.extract)

    columns = [
        "method_get","method_post","uri_length","payload_length","param_count",
        "payload_entropy","token_count","longest_token","avg_token_len",
        "digit_ratio","special_ratio","quote_ratio","dquote_ratio",
        "comment_ratio","operator_ratio","semicolon_ratio","paren_ratio",
        "encoded_ratio","space_ratio","frame_len","retransmission",
        "payload","label","type"
    ]

    df = pd.DataFrame(data, columns=columns)
    df.to_csv(args.output, index=False)

    print(f"[+] Extracted {len(df)} SQLi samples")
    print(f"[+] Mode: {args.extract}")
    print(f"[+] Saved to: {args.output}")

if __name__ == "__main__":
    main()
