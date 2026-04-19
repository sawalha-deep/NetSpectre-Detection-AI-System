#!/bin/bash

MODE="cli"   # default mode
INTERFACE="wlan0"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$BASE_DIR/config"
STATUS_FILE="$CONFIG_DIR/status.conf"
SQLi_model="$BASE_DIR/models/sql_inject/sqli_dl_model.h5"
Net_model="$BASE_DIR/models/scanning_models/ids_model.pkl"

SURICATA_FILE="/etc/suricata/suricata.yaml"
MODEL_FILE="$BASE_DIR/model.joblib"
RULE_DIR="$BASE_DIR/rules"

VENV_PATH="$BASE_DIR/venv"
PYTHON="$VENV_PATH/bin/python"

source "$(dirname "$0")/library/functions.sh"

 # ================== Paths ==================
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$BASE_DIR/config"
STATUS_FILE="$CONFIG_DIR/status.conf"
SQLi_model="$BASE_DIR/models/sql_inject/sqli_dl_model.h5"
Net_model="$BASE_DIR/models/scanning_models/ids_model.pkl"

SURICATA_FILE="/etc/suricata/suricata.yaml"
MODEL_FILE="$BASE_DIR/model.joblib"
RULE_DIR="$BASE_DIR/rules"

    # 🔥 Python venv (DO NOT source it)
VENV_PATH="$BASE_DIR/venv"
PYTHON="$VENV_PATH/bin/python"

SOC_AI_MODEL="llama3:8b"

# ================== Colors ==================
PURPLE="\e[35m"
GREEN="\e[92m"
RED="\e[91m"
YELLOW="\e[93m"
BLUE="\e[94m"
RESET="\e[0m"

usage() {
    echo -e "
NetSpectre – AI-Driven IDS Platform

Usage:
  netspectre [OPTIONS]

Options:
  -h, --help        Show this help message
  --cli             Run CLI IDS mode (default)
  -i, --interface   Network interface (default: wlan0)

  --web             Run User Interface
  --chat            Open SOC AI interactive chat
  --track           Traking IP Or Domain 

Tracking Options:
  -s                Silent Options
  --isp             Get Internet Provider 
  -l                Get Location lon&lat 
  --country         Get Country 
  --city            Get City 
  --mail            Get Mail OF Domain name 
  --domain          Get Domain name servece 
  -m                Get Map Location Url 
  --org             Get Orginization name 
  --all             Get All Info About ..


Examples:
  netspectre
  netspectre --cli --i wlan0
  netspectre --web --i wlan0
  netspectre --chat
  netspectre --track <ip/Domain> <options Traking>
"
    exit 0
}

check_system_requirements(){
    echo -e "[🔎] Checking system requirements..."
    sleep .3

    [ -f "$STATUS_FILE" ] && echo -e "\t[✅] Found 📁 Configuration File" || {
        echo -e "\t[❌] Not found 📁 Configuration File"
        exit 1
    }

    sleep .3
    [ -f "$SQLi_model" ] && echo -e "\t[✅] Found 🧠 SQLi-AI Model" || {
        echo -e "\t[❌] Not found 🧠 SQLi-AI Model"
        exit 1
    }

    sleep .3
    [ -f "$Net_model" ] && echo -e "\t[✅] Found 🧠 NetBehavior-AI Model" || {
        echo -e "\t[❌] Not found 🧠 NetBehavior-AI Model"
        exit 1
    }

    # ===================== SOC-Agent Model =====================
    if [[ -f "$MODEL_FILE" ]]; then
        echo -e "\t[✅] Found 🧠 SOC-AI Model"
        sleep .3
        echo "ML-AI = found" >> "$STATUS_FILE"
    else
        echo -e "\t[❌] NOT found 🧠 SOC-AI Model"
        echo "ML-AI = not-found" >> "$STATUS_FILE"
        exit 1
    fi

    sleep .3

 

    # ================== Interfaces ==================
    echo -e "\n[🔎] Network interfaces:"
    sleep .5

    echo "[network]" > "$STATUS_FILE"
    echo "" >> "$STATUS_FILE"
    echo "[icons]" >> "$STATUS_FILE"

    CONNECTED_IFACE=$(check_network_interfaces "$STATUS_FILE") || exit 1
    echo -e "[ℹ️ ] Connected interface:\n$CONNECTED_IFACE"

    # ================== Services ==================
    if check_running "suricata"; then
        sleep 0.5

        PARENT_PID=$(get_ppid "suricata")
        if [[ -n "$PARENT_PID" ]]; then
            echo -e "\n[PID]" >> "$STATUS_FILE"
            echo "SuricataProcess = $PARENT_PID" >> "$STATUS_FILE"
        fi

        echo -e "\n[service]" >> "$STATUS_FILE"
        echo "SuricataProcess = True" >> "$STATUS_FILE"

        if check_service_running "suricata"; then
            echo -e "[ℹ️ ] Suricata service 🛠️ active"
            echo "SuricataService = True" >> "$STATUS_FILE"
        else
            echo -e "[⚠️ ] Suricata 🛠️ running (manual mode)"
            echo "SuricataService = True" >> "$STATUS_FILE"
        fi
    else
        echo -e "[❌] Suricata not running"
        sleep .5
        echo -e "\n[service]" >> "$STATUS_FILE"
        echo "SuricataProcess = False" >> "$STATUS_FILE"
        echo "SuricataService = False" >> "$STATUS_FILE"
    fi

}

check_interface() {
    local iface="$1"

    if ! ip link show "$iface" >/dev/null 2>&1; then
        echo -e "[❌] Network interface NOT found: \e[91m$iface\e[0m"
        echo -e "[ℹ️ ] Available interfaces:"
        ip -o link show | awk -F': ' '{print "   - " $2}'
        exit 1
    fi
}



while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            ;;

        --cli)
            MODE="cli"
            shift
            ;;

        --web)
            MODE="web"
            shift
            ;;

        --chat)
            MODE="chat"
            shift
            ;;

        # 🔥 TRACK MODE WITH TARGET
        --track)
            MODE="traking"

            if [[ -z "$2" || "$2" == -* ]]; then
                echo "[❌] Missing IP/Domain after --track"
                exit 1
            fi

            TARGET="$2"
            shift 2
            ;;

        # Optional: --track=IP
        --track=*)
            MODE="traking"
            TARGET="${1#*=}"
            shift
            ;;

        -i|--interface)
            [[ -z "$2" || "$2" == -* ]] && {
                echo "[❌] Missing value for $1"
                exit 1
            }
            INTERFACE="$2"
            shift 2
            ;;

        # =========================
        # TRACKING OPTIONS
        # =========================
        -s)
            TRACK_SILENT=1
            shift
            ;;

        --isp)
            TRACK_ISP=1
            shift
            ;;

        -l)
            TRACK_LATLON=1
            shift
            ;;

        --country)
            TRACK_COUNTRY=1
            shift
            ;;

        --city)
            TRACK_CITY=1
            shift
            ;;

        --mail)
            TRACK_MAIL=1   # ✅ FIXED
            shift
            ;;

        --domain)
            TRACK_DOMAIN=1
            shift
            ;;

        -m)
            TRACK_MAP=1
            shift
            ;;

        --org)
            TRACK_ORG=1
            shift
            ;;

        --all)
            TRACK_ALL=1
            shift
            ;;

        *)
            echo "[❌] Unknown option: $1"
            usage
            ;;
    esac
done

# silent check
check_interface "$INTERFACE"    
if [[ "$MODE" == "cli" ]]; then

    source "$(dirname "$0")/library/functions.sh"

    set -Eeuo pipefail
    trap 'echo -e "\n[🟡] Exite Netspectre-IDS System"; exit 130' INT

 

   

    welcome
    check_system_requirements

    
    # ================== TMUX ==================
    echo -e "\n[🚀] Starting NetSpectre IDS..."
    read -r -p $'\e[93mPress Enter to continue...\e[0m'

    SESSION="netspectre"

    # Create session
    tmux new-session -d -s $SESSION

    # 🔥 Ctrl+C داخل tmux = kill session
    tmux bind-key -n C-c kill-session

    # Enable mouse
    tmux set-option -t $SESSION -g mouse on

    # ===== Pane 0 (LEFT) – Behavior AI (ROOT) ===== live_model.py -i wlan0 --web
    tmux send-keys -t $SESSION:0.0 \
    "sudo /home/kali/NetSpectre/venv/bin/python live_model.py -i $INTERFACE --$MODE" C-m

    # ===== Split right =====
    tmux split-window -h -t $SESSION:0

    # ===== Pane 1 (TOP RIGHT) – Suricata logs =====
    #tmux send-keys -t $SESSION:0.1 "tail -f suricata_out/eve.json" C-m
    #tmux send-keys -t $SESSION:0.1 "python soc-ai/soc_ai_consumer.py.back" C-m
    tmux send-keys -t $SESSION:0.1 "/home/kali/NetSpectre/venv/bin/python soc-ai/classattack.py --cli" C-m
    # ===== Split bottom right =====
    tmux split-window -v -t $SESSION:0.1

    # ===== Pane 2 (BOTTOM RIGHT) – SQLi AI =====
    tmux send-keys -t $SESSION:0.2 \
    "/home/kali/NetSpectre/venv/bin/mitmdump -s mitm_sqli_ai.py -p 9999 --quiet" C-m

    # Layout
    tmux select-layout -t $SESSION tiled

    # Attach
    tmux attach -t $SESSION

fi 

if [[ "$MODE" == "web" ]]; then
    set -Eeuo pipefail

    PIDS=()

    cleanup() {
        echo -e "\n[🟡] Exiting NetSpectre-IDS System"

        for pid in "${PIDS[@]}"; do
            if kill -0 "$pid" 2>/dev/null; then
                sudo kill -TERM "$pid" 2>/dev/null
            fi
        done

        exit 130
    }

    trap cleanup INT TERM EXIT

    welcome
    check_system_requirements


    # ===== Behavior AI =====
    sudo "$VENV_PATH/bin/python" live_model.py -i "$INTERFACE" --web &
    PIDS+=($!)

    # ===== SQLi MITM =====
    "$VENV_PATH/bin/mitmdump" -s mitm_sqli_Silent.py -p 9999 --quiet &
    PIDS+=($!)
    #wait
    sudo "$VENV_PATH/bin/python" soc-ai/classattack.py  --web &
    PIDS+=($!)
    
    echo -e "[🖥️ ] Starting NetSpectre UI..."
    echo -e "[🌐] \033[94mhttp://localhost:5000\033[0m"

    # ===== Streamlit (foreground) =====
    exec npm --prefix ui run dev > /dev/null 2>&1
fi

if [[ "$MODE" == "chat" ]]; then
    echo -e "[🤖] Starting NetSpectre SOC AI Chat..."
    exec "$PYTHON" soc-ai/chat.py
fi

# -----------------------------
# VALIDATION (CHECK ARGS)
# -----------------------------


if [[ "$MODE" == "traking" ]]; then
    
    if [[ -z "$TRACK_SILENT" ]]; then
        echo -e "[🔥] Starting NetSpectre Tracking Mode ..."
        welcome
    fi

    # ✅ VALIDATION FIRST
    if [[ -z "$TARGET" ]]; then
        echo "[!] Error: You must provide IP or Domain"
        exit 1
    fi

    if [[ $TRACK_ISP -eq 0 && $TRACK_LATLON -eq 0 && $TRACK_COUNTRY -eq 0 && \
          $TRACK_CITY -eq 0 && $TRACK_MAIL -eq 0 && $TRACK_DOMAIN -eq 0 && \
          $TRACK_MAP -eq 0 && $TRACK_ORG -eq 0 && $TRACK_ALL -eq 0 ]]; then
        "$VENV_PATH/bin/python" library/geoip.py -ip "$TARGET" --out
        exit 1
    fi

    ARGS=()

    [[ $TRACK_SILENT -eq 1 ]] && ARGS+=("-s")
    [[ $TRACK_MAP -eq 1 ]] && ARGS+=("-m")
    [[ $TRACK_ISP -eq 1 ]] && ARGS+=("--isp")
    [[ $TRACK_CITY -eq 1 ]] && ARGS+=("--city")
    [[ $TRACK_COUNTRY -eq 1 ]] && ARGS+=("--country")
    [[ $TRACK_MAIL -eq 1 ]] && ARGS+=("--mail")
    [[ $TRACK_DOMAIN -eq 1 ]] && ARGS+=("--dns")
    [[ $TRACK_ORG -eq 1 ]] && ARGS+=("--org")
    [[ $TRACK_ALL -eq 1 ]] && ARGS+=("--all")
    [[ $TRACK_LATLON -eq 1 ]] && ARGS+=("-l")

    "$VENV_PATH/bin/python" library/geoip.py -ip "$TARGET" "${ARGS[@]}"
fi