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

    if (/(?:get|show|fetch|download)\b.*\b(report|run)\b/.test(text) && runId && /\breport\b/.test(text)) {
        return { action: "getReport", runId };
    }

    if (/\b(report|download)\b.*\b(run)\b/.test(text) && runId) {
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
// GET /runs  → Natural-language summary of last 10 runs
// ------------------------------------------------------------
app.get("/runs", async (req, res) => {
    try {
        const client = await getAuthenticatedClient();
        const runs = await client.getRuns();

        if (!runs || runs.length === 0) {
            return res.json({
                message: "No runs found in this project.",
                count: 0,
                runs: []
            });
        }

        const last10 = runs.slice(0, 10);

        res.json({
            message: `Found ${runs.length} total runs. Showing the latest ${last10.length}.`,
            count: last10.length,
            runs: last10.map(r => ({
                id: r.ID,
                state: r.RunState,
                testId: r.TestID,
                instanceId: r.TestInstanceID,
                startTime: r.StartTime,
                endTime: r.EndTime
            }))
        });
    } catch (err) {
        console.error('GET /runs error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// GET /run/:id  → Natural-language summary of a single run
// ------------------------------------------------------------
app.get("/run/:id", async (req, res) => {
    try {
        const client = await getAuthenticatedClient();
        const details = await client.getRunDetails(req.params.id);

        if (!details) {
            return res.json({ message: `Run ${req.params.id} not found.` });
        }

        res.json({
            message: `Run ${details.ID} is currently in state: ${details.RunState}.`,
            run: {
                id: details.ID,
                state: details.RunState,
                testId: details.TestID,
                instanceId: details.TestInstanceID,
                startTime: details.StartTime,
                endTime: details.EndTime
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// POST /start-run  → Start a run and return run ID
// ------------------------------------------------------------
app.post("/start-run", async (req, res) => {
    try {
        const { testId, testInstanceId, hours, minutes } = req.body;

        const client = await getAuthenticatedClient();
        const result = await client.startRun({
            testId,
            testInstanceId,
            hours: hours || 0,
            minutes: minutes || 30
        });

        res.json({
            message: `Run started successfully. Run ID: ${result.ID}.`,
            runId: result.ID
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// GET /poll-run/:id  → Poll until finished, return final state
// ------------------------------------------------------------
app.get("/poll-run/:id", async (req, res) => {
    try {
        const client = await getAuthenticatedClient();
        const runId = req.params.id;

        const finalState = await client.pollRunUntilDone(runId, {
            intervalSec: 10,
            timeoutSec: 7200
        });

        res.json({
            message: `Run ${runId} has completed with final state: ${finalState}.`,
            runId,
            finalState
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// GET /report/:id  → Download HTML report and confirm path
// ------------------------------------------------------------
app.get("/report/:id", async (req, res) => {
    try {
        const client = await getAuthenticatedClient();
        const runId = req.params.id;

        const html = await client.findHtmlReportResult(runId);
        if (!html) {
            return res.json({
                message: `No HTML report found for run ${runId}.`
            });
        }

        const saved = await client.downloadReport(
            runId,
            html.ID,
            `LRE-Report-${runId}.zip`
        );

        res.json({
            message: `Report downloaded successfully for run ${runId}. Saved to ${saved}.`,
            savedTo: saved
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ------------------------------------------------------------
// Start the server
// ------------------------------------------------------------
app.listen(3000, () => {
    console.log("LRE Agent running on http://localhost:3000");
});
