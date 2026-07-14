// sdk/lreClient.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require("dotenv").config();
const axios = require("axios");
const https = require("https");
const fs = require("fs");
const { sleep } = require("./utils");

const agent = new https.Agent({ rejectUnauthorized: false });

class LREClient {
    constructor() {
        this.baseUrl = process.env.LRE_BASE_URL;
        this.domain  = process.env.LRE_DOMAIN;
        this.project = process.env.LRE_PROJECT;
        this.tenant  = process.env.TENANT_ID;

        this.clientId     = process.env.LRE_USERNAME;
        this.clientSecret = process.env.LRE_PASSWORD;

        this.sessionCookie   = null;
        this.authenticatedAt = null;
        this.sessionTtlMs    = 30 * 60 * 1000; // 30 minutes
    }

    // ---------- Auth ----------

    async authenticate() {
        const url = `${this.baseUrl}/LoadTest/rest/authentication-point/AuthenticateClient?tenant=${this.tenant}`;

        const payload = {
            ClientIdKey: this.clientId,
            ClientSecretKey: this.clientSecret
        };

        const response = await axios.post(url, payload, {
            httpsAgent: agent,
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        });

        const cookies = response.headers["set-cookie"] || [];
        const lwCookie = cookies.find(c => c.startsWith("LWSSO_COOKIE_KEY"));

        if (!lwCookie) {
            throw new Error("Authentication succeeded but LWSSO_COOKIE_KEY not found.");
        }

        this.sessionCookie   = lwCookie;
        this.authenticatedAt = Date.now();
        return this.sessionCookie;
    }

    async ensureAuthenticated() {
        const now = Date.now();
        const expired =
            !this.sessionCookie ||
            !this.authenticatedAt ||
            (now - this.authenticatedAt) > this.sessionTtlMs;

        if (expired) {
            // Deduplicate concurrent authentication requests
            if (this.authPromise) {
                return this.authPromise;
            }
            this.authPromise = this.authenticate().finally(() => {
                this.authPromise = null;
            });
            await this.authPromise;
        }
    }

    get authHeaders() {
        return {
            Cookie: this.sessionCookie
        };
    }

    // ---------- Runs ----------

    async getRuns() {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/Runs`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: this.authHeaders
        });

        return response.data;
    }

    async getRunDetails(runId) {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/Runs/${runId}`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: this.authHeaders
        });

        return response.data;
    }

    async startRun({ testId, testInstanceId, hours = 0, minutes = 30 }) {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/Runs`;

        const body = {
            PostRunAction: "Collate And Analyze",
            TestID: Number(testId),
            TestInstanceID: Number(testInstanceId),
            TimeslotDuration: { Hours: hours, Minutes: minutes },
            VudsMode: false
        };

        const response = await axios.post(url, body, {
            httpsAgent: agent,
            headers: {
                "Content-Type": "application/json",
                ...this.authHeaders
            }
        });

        return response.data; // includes ID
    }

    async pollRunUntilDone(runId, { intervalSec = 20, timeoutSec = 3600 } = {}) {
        await this.ensureAuthenticated();
        const start = Date.now();
        let state = "";

        while (true) {
            const details = await this.getRunDetails(runId);
            state = details.RunState;
            console.log(`Run ${runId} state: ${state}`);

            if (state === "Finished" || state === "Failed") {
                return state;
            }

            if ((Date.now() - start) / 1000 > timeoutSec) {
                throw new Error(`Polling timeout exceeded for run ${runId}. Last state: ${state}`);
            }

            await sleep(intervalSec * 1000);
        }
    }

    // ---------- Results & Reports ----------

    async getResults(runId) {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/Runs/${runId}/Results`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: this.authHeaders
        });

        return response.data;
    }

    async findHtmlReportResult(runId) {
        const results = await this.getResults(runId);
        return results.find(r => r.Type === "HTML REPORT");
    }

    async downloadReport(runId, resultId, outputPath = "LRE-Report.zip") {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/Runs/${runId}/Results/${resultId}/data`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: this.authHeaders,
            responseType: "arraybuffer"
        });

        await fs.promises.writeFile(outputPath, response.data);
        return outputPath;
    }

    // ---------- LRE Diagnostics & Resource Discovery ----------

    async getHosts() {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/Hosts`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: {
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    async getScripts() {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/Scripts`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: {
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    async getTests() {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/Tests`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: {
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    async getProjectDetails() {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: {
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        const projects = response.data;
        if (!Array.isArray(projects)) {
            throw new Error("Invalid response format received from LRE projects endpoint.");
        }

        const projectMatch = projects.find(
            p => p.Name && p.Name.toLowerCase() === this.project.toLowerCase()
        );

        if (!projectMatch) {
            throw new Error(`Project "${this.project}" was not found under domain "${this.domain}".`);
        }

        return {
            Name: projectMatch.Name,
            DomainName: this.domain,
            ID: this.tenant || "N/A",
            Status: "Active",
            Description: "LRE Project successfully validated and live connected."
        };
    }

    async getTimeslots() {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/Timeslots`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: {
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    // ---------- Trend Reports ----------

    async getTrendReports() {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/TrendReports`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: {
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    async getTrendReportDetails(trendReportId) {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/TrendReports/${trendReportId}`;

        const response = await axios.get(url, {
            httpsAgent: agent,
            headers: {
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    async createTrendReport(name) {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/TrendReports`;

        const body = {
            Name: name
        };

        const response = await axios.post(url, body, {
            httpsAgent: agent,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    async deleteTrendReport(trendReportId) {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/TrendReports/${trendReportId}`;

        const response = await axios.delete(url, {
            httpsAgent: agent,
            headers: this.authHeaders
        });

        return response.data;
    }

    async associateRunsToTrendReport(trendReportId, runIds) {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/TrendReports/${trendReportId}/AssociateRuns`;

        const body = {
            TrendReportAssociatedRunList: runIds.map(id => ({ RunID: Number(id) }))
        };

        const response = await axios.post(url, body, {
            httpsAgent: agent,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    async disassociateRunsFromTrendReport(trendReportId, runIds) {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/TrendReports/${trendReportId}/DisassociateRuns`;

        const body = {
            TrendReportAssociatedRunList: runIds.map(id => ({ RunID: Number(id) }))
        };

        const response = await axios.post(url, body, {
            httpsAgent: agent,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    async calculateTrendReport(trendReportId) {
        await this.ensureAuthenticated();
        const url = `${this.baseUrl}/LoadTest/rest/domains/${this.domain}/projects/${this.project}/TrendReports/${trendReportId}/calculate`;

        const response = await axios.post(url, {}, {
            httpsAgent: agent,
            headers: {
                "Accept": "application/json",
                ...this.authHeaders
            }
        });

        return response.data;
    }

    // ---------- Extension points (add more as needed) ----------

    // async getTests() { ... }
    // async getTestInstances(testId) { ... }
    // async stopRun(runId) { ... }
    // async deleteRun(runId) { ... }
    // async uploadTrending(runId, payload) { ... }
}

module.exports = LREClient;