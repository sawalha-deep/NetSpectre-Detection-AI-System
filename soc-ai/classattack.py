#!/usr/bin/env python3
import warnings
warnings.filterwarnings("ignore", category=UserWarning)

import json
import time
import redis
import joblib
import pandas as pd
import numpy as np

import requests
from datetime import datetime
import subprocess
import argparse


# ========== COLORS ==========
RED = "\033[91m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
BLUE = "\033[94m"
RESET = "\033[0m"
PURPLE = "\033[35m"

# ===============================
# ARGUMENTS
# ===============================
parser = argparse.ArgumentParser(description="NetSpectre SOC AI Agent")

parser.add_argument(
    "--cli",
    action="store_true",
    help="Run normal SOC CLI mode"
)

parser.add_argument(
    "--web",
    action="store_true",
    help="Enable Web behavior analysis mode"
)

args = parser.parse_args()

CLI_MODE = args.cli
WEB_MODE = args.web


from datetime import datetime, UTC
import requests

class SendToUI:
    def __init__(self, endpoint=None, api_key=None, timeout=3):
        self.endpoint = endpoint
        self.api_key = api_key
        self.timeout = timeout

    def send(self, src_ip, dst_ip, attack_type, confidence, src_model, pred):
        if not self.endpoint:
            #print("❌ UI endpoint not configured")
            return False

        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "attack_type": attack_type,
            "confidence": float(confidence) if float(confidence) <= 1 else float(confidence) / 100,
            "pred": int(pred),
            "src_model": src_model
        }

        headers = {"Content-Type": "application/json"}

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            r = requests.post(self.endpoint, json=payload, headers=headers, timeout=self.timeout)

            #print("📡 Sending to UI...")
            #print("STATUS:", r.status_code)
            #print("RESPONSE:", r.text)

            return r.status_code in (200, 201)

        except Exception as e:
            print("❌ SendToUI error:", e)
            return False


ui =None



if WEB_MODE:
    ui = SendToUI(
    endpoint="http://localhost:5000/ingest/events",
    api_key="ns_f8d0a3fb049d4ec78212f23bd1248f4f"
)

def web_rule_detection(feats, event):
    """
    Distinguish between:
    - Web Enumeration
    - Web Bruteforce
    - Normal Web Application activity
    """

    total_packets = feats.get("total_packets", 0)
    unique_urls = feats.get("unique_dst_ports", 0)   # بديل تقريبي للتعداد
    syn = feats.get("syn_flag_count", 0)
    rst = feats.get("rst_flag_count", 0)
    bytes_ = event.get("bytes", 0)

    # ---------------------------
    # 1) Web Bruteforce
    # محاولات كثيرة + SYN عالي + بايتات قليلة
    # ---------------------------
    if syn > 15 and total_packets > 30 and bytes_ < 5000:
        return "🔐 Web Bruteforce Attack"

    # ---------------------------
    # 2) Web Enumeration
    # طلبات كثيرة لصفحات مختلفة بدون SYN عالي
    # ---------------------------
    if unique_urls > 10 and syn < 5 and total_packets > 20:
        return "🧭 Web Enumeration"

    # ---------------------------
    # 3) Normal Web App Activity
    # ---------------------------
    return "🌍 Web Application Activity"


def soc_ai_banner():
    banner = f"""{PURPLE} 

    ░█▀█░█▀▀░▀█▀░█▀▀░█▀█░█▀▀░█▀▀░▀█▀░█▀▄░█▀▀░░░░░█▀█░▀█▀
    ░█░█░█▀▀░░█░░▀▀█░█▀▀░█▀▀░█░░░░█░░█▀▄░█▀▀░▄▄▄░█▀█░░█░
    ░▀░▀░▀▀▀░░▀░░▀▀▀░▀░░░▀▀▀░▀▀▀░░▀░░▀░▀░▀▀▀░░░░░▀░▀░▀▀▀                                                                                     
        {RESET} This Agent For Soc Analysis V1.0
    """
    subprocess.call("clear", shell=True)
    print(banner)


# ===============================
# CONFIG
# ===============================
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0

QUEUE_NAME = "netspectre:events"

DEDUP_PREFIX = "netspectre:dedup:attack"
DEDUP_TTL = 5  # seconds

MODEL_PATH = "./models/ids_xgb_optunaV2.joblib"

# ⚠️ EXACT TRAINING ORDER — DO NOT CHANGE
FEATURES = [
    "protocol",
    "dst_port",
    "service_hint",
    "total_packets",
    "total_fwd_packets",
    "total_bwd_packets",
    "fin_flag_count",
    "syn_flag_count",
    "rst_flag_count",
    "psh_flag_count",
    "ack_flag_count",
    "urg_flag_count",
    "total_flag_count",
    "fwd_bwd_packet_ratio",
    "down_up_ratio",
    "unique_src_ports",
    "unique_dst_ports",
    "bytes",
    "avg_packet_size",
]

CLASSES = [
    "ddos",
    "ftp_bruteforce",
    "icmp_scan",
    "scan",
    "shellcode",
    "slow_scan",
    "ssh_bruteforce",
    "web_bruteforce",
    "xss",
]

def should_send(event, attack, window=120):
    key = (
        f"dedup:"
        f"{event.get('src_ip')}|"
        f"{event.get('dst_ip')}|"
        f"{event.get('dst_port')}|"
        f"{event.get('protocol')}|"
        f"{attack}"
    )

    # Atomic set → يمنع السباق
    return redis_cli.set(key, 1, nx=True, ex=window)


# ===============================
# HELPERS
# ===============================
def service_from_port(port):
    if port == 22:
        return 1
    if port in (80, 443, 8080, 8000):
        return 2
    return 0


def dedup_key(event, attack_type):
    return (
        f"{event.get('src_ip')}|"
        f"{event.get('dst_ip')}|"
        f"{event.get('dst_port')}|"
        f"{attack_type}"
    )


# ===============================
# LOAD MODEL
# ===============================
if CLI_MODE:
    print("[+] Loading attack-type model...")
bundle = joblib.load(MODEL_PATH)

if isinstance(bundle, dict):
    model = bundle.get("model", bundle)
    scaler = bundle.get("scaler", None)
else:
    model = bundle
    scaler = None
if CLI_MODE:
    print("[✓] Model loaded")


# ===============================
# REDIS CONNECT
# ===============================
redis_cli = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=REDIS_DB,
    decode_responses=True,
)

if CLI_MODE:
    soc_ai_banner()
print(f"[✅] NetSpectre {BLUE}SOC-AI{RESET} Agent started")
if CLI_MODE:
    time.sleep(0.6)
    print("[💬] Good day, I am NetSpectre SOC AI Agent here to assist you with your security analysis needs!")
    print("[⏳] Waiting for SOC events...\n")


# ===============================
# MAIN LOOP
# ===============================
from collections import defaultdict, deque

scan_history = defaultdict(lambda: deque(maxlen=2))

while True:
    try:
        _, raw = redis_cli.blpop(QUEUE_NAME)
        payload = json.loads(raw)

        # -------------------------------
        # DIRECT SQLi SOURCE CHECK
        # -------------------------------
        source = payload.get("source") or payload.get("agent") or ""
        sqli_event = payload.get("event", {})
        

        if source == "SQLi_AI_IDS" or sqli_event.get("engine") == "SQLi-DeepLearning":
            if CLI_MODE:
                print(
                    f"🚨 ATTACK TYPE CLASSIFIED \n"
                    f"   • Type       : 💉 SQL Injection\n"
                    f"   • Confidence : {float(sqli_event.get('confidence', 1.0)) * 100:.2f}%\n"
                    f"   • Severity   : {sqli_event.get('severity', 'high')}\n"
                    f"   • Src        : {sqli_event.get('client_ip')}\n"
                    f"   • URL        : {sqli_event.get('url')}\n"
                    f"   • Method     : {sqli_event.get('method')}\n"
                    f"   • Engine     : {sqli_event.get('engine')}\n"
                    f"{'-'*60}\n"
                )
                continue
            else:
                #web.send(f"{sqli_event.get('client_ip')}",f"{sqli_event.get('url')}","💉 SQL Injection",f"{float(sqli_event.get('confidence', 1.0)) * 100:.2f}",f"{sqli_event.get('engine')}",1)
                ui.send(
                    sqli_event.get("client_ip"),
                    sqli_event.get("url"),
                    "💉 SQL Injection",
                    float(sqli_event.get("confidence", 1.0)),
                    sqli_event.get("engine"),
                    1
                )

        # -------------------------------
        # DIRECT SMB BRUTEFORCE CHECK
        # -------------------------------
        if source == "SMB_AI_IDS" or sqli_event.get("attack_type") == "SMB_Bruteforce":
            if CLI_MODE:
                print(
                    f"🚨 ATTACK TYPE CLASSIFIED (External Engine)"
                    f"   • Type       : 🗂️ SMB Bruteforce"
                    f"   • Confidence : {float(sqli_event.get('confidence', 1.0)) * 100:.2f}%"
                    f"   • Severity   : {sqli_event.get('severity', 'high')}"
                    f"   • Src        : {sqli_event.get('client_ip') or sqli_event.get('src_ip')}"
                    f"   • Target     : {sqli_event.get('dst_ip')}"
                    f"   • Port       : 445"
                    f"   • Engine     : {sqli_event.get('engine', 'SMB-Detector')}"
                    f"{'-'*60}"
            
                )
                continue


        # -------------------------------
        # UNWRAP EVENT
        # -------------------------------
        event_wrapper = payload.get("event", {})
        event = event_wrapper.get("event", {})

        # ===============================
        # 🔀 FEATURE SOURCE SELECTION
        # ===============================
        default_feats = event.get("features", {})

        feats_111 = event.get("BehaviorAI_IDS111", {}).get("features", {})
        feats_222 = event.get("BehaviorAI_IDS222", {}).get("features", {})

        unique_dst_ports = (
            feats_222.get("unique_dst_ports")
            or feats_111.get("unique_dst_ports")
            or default_feats.get("unique_dst_ports", 0)
        )

        if unique_dst_ports and unique_dst_ports > 2:
            feats = feats_222 if feats_222 else default_feats
            feature_source = "BehaviorAI_IDS111"
            #print(feature_source)
        else:
            feats = feats_111 if feats_111 else default_feats
            feature_source = "BehaviorAI_IDS222"
            #print(feature_source)

        # -------------------------------
        # SMB BRUTEFORCE PRE-RULE (from BehaviorAI sources)
        # -------------------------------
        dst_p = feats.get("dst_port", 0)
        #syn=feats.get("syn_flag_count", 0)
        #p=feats.get("unique_src_ports", 0)
        #print(f"dst_p {dst_p} syn {syn} unique_src_ports {p}")
        if (
            dst_p == 445
            and feats.get("unique_src_ports", 0) > 1
        ):
            if CLI_MODE:
                print(
                    f"🚨 ATTACK TYPE CLASSIFIED \n"
                    f"   • Type       : 🗂️ SMB Bruteforce\n"
                    f"   • Confidence : 95.00%\n"
                    f"   • Src        : {event.get('src_ip')}\n"
                    f"   • Dst        : {event.get('dst_ip')}:445\n"
                    f"   • Src-Model  : BehaviorAI\n"
                    f"{'-'*60}\n"
                )
                continue
            else:
               # web.send(f"{event.get('src_ip')}",f"{event.get('dst_ip')}:445","🗂️ SMB Bruteforce",f"{prob:.2f}","BehaviorAI-Agent",1)
               ui.send(
                    event.get("src_ip"),
                    f"{event.get('dst_ip')}:445",
                    "🗂️ SMB Bruteforce",
                    .96,
                    "BehaviorAI-Agent",
                    1
                )

        # -------------------------------
        # EXTRACT VALUES
        # -------------------------------
        packets = feats.get("total_packets", event.get("flows", 0))
        fwd = feats.get("total_fwd_packets", 0)
        bwd = feats.get("total_bwd_packets", 0)
        bytes_ = event.get("bytes", 0)
        dst_p = feats.get("dst_port", 0)

        # -------------------------------
        # BUILD FEATURE ROW
        # -------------------------------
        row = {
            "protocol": feats.get("protocol", 0),
            "dst_port": dst_p,
            "service_hint": service_from_port(dst_p),
            "total_packets": packets,
            "total_fwd_packets": fwd,
            "total_bwd_packets": bwd,
            "fin_flag_count": feats.get("fin_flag_count", 0),
            "syn_flag_count": feats.get("syn_flag_count", 0),
            "rst_flag_count": feats.get("rst_flag_count", 0),
            "psh_flag_count": feats.get("psh_flag_count", 0),
            "ack_flag_count": feats.get("ack_flag_count", 0),
            "urg_flag_count": feats.get("urg_flag_count", 0),
            "total_flag_count": feats.get("total_flag_count", 0),
            "fwd_bwd_packet_ratio": feats.get("fwd_bwd_packet_ratio", 0),
            "down_up_ratio": feats.get("down_up_ratio", 0),
            "unique_src_ports": feats.get("unique_src_ports", 0),
            "unique_dst_ports": feats.get("unique_dst_ports", 0),
            "bytes": bytes_,
            "avg_packet_size": feats.get(
                "avg_packet_size",
                bytes_ / packets if packets else 0,
            ),
        }

        # -------------------------------
        # DATAFRAME
        # -------------------------------
        X = pd.DataFrame([row])[FEATURES]

        if scaler:
            X = scaler.transform(X)

        # -------------------------------
        # PREDICT
        # -------------------------------
        pred = model.predict(X)[0]
        prob = model.predict_proba(X)[0].max() * 100

        if prob < 90:
            continue
        

        attack = CLASSES[int(pred)] if int(pred) < len(CLASSES) else "unknown"

        # -------------------------------
        # DEDUP
        # -------------------------------
        """dkey = f"{DEDUP_PREFIX}:{dedup_key(event, attack)}"

        if not redis_cli.setnx(dkey, 1):
            continue

        redis_cli.expire(dkey, DEDUP_TTL)"""

        # -------------------------------
        # HUMAN LABELS
        # -------------------------------
        if attack == "web_bruteforce":
            attack = "🌍 Web Application"
        elif attack == "ftp_bruteforce":
            attack = "📁 Ftp BruteForce Authentication"
        elif attack == "ssh_bruteforce":
            attack = "🔐 SSH BruteForce Authentication"
        elif attack in ("scan", "slow_scan", "icmp_scan"):
            attack = "🔍 Reconnaissance/Scanning"
        elif attack == "xss":
            attack = "💥 Cross‑Site Scripting (XSS)"
        elif attack == "ddos":
            attack = "🌊 Denial‑of‑Service Attempt"
        
        

        # -------------------------------
        # OUTPUT
        # -------------------------------
        if CLI_MODE:
            print(
                f"🚨 ATTACK TYPE CLASSIFIED\n"
                f"   • Type       : {attack}\n"
                f"   • Confidence : {prob:.2f}%\n"
                f"   • Src        : {event.get('src_ip')}:{event.get('src_port')}\n"
                f"   • Dst        : {event.get('dst_ip')}:{event.get('dst_port')}\n"
                f"   • Protocol   : {event.get('protocol')}\n"
                f"   • Src-Model  : BehaviorAI\n"
                f"{'-'*60}"
            )
        else:
            #web.send(f"{event.get('src_ip')}:{event.get('src_port')}",f"{event.get('dst_ip')}:{event.get('dst_port')}",f"{attack}",f"{prob:.2f}","BehaviorAI-Agent",1)
            if should_send(event, attack):
    
                ip=""
                if ":" in event.get('src_ip'):
                    ip = event.get('src_ip').split(":")[0]
                    ui.send(
                        f"{ip}",
                        f"{event.get('dst_ip')}:{event.get('dst_port')}",
                        attack,
                        prob,
                        "BehaviorAI-Agent",
                        1
                    )
                else:
                    ui.send(
                        f"{event.get('src_ip')}",
                        f"{event.get('dst_ip')}:{event.get('dst_port')}",
                        attack,
                        prob,
                        "BehaviorAI-Agent",
                        1
                    )
    except KeyboardInterrupt:
        print("\n[!] Stopped by user")
        break

    except Exception as e:
        print(f"[ERROR] {e}")
        time.sleep(1)