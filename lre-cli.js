#!/usr/bin/env node
// lre-cli.js - Simple LRE command-line tool

require("dotenv").config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { getAuthenticatedClient } = require("./sdk/sessionManager");

const command = process.argv[2] || "help";
const args = process.argv.slice(3);

async function main() {
    try {
        const client = await getAuthenticatedClient();

        switch (command) {
            case "runs": {
                console.log("\n📊 Fetching runs...\n");
                const runs = await client.getRuns();
                const last10 = Array.isArray(runs) ? runs.slice(0, 10) : [];
                console.log(`Found ${runs ? runs.length : 0} total runs. Latest 10:\n`);
                console.table(last10.map(r => ({
                    ID: r.ID,
                    State: r.RunState,
                    TestID: r.TestID,
                    StartTime: r.StartTime,
                    EndTime: r.EndTime
                })));
                break;
            }

            case "run": {
                if (!args[0]) {
                    console.error("❌ Usage: node lre-cli.js run <runId>");
                    process.exit(1);
                }
                const details = await client.getRunDetails(args[0]);
                if (!details) {
                    console.log(`❌ Run ${args[0]} not found.`);
                } else {
                    console.log(`\n✅ Run ${details.ID}:`);
                    console.table({
                        ID: details.ID,
                        State: details.RunState,
                        TestID: details.TestID,
                        StartTime: details.StartTime,
                        EndTime: details.EndTime
                    });
                }
                break;
            }

            case "start": {
                if (!args[0] || !args[1]) {
                    console.error("❌ Usage: node lre-cli.js start <testId> <testInstanceId> [hours] [minutes]");
                    process.exit(1);
                }
                const result = await client.startRun({
                    testId: parseInt(args[0]),
                    testInstanceId: parseInt(args[1]),
                    hours: parseInt(args[2]) || 0,
                    minutes: parseInt(args[3]) || 30
                });
                console.log(`✅ Run started! Run ID: ${result.ID}`);
                break;
            }

            case "help":
            default: {
                console.log(`
🔧 LRE Command-Line Tool

Usage:
  node lre-cli.js runs                        Get last 10 runs
  node lre-cli.js run <runId>                Get details for a run
  node lre-cli.js start <testId> <instanceId> [hours] [minutes]    Start a new run
  node lre-cli.js help                       Show this help message

Examples:
  node lre-cli.js runs
  node lre-cli.js run 12345
  node lre-cli.js start 456 789
  node lre-cli.js start 456 789 1 30
`);
                break;
            }
        }
    } catch (err) {
        console.error(`\n❌ Error: ${err.message}`);
        process.exit(1);
    }
}

main();
