import express from 'express';
import dotenv from 'dotenv';
import { SkuMapper } from './sku-mapper';
import { XentralService } from './xentral';
import { runLeasingAgent } from './leasing-agent';
import { runProjectAgent } from './project-agent';

dotenv.config();

const app = express();
app.use(express.json());

const JOBRAD_CLIENT_ID = process.env.JOBRAD_CLIENT_ID!;
const JOBRAD_CLIENT_SECRET = process.env.JOBRAD_CLIENT_SECRET!;
const XENTRAL_API_URL = process.env.XENTRAL_API_URL!;
const XENTRAL_API_TOKEN = process.env.XENTRAL_API_TOKEN!;

// Projekt ID für "Kauf Kunde" = 5 (wird für Clayton Shop bei Selbstabholung genutzt)
const PROJECT_ID_CLAYTON_SHOP = process.env.XENTRAL_PROJECT_ID_CLAYTON_SHOP || "5";

async function fetchLatestDoneOffers() {
  const tokenRes = await fetch("https://id.jobrad.org/realms/external/protocol/openid-connect/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: JOBRAD_CLIENT_ID, client_secret: JOBRAD_CLIENT_SECRET, scope: "dealer-api" })
  });
  const tokenData = await tokenRes.json();
  const res = await fetch("https://connect.jobrad.org/v1/offers?status=done&page=1&perPage=10&order=desc", {
    headers: { "Authorization": "Bearer " + tokenData.access_token, "Content-Type": "application/json" }
  });
  const data = await res.json();
  return data.data || [];
}

async function syncJobradOrders() {
  console.log(`[${new Date().toISOString()}] Syncing Jobrad Orders...`);
  try {
    const offers = await fetchLatestDoneOffers();
    const mapper = new SkuMapper(XENTRAL_API_URL, XENTRAL_API_TOKEN);
    const xentral = new XentralService(XENTRAL_API_URL, XENTRAL_API_TOKEN);

    const today = new Date().toISOString().split('T')[0];
    for (const offer of offers) {
      const offerDate = new Date(offer.lastUpdateAt || offer.createdAt).toISOString().split('T')[0];
      if (offerDate !== today) {
        console.log(`-> Offer ${offer.offerNumber} is from ${offerDate}, not today (${today}). Skipping.`);
        continue;
      }
      console.log(`Checking Offer: ${offer.offerNumber} for ${offer.customerName}...`);
      
      const exists = await xentral.findSalesOrderByCustomerOrderNumber(offer.offerNumber);
      if (exists) {
        console.log(`-> Order ${offer.offerNumber} already exists in Xentral. Skipping.`);
        continue;
      }

      console.log(`-> NEW Order found! Processing ${offer.offerNumber}...`);
      
      const { lineItems, tags } = await mapper.mapJobradOfferToXentralLineItems(offer);
      
      let customer = await xentral.findCustomerByEmail(offer.customerEmail);
      let customerId = customer ? customer.id : null;
      if (!customerId) {
        const nameParts = offer.customerName.split(" ");
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || "Unbekannt";
        customerId = await xentral.createCustomer(firstName, lastName, offer.customerEmail);
      }

      let projectId = null;
      if (!offer.withShipping) {
         projectId = PROJECT_ID_CLAYTON_SHOP;
      }

      const order = await xentral.createSalesOrder(customerId, lineItems, tags, projectId, offer.offerNumber, offer.customerName);
      console.log(`-> Success! Order created with ID: ${order.id}`);
    }
  } catch (err) {
    console.error("Error during sync:", err);
  }
}

// Manueller Trigger falls gewünscht
app.post('/webhook/jobrad', async (req, res) => {
  res.status(200).send("Sync triggered manually");
  syncJobradOrders();
  runLeasingAgent(); runProjectAgent(); // Asynchron im Hintergrund laufen lassen
});

// Health-Check für Railway
app.get('/', (req, res) => {
  res.status(200).send("Jobrad Sync Service is running");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Jobrad Sync Service running on port ${PORT}`);
  
  // Direkt einmal beim Start ausführen
  syncJobradOrders();

  // Alle 60 Minuten (900.000 ms) automatisch prüfen
  setInterval(() => { syncJobradOrders(); runLeasingAgent(); runProjectAgent(); }, 15 * 60 * 1000); // 15 Minuten fuer alles
});
