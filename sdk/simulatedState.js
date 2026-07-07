// sdk/simulatedState.js

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

module.exports = simulatedState;
