<p align="center">
  <img src="assets/banner.png" alt="NetSpectre Banner" width="100%" />
</p>


# 🧠 NetSpectre – AI-Driven Cyber Defense & SOC Intelligence Platform

NetSpectre is a next-generation **AI-powered cybersecurity platform** designed to redefine how modern intrusion detection systems operate in complex, high-speed, and encrypted environments.

Unlike traditional IDS solutions that rely on static signatures, NetSpectre introduces a fully **intelligent, behavior-driven, and multi-layered detection framework** capable of identifying both known and **zero-day threats** with high precision.

---

## 🚀 Core Capabilities

### 🔍 Multi-Layer Detection

* 🌐 **Layer 2/3:** Behavioral anomaly detection using flow-based analysis
* 🌍 **Layer 7:** Deep learning inspection of HTTP traffic
* 🔐 Detection works even in **encrypted environments**

---

### 🤖 Hybrid AI Engine

* ⚡ **XGBoost Models:** Fast, interpretable detection of network anomalies
* 🧬 **Deep Learning (CNN):** Detection of obfuscated SQL Injection attacks
* ⚖️ Balanced approach between **speed, accuracy, and explainability**

---

### ⚡ Event-Driven Architecture

* 📡 Central **Message Queue** for asynchronous processing
* 🔗 Decouples detection from analysis
* 🧱 Highly **scalable, modular, and fault-tolerant**

---

### 🧠 SOC AI Agent

* 🔄 Cross-layer correlation (L2/L3 + L7)
* ⏱️ Temporal and behavioral analysis
* 💬 Human-readable explanations
* 🎯 Reduces false positives & alert fatigue

---

### 📊 Visualization & Monitoring

* 🖥️ Real-time dashboard (React + TypeScript)
* 📈 Interactive threat analytics & timelines
* 🗂️ Integrated with OpenSearch for logging & forensics

---

## 🏗️ Architecture Overview

* 📥 **Traffic Acquisition Layer** → Packet capture & flow extraction
* 🤖 **AI Detection Layer** → ML + DL models
* 📡 **Message Queue Layer** → Event-driven pipeline
* 🧠 **SOC AI Agent** → Intelligent analysis & reasoning
* 📊 **Visualization Layer** → Monitoring & incident response

---

## 🛡️ Detected Threats

* 🧭 Port Scanning & Reconnaissance
* 🌊 SYN Flood & Connection Abuse
* 🔁 Lateral Movement
* 💉 SQL Injection (including obfuscated payloads)
* ⚠️ Behavioral anomalies & zero-day indicators

---

## 🧪 Why NetSpectre?

* 🧠 Moves beyond signature-based detection
* 🔍 Detects attacks missed by traditional IDS
* 🔐 Works under encrypted traffic conditions
* ⚡ Real-time, scalable, and AI-driven
* 🎯 Designed for modern SOC environments

---

## 🧩 Technologies

* 🐍 Python (Scapy, ML/DL frameworks)
* 🌲 XGBoost (Machine Learning)
* 🧬 CNN (Deep Learning)
* ⚡ FastAPI (Backend APIs)
* ⚛️ React + TypeScript (Frontend)
* 🔎 OpenSearch (Logging & Forensics)

---

## 🎯 Vision

NetSpectre represents a shift from **traditional IDS → intelligent security platforms**.

It doesn’t just detect attacks…
👉 It **understands**, **explains**, and **supports decision-making**.

---

💡 Developed as a Graduation Project in Network Information Security
🚀 Designed for real-world cybersecurity challenges

## 📦 Requirements

To run NetSpectre, make sure you have the following installed:

### 🖥️ System
- Linux (Recommended: Kali Linux / Ubuntu)
- Python 3.8+

### 🧠 Python Libraries
- scapy
- numpy
- pandas
- scikit-learn
- xgboost
- tensorflow / pytorch
- fastapi
- uvicorn

### 🔧 Optional Tools
- nmap (for testing)
- sqlmap (for SQL injection simulation)
- Wireshark (for traffic analysis)

## 📥 Capturing Traffic Network L(2/3)

### 🔧 Step 1: Prepare the Lab Environment

To generate realistic attack traffic, set up a vulnerable environment:

- 🐧 Attacker Machine: Kali Linux  
- 🎯 Target Machine: Metasploitable2  

👉 You can download Metasploitable from:
https://sourceforge.net/projects/metasploitable/



### 🌐 Step 2: Configure Network (Kali ↔ Metasploitable)

1. Open your VM settings (VirtualBox / VMware)  
2. Set both machines to the same network:
	   - **Host-Only Adapter** (recommended)  
	   - or **NAT Network**

3. Verify connectivity:

	```bash
	ping <metasploitable-ip>
	```
	### 🔍 Step 3: Capture Network Traffic (Layer 2/3)
	```bash
	sudo tcpdump -i <interface> -w capture.pcap
	```
---
## 🎥 Demo

▶️ Watch the full system demo:  
https://www.youtube.com/watch?v=GbtuoEiHKNM&list=PL31p22KO8YfjOR7V7Zzcue3DLjQdwASyP  

<div align="center">

<img src="assets/demo-qr.png" width="220"/>

**📱 Scan to watch instantly**

</div>

💡 This demo showcases:

- 🚀 Real-time attack detection and alert generation  
- 🤖 AI-powered threat classification and anomaly detection  
- 🧠 SOC-level intelligent analysis and decision support  
- 🔄 Cross-layer correlation (L2/L3 + L7 attacks)  
- ⚡ Detection of stealth and obfuscated attacks  
- 🔐 Analysis of traffic in encrypted environments  
- 📊 Interactive dashboard with live threat visualization  
- 🧭 Behavioral analysis of network traffic patterns  
- 💬 Human-readable explanations for detected threats  
- 🎯 Reduced false positives using AI correlation  
- 🔎 Deep inspection of application-layer attacks (e.g., SQL Injection)  
