// sdk/commandParser.js

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
        if (runIds.length === 0) return null;
        return { action: "associateRuns", trendReportId: Number(assocMatch[2]), runIds };
    }

    const disMatch = text.match(/(?:disassociate|remove)\s+runs?\s+([\d,\s]+)\s+from\s+trend\s+report\s+(\d+)/);
    if (disMatch) {
        const runIds = disMatch[1].split(/[\s,]+/).map(s => s.trim()).filter(Boolean).map(Number);
        if (runIds.length === 0) return null;
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

module.exports = { parseCommand };
