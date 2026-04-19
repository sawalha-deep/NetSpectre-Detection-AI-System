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
* 🌍 **Layer 7:** Deep learning inspection of HTTP & HTTPS traffic
* 🔐 Detection works even in **encrypted environments**

---

### 🤖 Hybrid AI Engine

* ⚡ **XGBoost Models:** Fast, interpretable detection of network anomalies
* 🧬 **Deep Learning (CNN):** Detection of obfuscated SQL Injection attacks
* 🧠 **Classification Model:**  To Classification types of attack
* ⚖️ Balanced approach between **speed, accuracy, and explainability**

* 🛡️ **SOC AI Agent:**

	**An intelligent assistant that:**

	- Explains alerts in human-readable language.
	- Suggests recommended response actions.
	- Supports interactive analyst chat.

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
* 🌍 Web Application Attacks
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
HTTP & HTTPSs://sourceforge.net/projects/metasploitable/



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
4. Generate Abnormal Traffic 
	🔴 Port Scanning (Reconnaissance)
	```bash
	nmap -sS <target-ip>
	```
	
---
## 🌍 Capturing Traffic – Application Layer (Layer 7)

This section focuses on capturing and analyzing **web application traffic (HTTP & HTTPS/HTTP & HTTPSS)** to detect attacks such as SQL Injection, XSS, and other application-layer threats.

### 🔧 Step 1: Setup Interception Proxy (Burp Suite)

Use :contentReference[oaicite:0]{index=0} to intercept and inspect web traffic:

1. Launch Burp Suite  
2. Go to **Proxy → Intercept → ON**  
3. Configure your browser proxy:
   - IP: `127.0.0.1`
   - Port: `8080`



### 🌐 Step 2: Configure Browser

- Open browser settings  
- Set manual proxy:
  - HTTP & HTTPS Proxy → `127.0.0.1:8080`  
- Install Burp CA Certificate (for HTTP & HTTPSS interception)



### 🎯 Step 3: Target a Vulnerable Web App

Use a vulnerable application such as:

- DVWA (Damn Vulnerable Web Application)  
- Mutillidae (on Metasploitable) 
- PortSwigger : HTTP & HTTPSs://portswigger.net/ 
- Tryhackme   : HTTP & HTTPSs://tryhackme.com/ 
- Owasp       : HTTP & HTTPSs://owasp.org/ 
- HackBox     : HTTP & HTTPSs://www.hackthebox.com/

👉 Example:
```bash
sqlmap -u "HTTP & HTTPS://<target-ip>/mutillidae/index.php?page=user-info.php" --batch
```
---

# 🧪 Data Extraction & Feature Engineering
NetSpectre uses a custom-built feature extraction engine to transform raw packet captures into structured data suitable for machine learning models such as XGBoost.

## A- Data Extraction – XGBoost Models

### First Model 🟥 Flow-Based Model
Analyzes network flows and protocol-level behavior:
- TCP flags (SYN, ACK, FIN)
- Packet rates and sizes
- Scan detection heuristics

#### ⚙️ How It Works

The extraction pipeline processes `.pcap` files and converts raw network traffic into **flow-based features** that represent behavioral patterns of network activity.

Each network flow is analyzed and transformed into a numerical feature vector used for training and detection.


#### ▶️ Run Feature Extraction

```bash
python extract_first_xgboost.py -f capture.pcap -o features.csv -l 1 -a SYN_SCAN
python extract_first_xgboost.py -f capture.pcap -o features.csv -l 2 -a SSH_BruteForce

```
### Second MODEL 🟦 Temporal Model
Analyzes traffic behavior over time windows:
- Packets per second
- Burstiness
- Inter-arrival time
- Active vs idle ratios

#### ▶️ Run Feature Extraction

```bash
python extract_behaviar.py -i capture.pcap -o temporal.csv -l 1
```

💡 Both models work together to provide accurate and robust detection across multiple attack types.
### Third Model — Classification Model 🟩 (Attack Type Classification)

Performs multi-class classification to identify the exact type of attack based on extracted flow features.

#### 🎯 Purpose

##### This model is designed for:

	- Classifying traffic into specific attack categories.
	- Providing clear outputs for SOC analysis.
	- Supporting decision-making with labeled predictions.
#### 🔍 Feature Scope

##### The model uses flow-based features such as:

	- Protocol and destination port
	- Packet counts (forward / backward)
	- TCP flag statistics (SYN, ACK, FIN, RST…)
	- Traffic direction ratios
	- Unique ports (scan indicators)
	- Total bytes and average packet size

#### Additionally, a service hint layer improves classification:

	- SSH → Port 22.
	- WEB → Ports 80, 443, 8080.
##### ▶️ Run Feature Extraction
```bash
python extract_class_features.py -f <file> -o <out.csv> -a <Attack-Type>
```

## B- Data Extraction – 🧬 Deep Learning (CNN Model)

NetSpectre leverages a Convolutional Neural Network (CNN) to detect SQL Injection attacks at the Application Layer (Layer 7) by performing deep semantic analysis of HTTP & HTTPS request payloads.

Unlike traditional rule-based systems, this approach enables the detection of obfuscated, encoded, and zero-day injection patterns through learned representations.

#### 🌐 Payload Sources (Attack Vectors)

The system extracts and analyzes payloads from multiple components of HTTP & HTTPS requests to ensure comprehensive coverage:

#### 🔎 Query → GET Attacks
Injection attempts embedded within URL parameters

Example:

/login.php?id=1' OR '1'='1
#### 📦 Body → POST Attacks
Malicious input submitted via forms or APIs

Example:

username=admin'--&password=123
#### 🍪 Cookie → Session-Based Attacks
Exploitation of session tokens and cookies

Example:

session=admin' OR '1'='1
#### 🧠 Advanced SQL Feature Engineering

To enhance detection accuracy, NetSpectre extracts a rich set of statistical and structural features from each payload:

- 📏 Payload length and parameter count.
- 🔢 Digit ratio and numerical patterns.
- 🔣 Special character distribution.
- 💬 Quote usage (', ").
- 🧾 SQL comment indicators (--, #, /* */).
- ⚙️ Operator frequency (=, <, >, +, -).
- 🔐 Encoding ratio (URL-encoded content %).
- 🧬 Shannon Entropy for randomness and obfuscation detection.

These features allow the system to identify anomalous and adversarial input patterns beyond simple signature matching.

#### 🧬 Token-Based Structural Analysis

Payloads are further decomposed into tokens to capture syntactic and semantic patterns:

- 🔤 Token count.
- 📏 Longest token length.
- 📊 Average token length.
- 🔍 Detection of suspicious keywords (e.g., OR, UNION, SELECT, DROP).

This layer enables the CNN model to understand contextual relationships within malicious inputs.

#### ⚙️ Burp Suite Integration

NetSpectre supports direct integration with Burp Suite for extracting real-world attack traffic from XML exports.

▶️ Run Extraction:
🔴 Attack Traffic.
```bash
python burbsute_to_CSV.py -f burp.xml -o out.csv -ex all
python burbsute_to_CSV.py -f burp.xml -o out.csv -ex cookie
```
```bash
python cnn_futers.py -f <PCAP File> -o out.csv 
```
🎯 Extraction Modes:
- query → Extract payloads from URL parameters (GET).
- body → Extract payloads from request body (POST).
- cookie → Extract session/cookie-based payloads.
- all → Full-spectrum extraction across all vectors 🔥.
🤖 Why CNN?
- 🧠 Learns deep patterns in payload structure (similar to NLP models).
- 🔍 Detects obfuscated and polymorphic SQL Injection attacks.
- ⚡ Effective against zero-day threats.
- 🎯 Significantly reduces reliance on static signatures.


🟢 Normal Data Extraction
```bash
python extract_normal.py -f <norma_file> -o normal_dataset.csv
```
⚖️ Why Separate Pipelines?

Using separate scripts is not a limitation — it’s actually best practice:

- 🎯 Ensures clean labeling (no mixed data).
- 🧠 Improves model learning (clear distinction).
- 📊 Reduces false positives.
- 🔍 Enables better feature distribution analysis.

🧪 Output Dataset

The final output is a structured dataset (CSV) containing:

- Engineered numerical features.
- Original payload (for traceability).
- Label (Attack / Normal).
- Attack type (e.g., SQL Injection).
---

# ⚙️ Traning Models
## ⚡ Training – Behavioral IDS Model (XGBoost + Optuna)

The Behavioral IDS Model is a high-performance machine learning component designed to detect malicious network activity based on flow-level behavior.

It performs **binary classification**:

- ✅ Normal Traffic  
- 🚨 Attack Traffic  

This model leverages **XGBoost** with **Optuna optimization** to achieve fast, accurate, and production-ready intrusion detection.

---

## * Training Pipeline Overview

The model follows a structured behavioral analysis pipeline:

### 📊 1. Feature Input (Flow-Based)

Extracted from network traffic (`.pcap`):

- Protocol type
- Packet counts (forward / backward)
- TCP flags (SYN, ACK, FIN, RST, etc.)
- Packet ratios (fwd/bwd, down/up)
- Unique ports
- Flow size (bytes)

These features represent **network behavior patterns**, not payload content.

---

### 🧹 2. Data Preprocessing

- Handles missing and invalid values
- Separates:
  - Features (`X`)
  - Labels (`y`) → `0 = Normal`, `1 = Attack`

---

### 📏 3. Feature Scaling

- Uses `StandardScaler`
- Improves probability stability and model convergence
- Critical for production inference

---

### ✂️ 4. Train / Test Split

- Stratified split to preserve class distribution
- Typically:
  - 75% Training
  - 25% Testing

---

### ⚖️ 5. Imbalance Handling

- Computes:

```python
scale_pos_weight = normal / attack
```


## 🧠 Training – Attack Classification Model (XGBoost + Optuna)

The Attack Classification Model is a multi-class machine learning component designed to classify detected attacks into specific categories such as:

- SQL Injection
- XSS
- Command Injection
- Brute Force
- Scanning Attacks

It uses **XGBoost** combined with **Optuna hyperparameter optimization** and **feature selection** to achieve high accuracy and strong generalization.

---

## * Training Pipeline Overview

The model follows a structured pipeline:

### 🧹 1. Data Preprocessing

- Removes missing values (`dropna`)
- Replaces infinite values with safe defaults
- Separates:
  - Features (X)
  - Target label (`attack_type`)

---

### 🔤 2. Label Encoding

- Converts attack types into numerical classes using `LabelEncoder`
- Enables multi-class classification

---

### ✂️ 3. Train / Validation Split

- Stratified split (preserves class distribution)
- 80% Training / 20% Validation

---

### 📏 4. Feature Scaling

- Applies `StandardScaler`
- Ensures stable model training and better convergence

---

### ⚖️ 5. Class Balancing

- Uses `compute_class_weight`
- Handles imbalance between attack types
- Applies weights during training

---

## 🚀 Hyperparameter Optimization (Optuna)

The model uses **Optuna** to automatically search for optimal parameters:

### 🔍 Tuned Parameters

- `n_estimators` (200 → 600)
- `max_depth` (4 → 12)
- `learning_rate` (0.01 → 0.2)
- `subsample`
- `colsample_bytree`
- `gamma`
- `min_child_weight`

### 🎯 Optimization Objective

- Metric: **Weighted F1-score**
- Ensures balanced performance across all attack classes

---

## 🔥 Feature Selection

After initial training:

- Extracts feature importance from XGBoost
- Keeps only features above threshold:

```python
FEATURE_IMPORTANCE_THRESHOLD = 0.01
```
## 🧬 Training – SQL Injection Deep Learning Model (CNN Hybrid)

The SQL Injection Detection Model is a deep learning–based component designed to identify obfuscated and advanced SQL injection attacks.

It combines:

- 🔢 Numerical features (statistical + structural)
- 🧵 Raw payload text (character-level analysis)

This hybrid approach enables detection of both known and unknown attack patterns.

---

##  Training Pipeline Overview

The model follows a dual-input deep learning architecture:

### 🔢 1. Numeric Features

Extracted from HTTP & HTTPS requests:

- Payload statistics (length, entropy, token count)
- Character ratios (special chars, quotes, operators)
- Network features (frame length, retransmission)
- HTTP & HTTPS structure (GET / POST, parameters)

---

### 🧵 2. Text Features (Payload Analysis)

- Uses character-level tokenization
- Processes raw payloads (GET, POST, Cookies)

Captures:

- Obfuscation (%27, encoding)
- SQL keywords
- Injection patterns



## 🧬 Model Architecture

A hybrid CNN model with two branches:

### 🔹 Numeric Branch
- Dense (64) + ReLU
- Dropout (0.4)

### 🔹 Text Branch (CNN)
- Embedding Layer
- Parallel Conv1D filters:
  - Kernel sizes: 3, 5, 7
- Global Max Pooling
- Feature concatenation

### 🔹 Fusion Layer
- Merge numeric + text features
- Dense (128) + ReLU
- Dropout (0.5)
- Output: Sigmoid (Binary Classification)

---

## ⚖️ Key Training Techniques

### ⚖️ Class Weighting
Handles imbalance between normal and attack traffic.

### 🔒 Hash-Based Dataset Split
- Prevents data leakage  
- Ensures the same payload does not appear in both train/test  

### ⏹️ Early Stopping
Stops training when validation stops improving.

### 🎯 Custom Threshold
- Uses **0.80** instead of default 0.5  
- Reduces false positives in SOC environments  

---

## ▶️ Run Training

```bash
python train_deep_cnn.py
```

---
## 🎥 Demo

▶️ Watch the full system demo:  
HTTP & HTTPSs://www.youtube.com/watch?v=GbtuoEiHKNM&list=PL31p22KO8YfjOR7V7Zzcue3DLjQdwASyP  

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
