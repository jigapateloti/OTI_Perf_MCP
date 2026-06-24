// agent.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { getAuthenticatedClient } = require("./sdk/sessionManager");

const app = express();
app.use(express.json());
app.use(cors());

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
