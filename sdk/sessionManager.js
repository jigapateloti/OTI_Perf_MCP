// sdk/sessionManager.js
const LREClient = require("./lreClient");

let singletonClient = null;

function getClient() {
    if (!singletonClient) {
        singletonClient = new LREClient();
    }
    return singletonClient;
}

async function getAuthenticatedClient() {
    const client = getClient();
    await client.ensureAuthenticated();
    return client;
}

module.exports = {
    getClient,
    getAuthenticatedClient
};
