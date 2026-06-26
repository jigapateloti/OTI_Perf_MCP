// agent.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { getAuthenticatedClient } = require("./sdk/sessionManager");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

function parseCommand(prompt) {
    const text = (prompt || "").trim().toLowerCase();
    if (!text) return null;

    const numbers = (text.match(/\d+/g) || []).map(Number);
    const runId = numbers.length > 0 ? numbers[0] : null;
    const testIdMatch = text.match(/test\s*id\s*[:=]?\s*(\d+)/) || text.match(/test\s*[:=]?\s*(\d+)/);
    const instanceIdMatch = text.match(/(?:test\s*instance\s*id|instance\s*id|instance)\s*[:=]?\s*(\d+)/);
    const hoursMatch = text.match(/(\d+)\s*(?:hours|hrs)/);
    const minutesMatch = text.match(/(\d+)\s*(?:minutes|mins)/);
    const countMatch = text.match(/(?:last|recent|top)\s*(\d+)\s*runs?/);

    // Diagnostics / System Discovery
    if (/\bhosts?\b|\bload\s*generators?\b|\blgs?\b/.test(text)) {
        return { action: "getHosts" };
    }

    if (/\bscripts?\b/.test(text)) {
        return { action: "getScripts" };
    }

    if (/\btests?\b/.test(text) && !/\b(run|start|launch)\b/.test(text)) {
        return { action: "getTests" };
    }

    if (/(?:get|show|fetch|download)\b.*\b(report|run)\b/.test(text) && runId && /\breport\b/.test(text)) {
        return { action: "getReport", runId };
    }

    if (/\b(poll|wait|status|check)\b/.test(text) && /\brun\b/.test(text) && runId) {
        return { action: "pollRun", runId };
    }

    if (/\b(start|launch)\b/.test(text) && /\b(run|test)\b/.test(text)) {
        const testId = testIdMatch ? Number(testIdMatch[1]) : numbers[0] || null;
        const instanceId = instanceIdMatch ? Number(instanceIdMatch[1]) : numbers[1] || numbers[0] || null;
        if (testId && instanceId) {
            return {
                action: "startRun",
                testId,
                testInstanceId: instanceId,
                hours: hoursMatch ? Number(hoursMatch[1]) : 0,
                minutes: minutesMatch ? Number(minutesMatch[1]) : 30
            };
        }
    }

    if (/\b(get|show|fetch)\b/.test(text) && /\brun\b/.test(text) && runId && !/\b(report|download)\b/.test(text) && !/\b(start|launch|poll|wait|status)\b/.test(text)) {
        return { action: "getRunDetails", runId };
    }

    if (/\b(get|show|fetch|list)\b/.test(text) && /\brun(s)?\b/.test(text) && !/\b(report|download)\b/.test(text) && !/\b(start|launch|poll|wait|status)\b/.test(text)) {
        return { action: "getRuns", count: countMatch ? Number(countMatch[1]) : 10 };
    }

    return null;
}

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
        let result;

        switch (parsed.action) {
            case "getHosts": {
                const hosts = await client.getHosts();
                result = {
                    message: Array.isArray(hosts) 
                        ? `Found ${hosts.length} load generators configured in your project.` 
                        : "Fetch load generators response completed successfully.",
                    hosts
                };
                break;
            }

            case "getScripts": {
                const scripts = await client.getScripts();
                result = {
                    message: Array.isArray(scripts) 
                        ? `Found ${scripts.length} script paths registered in your project repository.` 
                        : "Fetch scripts response completed successfully.",
                    scripts
                };
                break;
            }

            case "getTests": {
                const tests = await client.getTests();
                result = {
                    message: Array.isArray(tests) 
                        ? `Found ${tests.length} test configurations defined on the server.` 
                        : "Fetch tests response completed successfully.",
                    tests
                };
                break;
            }

            case "getRuns": {
                const runs = await client.getRuns();
                const last10 = runs.slice(0, 10);
                result = {
                    message: `Found ${runs.length} total runs. Showing the latest ${last10.length}.`,
                    runs: last10.map(r => ({
                        id: r.ID,
                        state: r.RunState,
                        testId: r.TestID,
                        instanceId: r.TestInstanceID,
                        startTime: r.StartTime,
                        endTime: r.EndTime
                    }))
                };
                break;
            }

            case "getRunDetails": {
                const details = await client.getRunDetails(parsed.runId);
                if (!details) {
                    result = { message: `Run ${parsed.runId} not found.` };
                    break;
                }
                result = {
                    message: `Run ${details.ID} is currently in state: ${details.RunState}.`,
                    run: {
                        id: details.ID,
                        state: details.RunState,
                        testId: details.TestID,
                        instanceId: details.TestInstanceID,
                        startTime: details.StartTime,
                        endTime: details.EndTime
                    }
                };
                break;
            }

            case "startRun": {
                const started = await client.startRun({
                    testId: parsed.testId,
                    testInstanceId: parsed.testInstanceId,
                    hours: parsed.hours,
                    minutes: parsed.minutes
                });
                result = {
                    message: `Run started successfully. Run ID: ${started.ID}.`,
                    runId: started.ID
                };
                break;
            }

            case "pollRun": {
                const finalState = await client.pollRunUntilDone(parsed.runId, {
                    intervalSec: 10,
                    timeoutSec: 7200
                });
                result = {
                    message: `Run ${parsed.runId} has completed with final state: ${finalState}.`,
                    runId: parsed.runId,
                    finalState
                };
                break;
            }

            case "getReport": {
                const html = await client.findHtmlReportResult(parsed.runId);
                if (!html) {
                    result = { message: `No HTML report found for run ${parsed.runId}.` };
                    break;
                }
                const saved = await client.downloadReport(parsed.runId, html.ID, `LRE-Report-${parsed.runId}.zip`);
                result = {
                    message: `Report downloaded successfully for run ${parsed.runId}. Saved to ${saved}.`,
                    savedTo: saved
                };
                break;
            }

            default:
                result = { message: "Unhandled action." };
        }

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('POST /command error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ------------------------------------------------------------
// Start the server & Keep Session Hydrated
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

    // Keep session hydrated and print status logs every 5 seconds
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
    }, 5 * 1000);
});
