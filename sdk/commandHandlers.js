// sdk/commandHandlers.js
const simulatedState = require("./simulatedState");

async function handleCommand(client, parsed) {
    let result;

    switch (parsed.action) {
        case "simulateStart": {
            if (!parsed.testId || !parsed.testInstanceId) {
                throw new Error("testId and testInstanceId inputs must be specified for run simulation.");
            }
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
            if (!parsed.runId) throw new Error("A valid runId is required to generate a simulated report.");
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
            if (!parsed.name) throw new Error("A trend report name is required.");
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
            if (!parsed.id) throw new Error("A valid simulated trend report ID is required.");
            const report = simulatedState.trendReports[parsed.id];
            if (!report) {
                return {
                    success: false,
                    message: `[Simulated] Trend report ID ${parsed.id} not found.`
                };
            }
            result = {
                message: `[Simulated] Retrieved trend report details for ID ${parsed.id}.`,
                simulatedTrendReport: report
            };
            break;
        }

        case "simulateCalculateTrendReport": {
            if (!parsed.id) throw new Error("A valid simulated trend report ID is required.");
            const report = simulatedState.trendReports[parsed.id];
            if (!report) {
                return {
                    success: false,
                    message: `[Simulated] Trend report ID ${parsed.id} not found.`
                };
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
            if (!parsed.id) throw new Error("Trend Report ID is required for fetching details.");
            const report = await client.getTrendReportDetails(parsed.id);
            result = {
                message: `Successfully retrieved trend report details for ID ${parsed.id}.`,
                trendReport: report
            };
            break;
        }

        case "createTrendReport": {
            if (!parsed.name) throw new Error("Trend Report Name is required.");
            const entry = await client.createTrendReport(parsed.name);
            result = {
                message: `Successfully created trend report "${parsed.name}".`,
                trendReport: entry
            };
            break;
        }

        case "deleteTrendReport": {
            if (!parsed.id) throw new Error("Trend Report ID is required for deletion.");
            await client.deleteTrendReport(parsed.id);
            result = {
                message: `Successfully deleted trend report with ID ${parsed.id}.`
            };
            break;
        }

        case "associateRuns": {
            if (!parsed.trendReportId || !parsed.runIds || parsed.runIds.length === 0) {
                throw new Error("A valid trendReportId and an array of runIds are required.");
            }
            const resData = await client.associateRunsToTrendReport(parsed.trendReportId, parsed.runIds);
            result = {
                message: `Successfully associated run(s) ${parsed.runIds.join(", ")} to trend report ID ${parsed.trendReportId}.`,
                rawResponse: resData
            };
            break;
        }

        case "disassociateRuns": {
            if (!parsed.trendReportId || !parsed.runIds || parsed.runIds.length === 0) {
                throw new Error("A valid trendReportId and an array of runIds are required for disassociation.");
            }
            const resData = await client.disassociateRunsFromTrendReport(parsed.trendReportId, parsed.runIds);
            result = {
                message: `Successfully disassociated run(s) ${parsed.runIds.join(", ")} from trend report ID ${parsed.trendReportId}.`,
                rawResponse: resData
            };
            break;
        }

        case "calculateTrendReport": {
            if (!parsed.id) throw new Error("Trend Report ID is required to calculate.");
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
            if (!parsed.runId) throw new Error("A valid runId is required for run details.");
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
            if (!parsed.testId || !parsed.testInstanceId) {
                throw new Error("Both testId and testInstanceId are required to start a run.");
            }
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
            if (!parsed.runId) throw new Error("Run ID is required to poll.");
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
            if (!parsed.runId) throw new Error("Run ID is required to fetch and download reports.");
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

    return result;
}

module.exports = { handleCommand };
