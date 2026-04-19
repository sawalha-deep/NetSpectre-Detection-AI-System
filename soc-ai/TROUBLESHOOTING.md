# NetSpectre SOC AI Agent — Troubleshooting & Error Resolution Guide

This document provides practical guidance for using the NetSpectre SOC AI Agent and resolving common errors encountered during setup, runtime, and analysis. It is intended for students, researchers, and SOC engineers.

---

## 1. Purpose of This Guide

The goal of this guide is to:

* Help users correctly operate the NetSpectre SOC AI Agent
* Diagnose and resolve common system and runtime errors
* Clarify expected inputs and operating modes
* Explain how the SOC AI can assist during failures or misconfigurations

The SOC AI is capable of assisting with troubleshooting **when errors, logs, or failure messages are provided**.

---

## 2. How the SOC AI Helps With Errors

When you encounter an issue, the NetSpectre SOC AI can:

* Analyze error messages, stack traces, and logs
* Identify misconfigurations or missing dependencies
* Explain why a failure occurred
* Recommend corrective actions and best practices
* Distinguish between user errors, environment issues, and system limitations

To receive accurate help, always provide:

* The exact error message or log output
* The context (startup, live capture, model inference, etc.)
* The component involved (IDS, ML model, packet capture, dashboard)

---

## 3. Common Usage Issues & Solutions

### 3.1 No Alerts or Detections

**Possible Causes:**

* No traffic is being captured
* Incorrect network interface selected
* Detection engine not running

**Resolution:**

* Verify the network interface (e.g., eth0, wlan0, tun0)
* Confirm packet capture permissions (root / CAP_NET_RAW)
* Ensure IDS and analysis modules are active

---

### 3.2 False Positives or Excessive Alerts

**Possible Causes:**

* Overly aggressive detection thresholds
* Test traffic or scanning tools in the environment

**Resolution:**

* Review alert indicators and confidence scores
* Tune detection thresholds
* Use behavioral context to validate alerts

---

### 3.3 Model or Feature Errors

**Possible Causes:**

* Missing features in input data
* Mismatched dataset schema
* Corrupted or incompatible model file

**Resolution:**

* Verify feature names and order
* Ensure dataset matches training schema
* Reload or retrain the model if required

---

### 3.4 Permission or Capture Errors

**Possible Causes:**

* Insufficient privileges
* Restricted container or OS permissions

**Resolution:**

* Run the system with appropriate privileges
* Grant required capabilities (e.g., NET_RAW, NET_ADMIN)
* Validate container runtime settings if using Docker

---

### 3.5 JSON Output or Parsing Errors

**Possible Causes:**

* Invalid or incomplete input data
* Corrupted logs or malformed payloads

**Resolution:**

* Validate input format before analysis
* Provide complete logs or payloads
* Avoid partial or truncated data

---

## 4. AI-Generated Fix Plan (Step-by-Step Resolution)

When an error, failure, or abnormal behavior occurs, the NetSpectre SOC AI can generate a **structured Fix Plan** to guide the user step by step toward resolution.

### 4.1 What Is a Fix Plan?

A Fix Plan is a clear, ordered troubleshooting workflow produced by the SOC AI that:

* Identifies the root cause of the issue
* Breaks the solution into actionable steps
* Verifies each step before moving to the next
* Reduces trial-and-error debugging

### 4.2 When the AI Generates a Fix Plan

The SOC AI will generate a Fix Plan when:

* The user reports a runtime error or system failure
* Logs, stack traces, or error messages are provided
* A detection or analysis behaves unexpectedly
* A module fails to start or produces invalid output

This process occurs in **MODE 2 (Interactive SOC Chat)**.

### 4.3 Fix Plan Structure

A typical Fix Plan follows this structure:

1. **Problem Identification**

   * Summarize the observed error or failure

2. **Root Cause Analysis**

   * Identify the most likely technical cause

3. **Step-by-Step Resolution**

   * Step 1: Immediate checks (permissions, inputs, interfaces)
   * Step 2: Configuration validation
   * Step 3: Dependency and environment checks
   * Step 4: Module restart or reinitialization
   * Step 5: Verification and validation

4. **Expected Outcome**

   * Describe what success looks like

5. **Prevention Advice**

   * Recommend changes to avoid recurrence

### 4.4 Example Fix Plan Output

**Issue:** No alerts generated during live traffic capture

**Fix Plan:**

1. Verify the selected network interface is active and correct
2. Confirm packet capture permissions (root or NET_RAW capability)
3. Check that the IDS engine is running and not in standby mode
4. Validate that traffic is actually flowing on the interface
5. Restart the capture and confirm alert generation

---

## 5. Understanding Operating Modes During Errors

* **MODE 1 (Autonomous Security Analysis)**

  * Triggered when logs, alerts, packets, or structured data are provided
  * Outputs strict JSON only
  * Best for analyzing failures in detection or alert generation

* **MODE 2 (Interactive SOC Chat)**

  * Triggered when asking questions or describing problems
  * Best for troubleshooting, explanations, and guidance

When troubleshooting, MODE 2 is recommended unless raw logs are being analyzed.

---

## 5. Best Practices for Error Prevention

* Always validate input data before analysis
* Maintain consistent feature schemas
* Log system events and errors
* Test detection modules independently
* Keep documentation and version information updated

---

## 6. When to Escalate Issues

Escalate or review manually when:

* Errors persist after recommended fixes
* Behavior contradicts expected detection logic
* Data integrity is uncertain
* System limitations are reached

---

## 7. Version Compatibility

This troubleshooting guide applies to:

* **NetSpectre SOC AI Agent v1.0.0**

Future versions may introduce additional diagnostics and automated self-healing features.

---

## 8. Authorship

NetSpectre SOC AI Agent and its supporting documentation were designed and built by **Yanal Sawalha**.

---

End of Troubleshooting Guide

