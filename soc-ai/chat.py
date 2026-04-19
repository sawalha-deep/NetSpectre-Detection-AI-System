#!/usr/bin/env python3

import requests
import subprocess

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "netspectre-soc-ai"

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
WHITE = "\033[97m"
RESET = "\033[0m"
PURPLE = "\033[35m"
BG_RED = "\033[41m"

def soc_ai_banner():
    banner=f"""{PURPLE} 

    ░█▀█░█▀▀░▀█▀░█▀▀░█▀█░█▀▀░█▀▀░▀█▀░█▀▄░█▀▀░░░░░█▀█░▀█▀
    ░█░█░█▀▀░░█░░▀▀█░█▀▀░█▀▀░█░░░░█░░█▀▄░█▀▀░▄▄▄░█▀█░░█░
    ░▀░▀░▀▀▀░░▀░░▀▀▀░▀░░░▀▀▀░▀▀▀░░▀░░▀░▀░▀▀▀░░░░░▀░▀░▀▀▀                                                                                     
        {RESET} This Agent For Soc Analysis V1.0
    """                            
    subprocess.call("clear",shell=True)
    print(banner)

    print(f"[✅] NetSpectre {BLUE}SOC-AI{RESET} Agent started")
    hello_soc_ai()

    # ================= AI ANALYSIS =================
def hello_soc_ai():
        prompt = (
            "You are NetSpectre SOC AI Agent.\n"
            "Greet briefly in ONE short sentence.\n"
            "Do NOT use JSON.\n"
            "Sound professional and friendly."
        )

        try:
            response = requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=15
            )

            response.raise_for_status()

            msg = response.json().get("response", "").strip()

            # One-line clean SOC banner output
            print(f"[💬] {msg}\n")

        except Exception as e:
            print(f"{RED}[SOC AI INIT FAILED]{RESET} {e}")
            exit(1)

def check_connection():
    try:
        requests.get("https://www.google.com", timeout=3)
        return True
    except requests.RequestException:
        return False

if __name__ == "__main__":
    if check_connection():
        from online_soc_ai import soc_ai

        soc_ai.run()

    else:
        soc_ai_banner()
        


        while True:
            try:
                user = input(f"[{BLUE}NetSpectre{RESET}] > ")

                prompt = f"""
        You are NetSpectre SOC AI Agent.
        Respond like a senior SOC analyst.

        User: {user}
        """

                r = requests.post(
                    OLLAMA_URL,
                    json={
                        "model": MODEL,
                        "prompt": prompt,
                        "stream": False
                    },
                    timeout=60
                )

                print(f"\n[ 💬SOC-AI ]:{YELLOW}", r.json()["response"].strip(), f"{RESET}\n")

            except KeyboardInterrupt:
                print("\n[SOC CHAT] Exit")
                break

