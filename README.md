- What this setup is  
- Why it exists  
- How it works  
- How to start the server  
- How to run chat‑based commands  
- How all files fit together  


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
- “Poll run 1234 until it finishes”  
- “Download the report for run 1234”  

All directly from the chat window.

---

## **How the System Works (Simple Explanation)**

### **1. The SDK**
Inside the `sdk/` folder, we have:

- `sessionManager.js` → handles authentication to LRE  
- `lreClient.js` → wraps LRE REST APIs  
- `utils.js` → helper functions  

This SDK knows how to:

- authenticate  
- start runs  
- poll runs  
- download reports  
- fetch run details  

---

### **2. The Local Server (`agent.js`)**
This is the heart of the chat‑driven experience.

`agent.js` exposes simple endpoints like:

- `/runs` → list recent runs  
- `/run/:id` → get run details  
- `/start-run` → start a test  
- `/poll-run/:id` → wait until run finishes  
- `/report/:id` → download report  

Each endpoint returns **natural‑language responses**, so Copilot Chat can display them clearly.

This is what makes the experience feel like MCP.

---

### **3. Copilot Chat**
Copilot Chat acts as the “front end.”

You type natural language like:

> “Start test 180 instance 9.”

Copilot translates that into:

```
POST http://localhost:3000/start-run
```

The server runs the action, and Copilot shows the result in plain English.

---

## **Project Structure**

```
project/
│
├── agent.js                # Local server for chat-based commands
│
├── sdk/
│   ├── sessionManager.js   # Authentication + session handling
│   ├── lreClient.js        # LRE REST API wrapper
│   └── utils.js            # Helpers
│
├── commands/
│   └── commands.js         # Optional script-based testing (not required)
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

---

## **Using the Chat‑Based Commands**

Once the server is running, open **Copilot Chat** in VS Code and use natural language prompts.

Here are the most useful ones:

### **List recent runs**
> Show me the last 10 runs.

### **Start a test**
> Start test 180 instance 9 using my local LRE agent.

### **Poll a run**
> Poll run 1234 until it finishes.

### **Download a report**
> Download the report for run 1234.

### **Get run details**
> Show details for run 1234.

Copilot will call the correct endpoint and show the results directly in chat.

---

## **Why This Setup Exists**
LRE’s MCP Server is powerful but:

- requires installation  
- requires admin access  
- is not always available  
- is not customizable  

This project gives you **the same chat‑driven experience** using:

- a simple Node.js server  
- your own LRE credentials  
- natural‑language commands  
- Copilot Chat as the interface  

It is lightweight, flexible, and easy to maintain.

---

## **Who This Is For**
- QA engineers running LRE tests  
- Managers who want quick run summaries  
- Developers who want to automate LRE workflows  
- Anyone who prefers natural‑language commands over scripts  

---

## **Extending the System (Optional)**
The server can easily be extended with endpoints like:

- `/tests` → list tests  
- `/instances/:testId` → list test instances  
- `/failed-runs` → show failed runs  
- `/start-and-wait` → start + poll + download report  

These can be added anytime.

---

If you want, I can also generate:

- a **visual architecture diagram**  
- a **quick‑start cheat sheet**  
- a **manager‑friendly one‑page summary**  
- a **troubleshooting section**  

Just tell me what you want next.