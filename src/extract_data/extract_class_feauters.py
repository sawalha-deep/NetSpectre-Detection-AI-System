
#!/usr/bin/env python3

import argparse
import csv
from collections import defaultdict
from scapy.all import rdpcap, IP, TCP, UDP

FLOW_TIMEOUT = 5
MIN_PACKETS  = 3

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
    "avg_packet_size"
]

# =========================
# FLOW ID
# =========================
def get_flow_id(pkt):
    if IP not in pkt:
        return None

    proto = pkt[IP].proto
    src   = pkt[IP].src
    dst   = pkt[IP].dst

    if TCP in pkt:
        sport, dport = pkt[TCP].sport, pkt[TCP].dport
    elif UDP in pkt:
        sport, dport = pkt[UDP].sport, pkt[UDP].dport
    else:
        sport = dport = 0

    return tuple(sorted([(src, sport), (dst, dport)])) + (proto,)

# =========================
# SERVICE HINT
# =========================
def service_from_port(port):
    if port == 22:
        return 1   # SSH
    if port in (80, 443, 8080, 8000):
        return 2   # WEB
    return 0       # OTHER

# =========================
# FEATURE EXTRACTION
# =========================
def extract_features(flow):
    fwd = flow["fwd"]
    bwd = flow["bwd"]
    packets = flow["packets"]

    return {
        "protocol": flow["proto"],
        "dst_port": flow["dst_port"],
        "service_hint": service_from_port(flow["dst_port"]),
        "total_packets": packets,
        "total_fwd_packets": fwd,
        "total_bwd_packets": bwd,
        "fin_flag_count": flow["flags"]["FIN"],
        "syn_flag_count": flow["flags"]["SYN"],
        "rst_flag_count": flow["flags"]["RST"],
        "psh_flag_count": flow["flags"]["PSH"],
        "ack_flag_count": flow["flags"]["ACK"],
        "urg_flag_count": flow["flags"]["URG"],
        "total_flag_count": sum(flow["flags"].values()),
        "fwd_bwd_packet_ratio": fwd / bwd if bwd else 0,
        "down_up_ratio": bwd / fwd if fwd else 0,
        "unique_src_ports": len(flow["src_ports"]),
        "unique_dst_ports": len(flow["dst_ports"]),
        "bytes": flow["bytes"],
        "avg_packet_size": flow["bytes"] / packets if packets else 0
    }

# =========================
# MAIN
# =========================
def main():
    parser = argparse.ArgumentParser(description="PCAP Feature Extractor for IDS Training")
    parser.add_argument("-f", "--file", required=True, help="PCAP file")
    parser.add_argument("-o", "--output", required=True, help="Output CSV")
    parser.add_argument("-a", "--attack", required=True, help="Attack type label")

    args = parser.parse_args()

    packets = rdpcap(args.file)
    flows = {}

    for pkt in packets:
        fid = get_flow_id(pkt)
        if fid is None:
            continue

        if fid not in flows:
            flows[fid] = {
                "packets": 0,
                "fwd": 0,
                "bwd": 0,
                "proto": pkt[IP].proto,
                "flags": defaultdict(int),
                "src_ports": set(),
                "dst_ports": set(),
                "bytes": 0,
                "src_ip": pkt[IP].src,
                "dst_port": pkt.dport if (TCP in pkt or UDP in pkt) else 0
            }

        flow = flows[fid]
        flow["packets"] += 1
        flow["bytes"] += len(pkt)

        if pkt[IP].src == flow["src_ip"]:
            flow["fwd"] += 1
        else:
            flow["bwd"] += 1

        if TCP in pkt or UDP in pkt:
            flow["src_ports"].add(pkt.sport)
            flow["dst_ports"].add(pkt.dport)

        if TCP in pkt:
            flags = pkt[TCP].flags
            flow["flags"]["FIN"] += bool(flags & 0x01)
            flow["flags"]["SYN"] += bool(flags & 0x02)
            flow["flags"]["RST"] += bool(flags & 0x04)
            flow["flags"]["PSH"] += bool(flags & 0x08)
            flow["flags"]["ACK"] += bool(flags & 0x10)
            flow["flags"]["URG"] += bool(flags & 0x20)

    # =========================
    # WRITE CSV
    # =========================
    with open(args.output, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FEATURES + ["attack_type"])
        writer.writeheader()

        for flow in flows.values():
            if flow["packets"] < MIN_PACKETS:
                continue

            row = extract_features(flow)
            row["attack_type"] = args.attack
            writer.writerow(row)

    print(f"[✓] Saved → {args.output}")
    print(f"[✓] Label → {args.attack}")

if __name__ == "__main__":
    main()
                                  
