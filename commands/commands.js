// commands/commands.js
const { getAuthenticatedClient } = require("../sdk/sessionManager");

(async () => {
    const client = await getAuthenticatedClient();
    console.log("Authenticated to LRE.");

    // 👇 ONLY place you and Copilot Chat will edit.

    // Example 1: list last 10 runs
    const runs = await client.getRuns();
    console.log('Last 10 runs:');
    console.log(runs.slice(0, 10));

    // Example 2: get run details
    // const details = await client.getRunDetails(1234);
    // console.log(details);

    // Example 3: download HTML report for a run
    // const html = await client.findHtmlReportResult(1234);
    // if (!html) throw new Error("HTML REPORT not found.");
    // await client.downloadReport(1234, html.ID, "LRE-Report-1234.zip");

})();
