#!/usr/bin/env python3
"""
PCAP → CSV (Temporal Features Only)
Aggregates traffic into fixed 5-second windows and extracts
time-based behavioral features for ML models.
"""

import argparse
import csv
from collections import defaultdict
from statistics import mean, stdev
from scapy.all import rdpcap, IP

WINDOW_SIZE = 5.0          # seconds
IDLE_THRESHOLD = 1.0       # seconds (gap separating active vs idle)


# ---------------- CLI ---------------- #

def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract temporal features from PCAP using Scapy"
    )
    parser.add_argument("-i", "--input", required=True, help="Input PCAP file")
    parser.add_argument("-o", "--output", required=True, help="Output CSV file")
    return parser.parse_args()


# ---------------- Feature Helpers ---------------- #

def compute_inter_arrival_times(timestamps):
    """Compute packet inter-arrival times within a window."""
    if len(timestamps) < 2:
        return []
    return [
        float(timestamps[i] - timestamps[i - 1])
        for i in range(1, len(timestamps))
    ]


def compute_activity_ratios(inter_arrivals):
    """
    Active vs idle time ratio based on inter-arrival gaps.
    Short gaps → active, long gaps → idle.
    """
    if not inter_arrivals:
        return 0.0, 0.0

    active_time = sum(t for t in inter_arrivals if t <= IDLE_THRESHOLD)
    idle_time = sum(t for t in inter_arrivals if t > IDLE_THRESHOLD)
    total_time = active_time + idle_time

    if total_time == 0:
        return 0.0, 0.0

    return active_time / total_time, idle_time / total_time


# ---------------- Window Feature Extraction ---------------- #

def extract_features(window_packets, window_start, window_end):
    """Extract temporal features from packets in one time window."""
    duration = window_end - window_start

    timestamps = sorted(float(pkt.time) for pkt in window_packets)
    packet_count = len(window_packets)
    byte_count = sum(len(pkt) for pkt in window_packets)

    # Flow counting (internal only; not exported)
    flows = set()
    for pkt in window_packets:
        if pkt.haslayer(IP):
            ip = pkt[IP]
            proto = ip.proto
            sport = pkt.sport if hasattr(pkt, "sport") else 0
            dport = pkt.dport if hasattr(pkt, "dport") else 0
            flows.add((ip.src, ip.dst, proto, sport, dport))

    inter_arrivals = compute_inter_arrival_times(timestamps)

    if inter_arrivals:
        mean_iat = mean(inter_arrivals)
        std_iat = stdev(inter_arrivals) if len(inter_arrivals) > 1 else 0.0
        min_iat = min(inter_arrivals)
        max_iat = max(inter_arrivals)

        # Burstiness: variability of timing (bounded [-1,1])
        burstiness = (
            (std_iat - mean_iat) / (std_iat + mean_iat)
            if (std_iat + mean_iat) > 0 else 0.0
        )

        # Coefficient of Variation
        cv = std_iat / mean_iat if mean_iat > 0 else 0.0

        active_ratio, idle_ratio = compute_activity_ratios(inter_arrivals)
    else:
        mean_iat = std_iat = min_iat = max_iat = 0.0
        burstiness = cv = active_ratio = idle_ratio = 0.0

    return {
        # Flow / Time counts
        "flow_count_per_window": len(flows),
        "flows_per_second": len(flows) / duration if duration > 0 else 0.0,

        # Rate-based features
        "packets_per_second": packet_count / duration if duration > 0 else 0.0,
        "bytes_per_second": byte_count / duration if duration > 0 else 0.0,

        # Inter-arrival timing
        "mean_inter_arrival_time": mean_iat,
        "std_inter_arrival_time": std_iat,
        "min_inter_arrival_time": min_iat,
        "max_inter_arrival_time": max_iat,

        # Temporal variability
        "burstiness": burstiness,
        "coefficient_of_variation": cv,

        # Activity ratios
        "active_time_ratio": active_ratio,
        "idle_time_ratio": idle_ratio,
    }


# ---------------- PCAP Processing ---------------- #

def process_pcap(input_pcap):
    packets = rdpcap(input_pcap)
    if not packets:
        return []

    start_time = float(packets[0].time)
    end_time = float(packets[-1].time)

    windows = defaultdict(list)
    for pkt in packets:
        window_index = int((float(pkt.time) - start_time) // WINDOW_SIZE)
        windows[window_index].append(pkt)

    results = []
    num_windows = int((end_time - start_time) // WINDOW_SIZE) + 1

    for w in range(num_windows):
        w_start = start_time + w * WINDOW_SIZE
        w_end = w_start + WINDOW_SIZE
        features = extract_features(windows.get(w, []), w_start, w_end)
        results.append(features)

    return results


# ---------------- CSV Output ---------------- #

def write_csv(output_file, rows):
    if not rows:
        return

    with open(output_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


# ---------------- Main ---------------- #

def main():
    args = parse_args()
    rows = process_pcap(args.input)
    write_csv(args.output, rows)


if __name__ == "__main__":
    main()

