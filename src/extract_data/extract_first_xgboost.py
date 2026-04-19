#!/usr/bin/env python3
import argparse
import numpy as np
import pandas as pd
from scapy.all import rdpcap, IP, TCP, UDP, ARP
from collections import defaultdict

# ================= ARGUMENTS =================
parser = argparse.ArgumentParser(description="Extract live-scan features from PCAP")
parser.add_argument("-f", "--file", required=True, help="Input PCAP file")
parser.add_argument("-o", "--output", default="features.csv", help="Output CSV")
parser.add_argument("-l", "--label", type=int, choices=[0,1], required=True,
                    help="0 = Normal, 1 = Attack")
parser.add_argument("-a", "--attack", default="NORMAL",
                    help="Attack type (SYN_SCAN, SSH_BRUTEFORCE, NORMAL...)")
args = parser.parse_args()

PCAP_FILE   = args.file
OUTPUT_FILE = args.output
LABEL       = args.label
ATTACK_TYPE = args.attack

# ================= STORAGE =================
flows = {}

src_stats = defaultdict(lambda: {
    "ports": set(),
    "ips": set(),
    "timestamps": [],
    "connections_22": 0
})

# ================= FLOW INIT =================
def new_flow(ts):
    return {
        "start": ts,
        "last": ts,
        "fwd_pkts": 0,
        "bwd_pkts": 0,
        "fwd_bytes": 0,
        "bwd_bytes": 0,
        "sizes": [],
        "iat": [],
        "flags": {"S":0,"A":0,"F":0,"R":0,"P":0,"U":0},
        "zero_payload": 0
    }

# ================= FLAG ENTROPY =================
def entropy(flags):
    v = np.array(list(flags.values()), dtype=float)
    s = v.sum()
    if s == 0:
        return 0.0
    p = v / s
    return float(-np.sum(p * np.log2(p + 1e-9)))

# ================= FLOW FEATURES =================
def flow_features(key, f):
    dur = max(f["last"] - f["start"], 1e-6)
    src = key[0]

    return {
        "src_ip": key[0],
        "dst_ip": key[1],
        "src_port": key[2],
        "dst_port": key[3],
        "proto": key[4],

        "duration": round(dur,6),
        "fwd_pkts": f["fwd_pkts"],
        "bwd_pkts": f["bwd_pkts"],
        "fwd_bytes": f["fwd_bytes"],
        "bwd_bytes": f["bwd_bytes"],
        "pkt_rate": round(f["fwd_pkts"] / dur, 2),

        "pkt_size_mean": float(np.mean(f["sizes"])) if f["sizes"] else 0.0,
        "pkt_size_std": float(np.std(f["sizes"])) if f["sizes"] else 0.0,
        "iat_mean": float(np.mean(f["iat"])) if f["iat"] else 0.0,
        "iat_std": float(np.std(f["iat"])) if f["iat"] else 0.0,

        "syn": f["flags"]["S"],
        "ack": f["flags"]["A"],
        "fin": f["flags"]["F"],
        "rst": f["flags"]["R"],
        "psh": f["flags"]["P"],
        "urg": f["flags"]["U"],

        "half_open_ratio": round(f["flags"]["S"] / max(1, f["flags"]["A"]), 3),
        "flag_entropy": round(entropy(f["flags"]), 3),
        "zero_payload_ratio": round(f["zero_payload"] / max(1, f["fwd_pkts"]), 3),

        "unique_ports": len(src_stats[src]["ports"]),
        "unique_ips": len(src_stats[src]["ips"]),
        "scan_speed": round(len(src_stats[src]["timestamps"]) / dur, 2),

        # ===== SSH / BRUTE FORCE FEATURES =====
        "connections_to_22": src_stats[src]["connections_22"],
        "failed_ratio": round(f["flags"]["R"] / max(1, f["fwd_pkts"]), 3),

        # ===== HEURISTIC SCORES =====
        "syn_scan_score": int(f["flags"]["S"] > 0 and f["flags"]["A"] == 0),
        "fin_scan_score": int(f["flags"]["F"] > 0 and sum(f["flags"].values()) == f["flags"]["F"]),
        "null_scan_score": int(sum(f["flags"].values()) == 0),
        "xmas_scan_score": int(f["flags"]["F"] > 0 and f["flags"]["P"] > 0 and f["flags"]["U"] > 0),
        "udp_scan_score": int(key[4] == "UDP"),

        # ===== LABELS =====
        "label": LABEL,
        "attack_type": ATTACK_TYPE
    }

# ================= PARSE PCAP =================
print(f"[+] Reading {PCAP_FILE}")
packets = rdpcap(PCAP_FILE)

for pkt in packets:
    if pkt.haslayer(ARP) or not pkt.haslayer(IP):
        continue

    ip = pkt[IP]

    if pkt.haslayer(TCP):
        proto = "TCP"
        sport = pkt[TCP].sport
        dport = pkt[TCP].dport
    elif pkt.haslayer(UDP):
        proto = "UDP"
        sport = pkt[UDP].sport
        dport = pkt[UDP].dport
    else:
        continue

    ts = float(pkt.time)
    key = (ip.src, ip.dst, sport, dport, proto)

    if key not in flows:
        flows[key] = new_flow(ts)

    f = flows[key]
    size = len(pkt)

    f["fwd_pkts"] += 1
    f["fwd_bytes"] += size
    f["sizes"].append(size)
    f["iat"].append(ts - f["last"])
    f["last"] = ts

    if pkt.haslayer(TCP):
        flags = pkt[TCP].flags
        if flags & 0x02: f["flags"]["S"] += 1
        if flags & 0x10: f["flags"]["A"] += 1
        if flags & 0x01: f["flags"]["F"] += 1
        if flags & 0x04: f["flags"]["R"] += 1
        if flags & 0x08: f["flags"]["P"] += 1
        if flags & 0x20: f["flags"]["U"] += 1
        if len(pkt[TCP].payload) == 0:
            f["zero_payload"] += 1

    # ===== SOURCE BEHAVIOR =====
    src_stats[ip.src]["ports"].add(dport)
    src_stats[ip.src]["ips"].add(ip.dst)
    src_stats[ip.src]["timestamps"].append(ts)

    if dport == 22:
        src_stats[ip.src]["connections_22"] += 1

# ================= EXPORT =================
rows = [flow_features(k, f) for k, f in flows.items()]
df = pd.DataFrame(rows)
df.to_csv(OUTPUT_FILE, index=False)

print(f"[✓] Saved {len(df)} flows → {OUTPUT_FILE}")
print("[✓] Feature extraction completed successfully")

