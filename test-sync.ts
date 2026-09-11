import dotenv from "dotenv";
dotenv.config();
import { SkuMapper } from "./sku-mapper";
import { XentralService } from "./xentral";

async function run() {
  const env = process.env;
  
  // 1. Fetch from Jobrad
  const tokenRes = await fetch("https://id.jobrad.org/realms/external/protocol/openid-connect/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.JOBRAD_CLIENT_ID!, client_secret: env.JOBRAD_CLIENT_SECRET!, scope: "dealer-api" })
  });
  const tokenData = await tokenRes.json();
  const res = await fetch("https://connect.jobrad.org/v1/offers?status=done&page=1&perPage=2&order=desc", {
    headers: { "Authorization": "Bearer " + tokenData.access_token, "Content-Type": "application/json" }
  });
  const data = await res.json();
  const offer = data.data[1];
  console.log("Latest done Jobrad Order:", offer.customerName, offer.offerNumber);

  // 2. Map SKUs
  const mapper = new SkuMapper(env.XENTRAL_API_URL!, env.XENTRAL_API_TOKEN!);
  console.log("Mapping Jobrad offer to Xentral Line Items...");
  const { lineItems, tags } = await mapper.mapJobradOfferToXentralLineItems(offer);
  console.log("Mapped Line Items:", JSON.stringify(lineItems, null, 2));
  console.log("Tags:", tags);

  // 3. Xentral Sync
  const xentral = new XentralService(env.XENTRAL_API_URL!, env.XENTRAL_API_TOKEN!);
  
  console.log("Creating/Finding Customer...");
  let customer = await xentral.findCustomerByEmail(offer.customerEmail);
  let customerId = customer ? customer.id : null;
  if (!customerId) {
    console.log("Customer not found, creating new...");
    const nameParts = offer.customerName.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "Unbekannt";
    customerId = await xentral.createCustomer(firstName, lastName, offer.customerEmail);
  } else {
    console.log("Customer found! ID:", customerId);
  }

  console.log("Creating Sales Order...");
  try {
    const order = await xentral.createSalesOrder(customerId, lineItems, tags);
    console.log("Order created! ID:", order.id);
  } catch (err) {
    console.error(err.message);
  }
}
run();