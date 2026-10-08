const dotenv = require("dotenv");
const fs = require("fs");
const env = dotenv.parse(fs.readFileSync(".env"));
async function run() {
  const tokenRes = await fetch("https://id.jobrad.org/realms/external/protocol/openid-connect/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.JOBRAD_CLIENT_ID, client_secret: env.JOBRAD_CLIENT_SECRET, scope: "dealer-api" }) });
  const tokenData = await tokenRes.json();
  const res = await fetch("https://connect.jobrad.org/v1/orders", { headers: { "Authorization": "Bearer " + tokenData.access_token, "Content-Type": "application/json" } });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
