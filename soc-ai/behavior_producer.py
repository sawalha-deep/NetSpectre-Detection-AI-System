import redis
import json
import time

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

def send_event(event):
    r.rpush("netspectre:events", json.dumps(event))

# مثال Alert
alert = {
    "source": "BehaviorAI_IDS",
    "timestamp": time.time(),
    "src_ip": "192.168.1.10",
    "dest_ip": "192.168.1.20",
    "verdict": "ATTACK",
    "probability": 0.96,
    "attack_hint": "Network Scan"
}

send_event(alert)
print("[+] Event sent to NetSpectre Queue")

