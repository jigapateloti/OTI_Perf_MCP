# LRE Project

## Quick Start Guide for New Users

Follow these simple, step-by-step instructions to get the LRE Chat Command application running on your computer.

### Step 1: Install Visual Studio Code (VS Code)
1. Go to the official VS Code download website: [https://code.visualstudio.com/](https://code.visualstudio.com/Download)
2. Download the installer for your operating system (Windows, macOS, or Linux).
3. Run the installer and follow the prompt setup wizard:
   - Accept the license agreement.
   - Keep the default installation directory.
   - (Highly Recommended) Check all of the boxes on the **Additional Tasks** screen:
     - *Create a desktop icon*
     - *Add "Open with Code" action to Windows Explorer file context menu*
     - *Add "Open with Code" action to Windows Explorer directory context menu*
     - *Register Code as an editor for supported file types*
     - *Add to PATH (requires shell restart)*
4. Click **Install**, wait for completion, and click **Finish** to open VS Code.

### Step 2: Install Node.js
This application runs on Node.js, which needs to be installed on your system.
1. Download Node.js from the official website: [https://nodejs.org/](https://nodejs.org/) (Select the **LTS (Long Term Support)** version, e.g., 20.x or 22.x).
2. Run the installer and click **Next** through the setup wizard (make sure the option to "Add to PATH" is enabled, which it is by default).
3. Once the installation completes, restart VS Code to apply Node.js environmental paths.

### Step 3: Open the Project in VS Code
1. Open VS Code.
2. Select **File** > **Open Folder...** from the top menu, then browse to and pick the `LRE 26.1` workspace folder.
3. Open VS Code's integrated terminal (Select **Terminal** > **New Terminal** or press `Ctrl + \``).

### Step 4: Install Project Dependencies
In the VS Code terminal that you opened, run the following command to download and install all required Node.js packages (such as `express`, `axios`, and others listed in `package.json`):

```bash
npm install
```

### Step 5: Configure Environment Variables
You must configure your LRE connection details so the agent can authenticate.
1. Duplicate or copy the `.env.example` file and rename the new copy to `.env` in the root folder of this project.
2. Open the `.env` file and replace the placeholder credentials with your actual active LRE server parameters:

```env
LRE_BASE_URL=https://your-lre-server-url
LRE_USERNAME=your-username-key
LRE_PASSWORD=your-password-key

LRE_DOMAIN={DOMAIN_NAME}
LRE_PROJECT={PROJECT_NAME}
TENANT_ID={TENANT_ID}
```

*Note: The `.env` file contains sensitive information and is ignored by Git automatically (configured in `.gitignore`).*

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

### **1. Install Dependencies**
Open your VS Code terminal and install the project dependencies by running:

```bash
npm install
```

---

### **2. Configure `.env`**
Establish your environment configuration:
1. Copy `.env.example` and rename it to `.env` in the project root.
2. Open `.env` and configure your LRE server details:

```env
LRE_BASE_URL=https://your-lre-server
LRE_USERNAME=your-username
LRE_PASSWORD=your-password

LRE_DOMAIN=DEFAULT
LRE_PROJECT=CICD
TENANT_ID=6
```

---

### **3. Start the server**
Start the Node.js server with either of the following commands:

```bash
npm start
```
or 
```bash
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