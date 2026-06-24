#!/usr/bin/env node
// mcp-server.js - LRE MCP Server (ES modules)
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Setup CommonJS require for CommonJS modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const { getAuthenticatedClient } = require("./sdk/sessionManager.js");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
dotenv.config();

const server = new Server({
    name: "lre-agent",
    version: "1.0.0"
});

// Register tools
const listHandler = async () => {
    return {
        tools: [
            {
                name: "getRuns",
                description: "Fetch the last 10 runs from the LRE project",
                inputSchema: { type: "object", properties: {}, required: [] }
            },
            {
                name: "getRunDetails",
                description: "Get detailed information about a specific run",
                inputSchema: {
                    type: "object",
                    properties: { runId: { type: "string" } },
                    required: ["runId"]
                }
            },
            {
                name: "startRun",
                description: "Start a new load test run",
                inputSchema: {
                    type: "object",
                    properties: {
                        testId: { type: "number" },
                        testInstanceId: { type: "number" },
                        hours: { type: "number" },
                        minutes: { type: "number" }
                    },
                    required: ["testId", "testInstanceId"]
                }
            },
            {
                name: "pollRun",
                description: "Poll a run until it finishes or fails",
                inputSchema: {
                    type: "object",
                    properties: { runId: { type: "string" } },
                    required: ["runId"]
                }
            },
            {
                name: "getReport",
                description: "Download the HTML report for a completed run",
                inputSchema: {
                    type: "object",
                    properties: { runId: { type: "string" } },
                    required: ["runId"]
                }
            }
        ]
    };
};

server.setRequestHandler(
    { method: "tools/list" },
    listHandler
);

// Register tool calls
server.setRequestHandler(
    "tools/call",
    async (request) => {
        const { name, arguments: args } = request;

        try {
            const client = await getAuthenticatedClient();

            if (name === "getRuns") {
                const runs = await client.getRuns();
                const last10 = Array.isArray(runs) ? runs.slice(0, 10) : [];
                return {
                    content: [{
                        type: "text",
                        text: `Found ${runs ? runs.length : 0} total runs. Latest 10:\n\n${JSON.stringify(
                            last10.map(r => ({
                                id: r.ID,
                                state: r.RunState,
                                testId: r.TestID,
                                startTime: r.StartTime
                            })),
                            null,
                            2
                        )}`
                    }]
                };
            } else if (name === "getRunDetails") {
                const details = await client.getRunDetails(args.runId);
                return {
                    content: [{
                        type: "text",
                        text: details ? JSON.stringify({
                            id: details.ID,
                            state: details.RunState,
                            testId: details.TestID,
                            startTime: details.StartTime,
                            endTime: details.EndTime
                        }, null, 2) : `Run ${args.runId} not found.`
                    }]
                };
            } else if (name === "startRun") {
                const result = await client.startRun({
                    testId: args.testId,
                    testInstanceId: args.testInstanceId,
                    hours: args.hours || 0,
                    minutes: args.minutes || 30
                });
                return {
                    content: [{
                        type: "text",
                        text: `Run started! Run ID: ${result.ID}`
                    }]
                };
            } else if (name === "pollRun") {
                const state = await client.pollRunUntilDone(args.runId);
                return {
                    content: [{
                        type: "text",
                        text: `Run ${args.runId} completed with state: ${state}`
                    }]
                };
            } else if (name === "getReport") {
                const html = await client.findHtmlReportResult(args.runId);
                if (!html) {
                    return {
                        content: [{
                            type: "text",
                            text: `No HTML report for run ${args.runId}`
                        }]
                    };
                }
                const saved = await client.downloadReport(args.runId, html.ID, `LRE-Report-${args.runId}.zip`);
                return {
                    content: [{
                        type: "text",
                        text: `Report saved to: ${saved}`
                    }]
                };
            } else {
                return {
                    content: [{
                        type: "text",
                        text: `Unknown tool: ${name}`
                    }],
                    isError: true
                };
            }
        } catch (err) {
            return {
                content: [{
                    type: "text",
                    text: `Error executing ${name}: ${err.message}`
                }],
                isError: true
            };
        }
    }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("LRE MCP Server started");
