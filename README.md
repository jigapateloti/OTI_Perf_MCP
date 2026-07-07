# LRE Project

## Environment variables

Add a `.env` file at the repository root with the following variables (replace values as appropriate):

```
LRE_BASE_URL=https://your-lre-server
LRE_USERNAME=your-username
LRE_PASSWORD=your-password

LRE_DOMAIN={DEFAULT}
LRE_PROJECT={PROJECT_NAME}
TENANT_ID={TENANT_ID}
```

Notes:
- Keep `.env` out of version control (add to `.gitignore`).
- `LRE_DOMAIN`, `LRE_PROJECT`, and `TENANT_ID` are used by the SDK to scope requests to the correct domain/project/tenant.

---

# 📘 **LRE Chat‑Driven Automation – README**

## **Overview**
This project provides a **chat‑driven automation layer** for Micro Focus LoadRunner Enterprise (LRE).  
It allows you to run LRE operations using **simple natural‑language commands** inside Copilot Chat, without manually writing scripts or navigating the LRE UI.

The system behaves similarly to the **MCP Chat Window**, but without requiring the MCP Server.  
Instead, it uses a **lightweight local Node.js server** that exposes a few clean endpoints.

This lets you do things like:

- “Show me the last 10 runs”  
- “Start test 180 instance 9”  
- “Check load generator status”
- “Verify my directory scripts”
- “List test catalogs”
- “Simulate test run cycles on empty workspaces”
- “Download the report for run 1234”  
- “Get trend reports” / “Simulate trend reports”

All directly from your browser-based prompt panel.

---

## **How the System Works (Simple Explanation)**

### **1. The SDK**
Inside the `sdk/` folder, we have:

- `sessionManager.js` → handles authentication to LRE  
- `lreClient.js` → wraps LRE REST APIs, diagnostics, resources, and trend calculations  
- `commandParser.js` → pure helper module matching and parsing inputs  
- `commandHandlers.js` → execution handlers validating arguments and invoking API methods  
- `simulatedState.js` → manages local mock database models for runs and trend reports  
- `utils.js` → helper functions  

This SDK knows how to:

- authenticate and capture secure LWSSO cookies (using concurrent request-deduplication to prevent rate limits)
- start, poll, and fetch run details  
- download zip-compressed html report packages asynchronously
- manage and calculate LRE Trend Reports on demand
- discover load generators, scripts, and configured test profiles  

---

### **2. The Local Server (`agent.js`)**
This is the heart of the chat‑driven experience.

`agent.js` serves a dashboard and exposes a unified command parser endpoint:

- `/command` → interprets natural-language commands and runs clean execution handlers from the SDK state modules which perform non-blocking actions.

---

### **3. Browser Chat UI**
The Web Browser acts as the “front end.”

You open the Local UI in your browser at `http://localhost:3000`. You can select, copy, or type natural language like:

> “Start test 180 instance 9” or “simulate trend reports”

The browser UI sends this to the local server, executes the command, and prints the visual formatted response back to you.

---

## **Project Structure**

```
project/
│
├── agent.js                # Local server and routing configurations
│
├── sdk/
│   ├── commandHandlers.js  # Clean validation and execution routes
│   ├── commandParser.js    # Decoupled NLP regex parsing patterns
│   ├── lreClient.js        # Optimized LRE REST API wrapper (non-blocking, deduplicated concurrent requests)
│   ├── sessionManager.js   # Authentication + session handling
│   ├── simulatedState.js   # In-memory mock database models
│   └── utils.js            # Helpers
│
├── public/
│   └── index.html          # Web-based Chat Command UI with quick-copy presets representing Trend reports and standard workflows
│
├── package.json
└── .env                    # LRE credentials + base URL
```

---

## **Setup Instructions**

### **1. Install dependencies**
Run this once:

```
npm install
```

---

### **2. Configure `.env`**
Your `.env` file should contain:

```
LRE_BASE_URL=https://your-lre-server
LRE_USERNAME=your-username
LRE_PASSWORD=your-password

Alternatively copy the provided `.env.example` and edit the values. The repository includes a `.env.example` listing all supported keys (e.g. `LRE_BASE_URL`, `LRE_DOMAIN`, `LRE_PROJECT`, `TENANT_ID`, `LRE_USERNAME`, `LRE_PASSWORD`).
```

---

### **3. Start the server**
Run:

```
node agent.js
```

You should see:

```
LRE Agent running on http://localhost:3000
```

Leave this running.

Tip: you can add an npm script to `package.json` to start the server more conveniently:

```
"scripts": {
	"start": "node agent.js"
}
```

Security note: for convenience during development the project may set `NODE_TLS_REJECT_UNAUTHORIZED=0` to accept self-signed certs when contacting `LRE_BASE_URL`. This is insecure for production — use valid certificates or a secure tunnel instead.

---

## **Using the Chat‑Based Commands**

Once the server is running, open **`http://localhost:3000`** in your web browser.

You can type commands directly, or click the **Copy** button beside the preset templates to load them into the command field instantly.

Supported commands include:

### **LRE Diagnostics & Infrastructure (Live APIs)**
- `get project info` — live connectivity audit fetching status, ID, Name, and configurations.
- `get timeslots` — displays physical reservation timeslots and scheduling history.
- `get hosts` (or `check load generators` / `lgs status`) — checks availability and configuration status of load generators.
- `get scripts` — verifies scripts registered in your LRE repository.
- `get tests` — lists active test configuration models on the server.

### **Interactive PoC Simulation Workflow (Demo Mode)**
- `simulate run testId 180 testInstanceId 9` — starts a simulated run (created virtual run ID `77701`).
- `simulate poll 77701` — steps through status progression (*Initializing* -> *Running* -> *Collate And Analyze* -> *Finished*).
- `simulate report 77701` — triggers a mock HTML reports downloader saving simulated execution parameters package.

### **Trend Reports Management (Live & Simulation)**
- `simulate trend reports` (or `simulate trend report list`) — views simulated trend reports database.
- `simulate create trend report Benchmark Q3` — registers a new simulated draft trend sheet.
- `simulate calculate trend report 3001` — triggers mock trend regressions calculations.
- `get trend reports` — lists real trend reports configured inside your active LRE project.
- `get trend report 3001` — views live details and associated runs for the trend configuration.
- `create trend report Performance Baseline` — specifies a new trend report config.
- `delete trend report 3001` — removes a trend configuration.
- `associate run 77701 to trend report 3001` — links test iterations into the trend calculation sheet.
- `disassociate run 77701 from trend report 3001` — detaches execution ranges form trends analysis.
- `calculate trend report 3001` — triggers LRE servers to generate and render new trend graphs.

Downloads: report zips (real or simulated) are saved to the current working directory where `node agent.js` is run. Check the console output for the exact saved path.

### **Test Runs Control (Live APIs)**
- `get runs` — fetches standard LRE project run records.
- `start run testId 456 testInstanceId 789` — schedules a live test run on the server.
- `poll run 1234` — waits on a real physical execution status until done.
- `get report 1234` — locates and extracts a real HTML performance metrics zip packet.
- `get run 1234` — reads real-time resource allocations, state details, and run dates.

---

## **Why This Setup Exists**
Instead of installing an external MCP client extension or routing cloud traffic to your host, this project gives you **the same lightweight chat‑driven experience** using:

- a clean, modular, and optimized local Node.js server  
- your own secure custom `.env` credentials  
- direct local browser execution  

It is secure, fast, and easy to maintain.

---

## **Who This Is For**
- QA engineers running LRE tests  
- Managers who want quick run summaries  
- Developers who want to automate LRE workflows  
- Anyone who prefers natural‑language commands over trends/test scripts  

---

## **Extending the System (Optional)**
The server can easily be extended with targets like:

- `stop run <id>` → stop/abort an active run.
- `delete run <id>` → delete execution history.


---