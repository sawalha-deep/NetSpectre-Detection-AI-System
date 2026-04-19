#!/usr/bin/env python3

import redis
import json
import time
import requests
from datetime import datetime
import subprocess
# ========== COLORS ==========
RED = "\033[91m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
BLUE = "\033[94m"
RESET = "\033[0m"
PURPLE = "\033[35m"

def soc_ai_banner():
    banner=f"""{PURPLE} 

    ░█▀█░█▀▀░▀█▀░█▀▀░█▀█░█▀▀░█▀▀░▀█▀░█▀▄░█▀▀░░░░░█▀█░▀█▀
    ░█░█░█▀▀░░█░░▀▀█░█▀▀░█▀▀░█░░░░█░░█▀▄░█▀▀░▄▄▄░█▀█░░█░
    ░▀░▀░▀▀▀░░▀░░▀▀▀░▀░░░▀▀▀░▀▀▀░░▀░░▀░▀░▀▀▀░░░░░▀░▀░▀▀▀                                                                                     
        {RESET} This Agent For Soc Analysis V1.0
    """                            
    subprocess.call("clear",shell=True)
    print(banner)

class NetSpectreSOCConsumer:

    def __init__(self):
        soc_ai_banner()
        
        self.redis = redis.Redis(
            host="localhost",
            port=6379,
            decode_responses=True
        )

        self.QUEUE = "netspectre:events"

        
        self.OLLAMA_URL = "http://localhost:11434/api/generate"
        self.MODEL_NAME = "soc-ai"
        

        print(f"[✅] NetSpectre {BLUE}SOC-AI{RESET} Agent started")
        self.hello_soc_ai()

    # ================= AI ANALYSIS =================
    def hello_soc_ai(self):
        prompt = (
            "You are NetSpectre SOC AI Agent.\n"
            "Greet briefly in ONE short sentence.\n"
            "Do NOT use JSON.\n"
            "Sound professional and friendly."
        )

        try:
            response = requests.post(
                self.OLLAMA_URL,
                json={
                    "model": self.MODEL_NAME,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=60
            )

            response.raise_for_status()

            msg = response.json().get("response", "").strip()

            # One-line clean SOC banner output
            print(f"[💬] {msg}")

        except Exception as e:
            print(f"{RED}[SOC AI INIT FAILED]{RESET} {e}")
            exit(1)

    def analyze_with_soc_ai(self, data):
        """
        Send event to soc-ai (Ollama) and get SOC-grade analysis
        """

        prompt = f"""
You are NetSpectre SOC AI Agent.
You are a senior Security Operations Center analyst.

Analyze the following event and respond ONLY in valid JSON with:
- attack_type
- severity (low, medium, high, critical)
- explanation
- recommended_action

Event:
{json.dumps(data, indent=2)}
"""

        response = requests.post(
            self.OLLAMA_URL,
            json={
                "model": self.MODEL_NAME,
                "prompt": prompt,
                "stream": False
            },
            timeout=20
        )

        response.raise_for_status()

        raw_output = response.json().get("response", "").strip()

        # Try parsing JSON safely
        try:
            return json.loads(raw_output)
        except json.JSONDecodeError:
            return {
                "attack_type": "Unknown",
                "severity": "low",
                "explanation": raw_output,
                "recommended_action": "Manual investigation required"
            }

    # ================= SOC OUTPUT =================
    def print_alert(self, data):
        try:
            ai_result = self.analyze_with_soc_ai(data)
        except Exception as e:
            print(f"{RED}[SOC AI ERROR]{RESET} {e}")
            return

        severity = ai_result.get("severity", "low").lower()
        color = RED if severity in ("high", "critical") else YELLOW

        print(f"\n{color}🚨 SOC AI ALERT{RESET}")
        print("─" * 70)
        print(f" Time      : {datetime.fromtimestamp(data.get('timestamp', time.time()))}")
        print(f" Source    : {data.get('source', 'UNKNOWN')}")
        print(f" Agent     : {data.get('agent', 'NetSpectre SOC AI Agent')}")
        print("─" * 70)
        print(f" Attack    : {ai_result.get('attack_type')}")
        print(f" Severity  : {severity.upper()}")
        print("\n Explanation:")
        print(f"  {ai_result.get('explanation')}")
        print("\n Recommended Action:")
        print(f"  {ai_result.get('recommended_action')}")
        print("─" * 70)

    # ================= MAIN LOOP =================
    def run(self):
        while True:
            try:
                _, raw = self.redis.blpop(self.QUEUE)
                data = json.loads(raw)

                self.print_alert(data)

            except KeyboardInterrupt:
                print(f"\n{YELLOW}[SOC AI]{RESET} Shutting down...")
                break
            except Exception as e:
                print(f"{RED}[ERROR]{RESET} {e}")
                time.sleep(1)


# ================= ENTRY POINT =================
if __name__ == "__main__":
    NetSpectreSOCConsumer().run()
