// agent.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { getAuthenticatedClient } = require("./sdk/sessionManager");
const { parseCommand } = require("./sdk/commandParser");
const { handleCommand } = require("./sdk/commandHandlers");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------------
// POST /command → Interpret a natural-language prompt and execute it
// ------------------------------------------------------------
app.post("/command", async (req, res) => {
    try {
        const prompt = req.body.prompt;
        const parsed = parseCommand(prompt);

        if (!parsed) {
            return res.status(400).json({
                success: false,
                message: "Could not understand the command. Try: get runs, get run <id>, start run <testId> <instanceId>, poll run <id>, get report <id>."
            });
        }

        const client = await getAuthenticatedClient();
        const result = await handleCommand(client, parsed);

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('POST /command error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ------------------------------------------------------------
// Start the server & Keep Session Hydrated (optimized to 60s check)
// ------------------------------------------------------------
app.listen(3000, async () => {
    console.log("LRE Agent running on http://localhost:3000");

    // Perform background authentication on startup
    try {
        console.log("Initializing startup background authentication with LRE...");
        await getAuthenticatedClient();
        console.log("LRE Startup authentication completed successfully.");
    } catch (err) {
        console.warn("LRE Startup authentication warning:", err.message);
    }

    // Keep session hydrated and print status logs every 60 seconds
    setInterval(async () => {
        const timestamp = new Date().toISOString();
        try {
            console.log(`[${timestamp}] 🔄 Background check: Verifying LRE authentication and connection...`);
            const client = await getAuthenticatedClient();
            
            // Fetch standard runs to verify the cookie is alive and valid
            const runs = await client.getRuns();
            const runsCount = Array.isArray(runs) ? runs.length : 0;
            
            console.log(`[${timestamp}] ✅ Auth OK | Session is hydrated and healthy. Current LRE Project Runs: ${runsCount}`);
        } catch (err) {
            console.error(`[${timestamp}] ❌ Background Auth Check Failed: ${err.message}`);
            if (err.response) {
                console.error(`[${timestamp}] ⚠️ Details: HTTP ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            }
        }
    }, 60 * 1000);
});
