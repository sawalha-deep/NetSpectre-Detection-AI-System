import configparser
import subprocess 
import os

import warnings

os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_FORCE_GPU_ALLOW_GROWTH"] = "false"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

warnings.filterwarnings("ignore")
import sys
import fnmatch
import signal
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences
import joblib, math, urllib.parse
import redis
import json
import time


######## Read Config file ##########
config_file="config/project.conf"
status_file="config/status.conf"
RED = GREEN = YELLOW = BLUE = CYAN = MAGENTA = WHITE = RESET =  ""
config = configparser.ConfigParser()
config.read(config_file)
status = configparser.ConfigParser()
status.optionxform = str 

status.read(status_file)

###Pathes############paths
BEH_MODEL= config.get("paths", "BEH_MODEL")
NET_MODEL= config.get("paths", "NET_MODEL")
EVE_JSON= config.get("paths", "EVE_JSON")
RULES_DIR= config.get("paths", "RULES_DIR")
STAGE2_MODEL=config.get("paths","stage2_bundle")
MODEL_SQLI     = config.get("paths","MODEL_SQLI")
SCALER_SQLI    = config.get("paths","SCALER_SQLI")
TOKENIZER_SQLI = config.get("paths","TOKENIZER_SQLI")
THRESHOLD_WARN_SCANN = config.get("paths","THRESHOLD_WARN_SCANN")
SCALER_FILE_SCANN = config.get("paths","SCALER_FILE_SCANN")



###AI-mdel###########ai
AI_THRESHOLD= config.getfloat("ai", "AI_THRESHOLD")
USE_SOC_AI= config.getboolean("ai", "USE_SOC_AI")
SOC_AI_MODEL= config.get("ai", "SOC_AI_MODEL")
BEH_THRESHOLD=config.getfloat("ai", "BEH_THRESHOLD")
SOC_AI_PROB_LIMIT= config.getfloat("ai", "SOC_AI_PROB_LIMIT")
DEDUP_WINDOW= config.getint("dedup", "DEDUP_WINDOW")
MODEL_FILE= config.get("ai", "MODEL_FILE")
MAX_LEN_SQLI = config.getint("ai", "MAX_LEN_SQLI")
THRESHOLD_BLOCK_SQLI = config.getfloat("ai", "THRESHOLD_BLOCK_SQLI")
THRESHOLD_WARN_SQLI  = config.getfloat("ai", "THRESHOLD_WARN_SQLI")
DEBUG_PAYLOAD = config.getboolean("ai","DEBUG_PAYLOAD")

AI_THRESHOLD_ATTACK =config.getfloat("ai", "AI_THRESHOLD_ATTACK")
AI_THRESHOLD_SUSPICIOUS = config.getfloat("ai", "AI_THRESHOLD_SUSPICIOUS")
WINDOW_SECONDS = config.getint("ai", "WINDOW_SECONDS")




#########Port-Scann#######
SCAN_WINDOW = config.getint("port_scann", "SCAN_WINDOW")
SCAN_THRESHOLD=config.getint("port_scann","SCAN_THRESHOLD")
PORT_SCAN_PORTS_THRESHOLD = config.getint("port_scann","PORT_SCAN_PORTS_THRESHOLD")
PORT_SCAN_SYN_THRESHOLD = config.getint("port_scann","PORT_SCAN_SYN_THRESHOLD")
PORT_SCAN_FLOWS_THRESHOLD = config.getint("port_scann","PORT_SCAN_FLOWS_THRESHOLD")
PACKET_SAMPLE_RATE = config.getint("port_scann","PACKET_SAMPLE_RATE") 


######color###########color
RED = config.get("color", "RED").encode().decode('unicode_escape')
GREEN = config.get("color", "GREEN").encode().decode('unicode_escape')
YELLOW = config.get("color", "YELLOW").encode().decode('unicode_escape')
BLUE = config.get("color", "BLUE").encode().decode('unicode_escape')
CYAN = config.get("color", "CYAN").encode().decode('unicode_escape')
MAGENTA = config.get("color", "MAGENTA").encode().decode('unicode_escape')
WHITE = config.get("color", "WHITE").encode().decode('unicode_escape')
RESET = config.get("color", "RESET").encode().decode('unicode_escape')
PURPLE    = config.get("color", "PURPLE").encode().decode('unicode_escape')
BG_RED  = config.get("color", "BG_RED").encode().decode('unicode_escape')
#########Text Style######text_style
BOLD = config.get("text_style", "BOLD").encode().decode('unicode_escape')
DIM = config.get("text_style", "DIM").encode().decode('unicode_escape')
UNDERLINE = config.get("text_style", "UNDERLINE").encode().decode('unicode_escape')
BLINK = config.get("text_style", "BLINK").encode().decode('unicode_escape')
REVERSE =  config.get("text_style", "REVERSE").encode().decode('unicode_escape')


###########################loadding-Model############

try:
    #MODEL     = load_model(MODEL_SQLI)
    #SCALER    = joblib.load(SCALER_SQLI)
    #TOKENIZER = joblib.load(TOKENIZER_SQLI)
    MODEL_Be = joblib.load(THRESHOLD_WARN_SCANN)
    SCALER_Be = joblib.load(SCALER_FILE_SCANN)
except Exception as e:
    error_msg(e)

#####config_file#############config_file
try:
    status_file   = config.get("config_file", "status_file").strip('"').strip("'")
    suricata_conf = config.get("config_file", "suricata_conf").strip('"').strip("'")
    log_dir       = config.get("config_file", "log_dir").strip('"').strip("'")
    source        = config.get("config_file", "source").strip('"').strip("'")
except Exception as e:
    error_msg(f"{e}")
#####status#############status_file
connected = []
SuricataProcess = status.getboolean("service", "SuricataProcess")
try:
    pid = status.getint("PID", "SuricataProcess")
except Exception:
    pass

try:
    connected = [
        iface for iface, state in status.items("network")
        if state.strip().lower() == "connected"
    ]
    


except Exception:
    pass


from datetime import datetime, UTC
import requests

class SendToUI:
    def __init__(self, endpoint=None, api_key=None, timeout=3):
        self.endpoint = endpoint
        self.api_key = api_key
        self.timeout = timeout

    def send(self, src_ip, dst_ip, attack_type, confidence, src_model, pred):
        if not self.endpoint:
            print("❌ UI endpoint not configured")
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


            return r.status_code in (200, 201)

        except Exception as e:
            print("❌ SendToUI error:", e)
            return False




def clear_queue():
    r = redis.Redis(host="localhost", port=6379)
    r.delete("netspectre:events")

clear_queue()
# ================= SOC AI PRODUCER =================



class SOCProducer:
    """
    Unified SOC Event Producer
    Used by all detection engines
    """

    def __init__(self, queue="netspectre:events"):
        self.queue = queue
        self.redis = redis.Redis(
            host="localhost",
            port=6379,
            decode_responses=True
        )

    def send(self, source, event):
        payload = {
            "agent": "NetSpectre SOC AI Agent",
            "source": source,
            "timestamp": time.time(),
            "event": event
        }
        self.redis.rpush(self.queue, json.dumps(payload))


class WEBProducer:
    """
    Unified NetSpectre Web / SOC Producer
    pred: 1 = attack, 0 = normal
    """

    def __init__(self, queue="netspectre:web", max_len=1000):
        self.queue = queue
        self.max_len = max_len
        self.redis = redis.Redis(
            host="localhost",
            port=6379,
            decode_responses=True
        )

    def send(
        self,
        src_ip,
        dst_ip,
        attack_type,
        confidence,
        src_model,
        pred
    ):
        payload = {
            "timestamp": time.time(),
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "attack_type": attack_type,
            "confidence": round(float(confidence), 4),
            "pred": int(pred),
            "src_model": src_model
        }

        pipe = self.redis.pipeline()

        pipe.rpush(self.queue, json.dumps(payload))

        pipe.ltrim(self.queue, -self.max_len, -1)

        pipe.execute()

def welcome():
    banner=f"""{PURPLE}
    ⠀⠀⠀⢀⠆⠀⢀⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⠀⠀⠀⠀⠀⢰⡀⠀⠰⡀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢠⡏⠀⢀⣾⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢷⡀⠀⢹⣄⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⣰⡟⠀⠀⣼⡇{RESET}⠀⠀⠀Net-Spectre{PURPLE}⠀⠀⠀⠀⠸⣧⠀⠀⢻⣆⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢠⣿⠁⠀⣸⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣇⠀⠈⣿⡆⠀⠀⠀⠀
⠀⠀⠀⠀⣾⡇⠀⢀⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⡀⠀⢸⣿⠀⠀⠀⠀
⠀⠀⠀⢸⣿⠀⠀⣸⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣇⠀⠀⣿⡇⠀⠀⠀
⠀⠀⠀⣿⣿⠀⠀⣿⣿⣧⣤⣤⣤⣤⣤⣤⡀⠀⣀⠀⠀⣀⠀⢀⣤⣤⣤⣤⣤⣤⣼⣿⣿⠀⠀⣿⣿⠀⠀⠀
⠀⠀⢸⣿⡏⠀⠀⠀⠙⢉⣉⣩⣴⣶⣤⣙⣿⣶⣯⣦⣴⣼⣷⣿⣋⣤⣶⣦⣍⣉⡉⠋⠀⠀⠀⢸⣿⡇⠀⠀
⠀⠀⢿⣿⣷⣤⣶⣶⠿⠿⠛⠋⣉⡉⠙⢛⣿⣿⣿⣿⣿⣿⣿⣿⡛⠛⢉⣉⠙⠛⠿⠿⣶⣶⣤⣾⣿⡿⠀⠀
⠀⠀⠀⠙⠻⠋⠉⠀⠀⠀⣠⣾⡿⠟⠛⣻⣿⣿⣿⣿⣿⣿⣿⣿⣟⠛⠻⢿⣷⣄⠀⠀⠀⠉⠙⠟⠋⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢀⣤⣾⠿⠋⢀⣠⣾⠟⢫⣿⣿⣿⣿⣿⣿⡍⠻⣷⣄⡀⠙⠿⣷⣤⡀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⣠⣴⡿⠛⠁⠀⢸⣿⣿⠋⠀⢸⣿⣿⣿⣿⣿⣿⡗⠀⠙⣿⣿⡇⠀⠈⠛⢿⣦⣄⠀⠀⠀⠀⠀
⢀⠀⣀⣴⣾⠟⠋⠀⠀⠀⠀⢸⣿⣿⠀⠀⢸⣿⣿⣿⣿⣿⣿⡇⠀⠀⣿⣿⡇⠀⠀⠀⠀⠙⠻⣷⣦⣀⠀⣀
⢸⣿⣿⠋⠁⠀⠀⠀⠀⠀⠀⢸⣿⣿⠀⠀⠈⣿⣿⣿⣿⣿⣿⠁⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠈⠙⣿⣿⡟
⢸⣿⡏⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⠀⠀⠀⢹⣿⣿⣿⣿⡏⠀⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⡇
⢸⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⠀⠀⠀⠀⢿⣿⣿⡿⠀⠀⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⣾⣿⡇
⠀⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⠀⠀⠀⠀⠈⠿⠿⠁⠀⠀⠀⠀⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀
⠀⢻⣿⡄⠀⠀⠀⠀⠀⠀⠀⠸⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⠇⠀⠀⠀⠀⠀⠀⠀⢀⣿⡟⠀
⠀⠘⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⠃⠀
⠀⠀⠸⣷⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⡟⠀⠀⠀⠀⠀⠀⠀⠀⣾⠏⠀⠀
⠀⠀⠀⢻⡆⠀⠀⠀⠀⠀⠀⠀⠸⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⠇⠀⠀⠀⠀⠀⠀⠀⢰⡟⠀⠀⠀
⠀⠀⠀⠀⢷⠀⠀⠀⠀⠀⠀⠀⠀⢿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡿⠀⠀⠀⠀⠀⠀⠀⠀⡾⠀⠀⠀⠀
⠀⠀⠀⠀⠈⢧⠀⠀⠀⠀⠀⠀⠀⠸⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⠇⠀⠀⠀⠀⠀⠀⠀⡸⠁⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⡆⠀⠀⠀⠀⠀⠀⠀⠀⢰⡟⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢳⠀⠀⠀⠀⠀⠀⠀⠀⡞⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠣⠀⠀⠀⠀⠀⠀⠜⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀{RESET}

    This FrameWrok For Analysis Network Using AI 3 Layers
    NetSpectre Version: {WHITE}2.O{RESET}⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀

    
    """
    
    subprocess.call("clear",shell=True)
    print(banner)

def sql_banner():
    banner=rf"""{PURPLE}
                                          {RESET}___{PURPLE}
                                         {RESET}__|__{PURPLE}
                                          {RESET}[{BG_RED}S{RESET}]{PURPLE}
  _________      .__  .___            __  {RESET}[{BG_RED}Q{RESET}]{PURPLE}          __  .__                   _____  .___ 
 /   _____/ _____|  | |   | ____     |__| {RESET}[{BG_RED}L{RESET}]{PURPLE}_   _____/  |_|__| ____   ____     /  _  \ |   | {RESET}[V1.0.0#stable]{PURPLE}
 \_____  \ / ____/  | |   |/    \    |  |/ __ \_/ ___\   __\  |/  _ \ /    \   /  /_\  \|   |
 /        < <_|  |  |_|   |   |  \   |  \  ___/\  \___|  | |  (  <_> )   |  \ /    |    \   |
/_______  /\__   |____/___|___|  /\__|  |\___  >\___  >__| |__|\____/|___|  / \____|__  /___|
        \/    |__|             \/\______| {RESET}[{BG_RED}A{RESET}]{PURPLE}\/     \/                    \/          \/      {RESET}Ai Sql-injection {PURPLE}
                                          {RESET}[{BG_RED}I{RESET}]
                                          [{BG_RED}*{RESET}]{PURPLE}  _SQL_AI_
                                           {RESET}V............
{RESET}                                                                                                            

  """                                                                                                           
                                                                                                             
    subprocess.call("clear",shell=True)
    print(banner)


def kill_proc(pid):
    
    
    try:
        # Get child processes
        children = subprocess.check_output(["pgrep", "-P", str(pid)]).decode().split()
    except subprocess.CalledProcessError:
        children = []

    try:
        # Recursively kill children
        for child_pid in children:
            kill_proc(int(child_pid))
    except Exception as e:
        pass

    # Kill the main process
    try:
        os.kill(pid, signal.SIGKILL)
        print(f"[✅] Suricata-Process {YELLOW}{pid}{RESET} Stopped")

    except ProcessLookupError:
        pass
    except PermissionError:
        pass
    except Exception as e:
        pass

    try:
        # Suppress pkill errors
        subprocess.call(["pkill", "-f", "suricata"], stderr=subprocess.DEVNULL)
    except Exception:
        pass








def print_connected_interfaces():
    try:
        if not connected:
            print(" - no connected interfaces")
        else:
            max_len = max(len(iface) for iface in connected)

            for iface in connected:
                icon = status.get("icons", iface)  #
                print(f"\t {BLUE}-{RESET} {iface.ljust(max_len)}  {icon}")

    except Exception:
        pass
    return connected
    
def get_connected_interfaces():
    try:
        if not connected:
            print(" - no connected interfaces")
        else:
            return connected

    except Exception:
        pass
    

    
def close():
    """Safely stop Suricata and exit the program."""
    print("\n[🔎] Checking Running Services :::")
    print_connected_interfaces()
    
    # Try to read PID from status file
    pid = read_pid_file()

    SuricataProcess = get_suricata_status()

    if SuricataProcess :

        stop_suricata()
    else:
        print(f"[✅] Suricata-Process {YELLOW}{pid if pid else 'N/A'}{RESET} Stopped")
    
    print(f"[{YELLOW}-{RESET}] Exit :: {YELLOW}IDS stopped ...{RESET}")
    sys.exit()

def get_suricata_status():
    status = configparser.ConfigParser()
    status.optionxform = str
    status.read(status_file)
    try:
        return status.getboolean("service", "SuricataProcess")
    except Exception:
        return False

def error_msg(msg):
    if msg == "exit": 
        close()


    elif msg:    
        print(f"[{RED}!{RESET}] Error-msg :: {RED}{msg}{RESET}")
    
    sys.exit()
    
def run_suricata(interface=None):
    global suricata_conf, log_dir

    if not interface:
        connected_ifaces = get_connected_interfaces()
        if connected_ifaces:
            interface = connected_ifaces[0]
        else:
            print(f"[❌] No connected interface found to run Suricata.")
            return

    os.makedirs(log_dir, exist_ok=True)  

    cmd = [
        "konsole",           
        "--hold",           
        "--title", "SURICATA",  
        "-e",                
        "sudo", "suricata",
        "-c", suricata_conf,
        "-i", "tun0",#interface
        "-l", log_dir
    ]

    try:
        proc = subprocess.Popen(cmd)
        print(f"[✅] Suricata started in new Konsole terminal on interface: {interface}")
        update_status_file(pid=proc.pid, running=True)
    except Exception as e:
        print(f"[❌] Failed to start Suricata in Konsole: {e}")


def read_pid_file():
    """Read the Suricata PID from status.conf"""
    status = configparser.ConfigParser()
    status.read(status_file)
    try:
        return status.getint("PID", "SuricataProcess")
    except Exception:
        return None

def update_status_file(pid=None, running=False):
   
    status = configparser.ConfigParser()
    status.optionxform = str  # يحافظ على حالة الأحرف
    status.read(status_file)

    if not status.has_section("PID"):
        status.add_section("PID")
    if not status.has_section("service"):
        status.add_section("service")

    if pid is not None:
        status.set("PID", "SuricataProcess", str(pid))
    else:
        status.set("PID", "SuricataProcess", "")

    status.set("service", "SuricataProcess", str(running))
    status.set("service", "SuricataService", str(running))

    with open(status_file, "w") as f:
        status.write(f)



def stop_suricata():
    """
    يوقف Suricata بالكامل باستخدام PID من status.conf
    """
    pid = read_pid_file()
    if not pid:
        print("[ℹ️] No Suricata PID found in status.conf")
        return

    kill_proc(pid)

    update_status_file(pid=None, running=False)
