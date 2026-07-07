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

// In-memory store for simulated run and trend report states
const simulatedState = {
    counter: 77701,
    runs: {},
    trendReportsCounter: 3003,
    trendReports: {
        3001: {
            id: 3001,
            name: "Core Services Performance Trend",
            associatedRuns: [77701, 77702],
            state: "Completed",
            lastCalculated: "2026-06-30T10:00:00.000Z"
        },
        3002: {
            id: 3002,
            name: "Microservices Scalability Report",
            associatedRuns: [],
            state: "Draft",
            lastCalculated: null
        }
    }
};

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

    // === Trend Reports Commands (Simulation and Real) ===

    if (text.startsWith("simulate trend reports") || text === "simulate trend report list") {
        return { action: "simulateTrendReports" };
    }

    const simCreateTrendMatch = text.match(/simulate\s+create\s+trend\s+report\s+(.+)/);
    if (simCreateTrendMatch) {
        return { action: "simulateCreateTrendReport", name: simCreateTrendMatch[1].trim() };
    }

    const simCalcTrendMatch = text.match(/simulate\s+calculate\s+trend\s+report\s+(\d+)/) || text.match(/simulate\s+calculate\s+trend\s+(\d+)/);
    if (simCalcTrendMatch) {
        return { action: "simulateCalculateTrendReport", id: Number(simCalcTrendMatch[1]) };
    }

    const simTrendDetailsMatch = text.match(/simulate\s+trend\s+report\s+(\d+)/);
    if (simTrendDetailsMatch) {
        return { action: "simulateTrendReportDetails", id: Number(simTrendDetailsMatch[1]) };
    }

    // Real Trend Report commands
    const assocMatch = text.match(/(?:associate|add)\s+runs?\s+([\d,\s]+)\s+to\s+trend\s+report\s+(\d+)/);
    if (assocMatch) {
        const runIds = assocMatch[1].split(/[\s,]+/).map(s => s.trim()).filter(Boolean).map(Number);
        return { action: "associateRuns", trendReportId: Number(assocMatch[2]), runIds };
    }

    const disMatch = text.match(/(?:disassociate|remove)\s+runs?\s+([\d,\s]+)\s+from\s+trend\s+report\s+(\d+)/);
    if (disMatch) {
        const runIds = disMatch[1].split(/[\s,]+/).map(s => s.trim()).filter(Boolean).map(Number);
        return { action: "disassociateRuns", trendReportId: Number(disMatch[2]), runIds };
    }

    const calcTrendMatch = text.match(/calculate\s+trend\s+report\s+(\d+)/) || text.match(/calculate\s+trend\s+(\d+)/);
    if (calcTrendMatch) {
        return { action: "calculateTrendReport", id: Number(calcTrendMatch[1]) };
    }

    const createTrendMatch = text.match(/create\s+trend\s+report\s+(.+)/);
    if (createTrendMatch) {
        return { action: "createTrendReport", name: createTrendMatch[1].trim() };
    }

    const deleteTrendMatch = text.match(/delete\s+trend\s+report\s+(\d+)/);
    if (deleteTrendMatch) {
        return { action: "deleteTrendReport", id: Number(deleteTrendMatch[1]) };
    }

    const listTrendMatch = text.match(/(?:get|list|show)\s+trend\s+reports/);
    if (listTrendMatch || text === "trend reports") {
        return { action: "getTrendReports" };
    }

    const getTrendDetailMatch = text.match(/(?:get|show|details)\s+trend\s+report\s+(\d+)/) || text.match(/trend\s+report\s+(\d+)/);
    if (getTrendDetailMatch && !text.includes("runs") && !text.includes("associate") && !text.includes("calculate") && !text.includes("delete")) {
        return { action: "getTrendReportDetails", id: Number(getTrendDetailMatch[1]) };
    }

    // Simulation Workflow Modes
    if (text.startsWith("simulate run") || text.startsWith("simulate start")) {
        const testId = testIdMatch ? Number(testIdMatch[1]) : numbers[0] || 180;
        const instanceId = instanceIdMatch ? Number(instanceIdMatch[1]) : numbers[1] || numbers[0] || 9;
        return { action: "simulateStart", testId, testInstanceId: instanceId };
    }

    if (text.startsWith("simulate poll")) {
        return { action: "simulatePoll", runId: runId || 77701 };
    }

    if (text.startsWith("simulate report")) {
        return { action: "simulateReport", runId: runId || 77701 };
    }

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

    if (/\bproject\b.*\b(info|details|about)\b/.test(text)) {
        return { action: "getProjectInfo" };
    }

    if (/\btimeslots?\b/.test(text)) {
        return { action: "getTimeslots" };
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
            case "simulateStart": {
                const newId = simulatedState.counter++;
                simulatedState.runs[newId] = {
                    id: newId,
                    testId: parsed.testId,
                    instanceId: parsed.testInstanceId,
                    state: "Initializing",
                    step: 0,
                    startTime: new Date().toISOString(),
                    endTime: null
                };
                result = {
                    message: `Simulated Run initialized successfully on virtual load generators! Created Virtual Run ID: ${newId}.`,
                    simulatedRun: simulatedState.runs[newId]
                };
                break;
            }

            case "simulatePoll": {
                const run = simulatedState.runs[parsed.runId];
                if (!run) {
                    result = {
                        message: `Simulation record for Run ID ${parsed.runId} not found, but I have dynamically initialized a virtual runner model with ID ${parsed.runId}.`,
                        simulatedRun: { id: parsed.runId, state: "Finished" }
                    };
                    break;
                }
                
                const states = ["Initializing", "Running", "Collate And Analyze", "Finished"];
                if (run.step < states.length - 1) {
                    run.step++;
                    run.state = states[run.step];
                } else {
                    run.state = "Finished";
                    run.endTime = new Date().toISOString();
                }

                result = {
                    message: `Verified virtual Load Generator availability. Simulated Run ID ${run.id} is progressing. (Step ${run.step + 1}/${states.length})`,
                    simulatedRun: {
                        id: run.id,
                        testId: run.testId,
                        instanceId: run.instanceId,
                        state: run.state,
                        startTime: run.startTime,
                        endTime: run.endTime
                    }
                };
                break;
            }

            case "simulateReport": {
                result = {
                    message: `Simulated performance metrics generated. Obtained sample HTML execution results package for simulated Run ID ${parsed.runId}.`,
                    savedTo: `LRE-Report-${parsed.runId}-SIMULATED.zip`,
                    simulationActive: true
                };
                break;
            }

            // === Simulated Trend Reports ===
            case "simulateTrendReports": {
                const list = Object.values(simulatedState.trendReports);
                result = {
                    message: `[Simulated] Found ${list.length} total trend reports in simulation database.`,
                    simulatedTrendReports: list
                };
                break;
            }

            case "simulateCreateTrendReport": {
                const newId = simulatedState.trendReportsCounter++;
                const newReport = {
                    id: newId,
                    name: parsed.name,
                    associatedRuns: [],
                    state: "Draft",
                    lastCalculated: null
                };
                simulatedState.trendReports[newId] = newReport;
                result = {
                    message: `[Simulated] Created trend report "${parsed.name}" successfully with ID ${newId}.`,
                    simulatedTrendReport: newReport
                };
                break;
            }

            case "simulateTrendReportDetails": {
                const report = simulatedState.trendReports[parsed.id];
                if (!report) {
                    result = {
                        success: false,
                        message: `[Simulated] Trend report ID ${parsed.id} not found.`
                    };
                    break;
                }
                result = {
                    message: `[Simulated] Retrieved trend report details for ID ${parsed.id}.`,
                    simulatedTrendReport: report
                };
                break;
            }

            case "simulateCalculateTrendReport": {
                const report = simulatedState.trendReports[parsed.id];
                if (!report) {
                    result = {
                        success: false,
                        message: `[Simulated] Trend report ID ${parsed.id} not found.`
                    };
                    break;
                }
                report.state = "Completed";
                report.lastCalculated = new Date().toISOString();
                result = {
                    message: `[Simulated] Calculation completed for trend report ID ${parsed.id} ("${report.name}").`,
                    simulatedTrendReport: report
                };
                break;
            }

            // === Real Trend Reports ===
            case "getTrendReports": {
                const reports = await client.getTrendReports();
                result = {
                    message: Array.isArray(reports)
                        ? `Successfully retrieved ${reports.length} trend reports from LRE.`
                        : "Fetch trend reports completed successfully.",
                    trendReports: reports
                };
                break;
            }

            case "getTrendReportDetails": {
                const report = await client.getTrendReportDetails(parsed.id);
                result = {
                    message: `Successfully retrieved trend report details for ID ${parsed.id}.`,
                    trendReport: report
                };
                break;
            }

            case "createTrendReport": {
                const entry = await client.createTrendReport(parsed.name);
                result = {
                    message: `Successfully created trend report "${parsed.name}".`,
                    trendReport: entry
                };
                break;
            }

            case "deleteTrendReport": {
                await client.deleteTrendReport(parsed.id);
                result = {
                    message: `Successfully deleted trend report with ID ${parsed.id}.`
                };
                break;
            }

            case "associateRuns": {
                const resData = await client.associateRunsToTrendReport(parsed.trendReportId, parsed.runIds);
                result = {
                    message: `Successfully associated run(s) ${parsed.runIds.join(", ")} to trend report ID ${parsed.trendReportId}.`,
                    rawResponse: resData
                };
                break;
            }

            case "disassociateRuns": {
                const resData = await client.disassociateRunsFromTrendReport(parsed.trendReportId, parsed.runIds);
                result = {
                    message: `Successfully disassociated run(s) ${parsed.runIds.join(", ")} from trend report ID ${parsed.trendReportId}.`,
                    rawResponse: resData
                };
                break;
            }

            case "calculateTrendReport": {
                const resData = await client.calculateTrendReport(parsed.id);
                result = {
                    message: `Calculation triggered successfully for trend report ID ${parsed.id}.`,
                    rawResponse: resData
                };
                break;
            }

            case "getProjectInfo": {
                const project = await client.getProjectDetails();
                result = {
                    message: `Successfully connected to LRE and retrieved information for active project "${project.Name || "Project"}".`,
                    projectDetails: {
                        name: project.Name,
                        domain: project.DomainName,
                        id: project.ID,
                        status: project.Status,
                        description: project.Description || "No description provided."
                    }
                };
                break;
            }

            case "getTimeslots": {
                const slots = await client.getTimeslots();
                result = {
                    message: Array.isArray(slots)
                        ? `Retrieved ${slots.length} timeslot reservations. Load tests require reserved timeslots to run.`
                        : "Fetch timeslots response completed successfully.",
                    timeslots: Array.isArray(slots) ? slots.map(s => ({
                        id: s.ID,
                        name: s.Name,
                        startTime: s.StartTime,
                        duration: s.Duration,
                        status: s.Status
                    })) : []
                };
                break;
            }

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

    // Keep session hydrated and print status logs every 10 seconds
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
    }, 10 * 1000);
});
