import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const XENTRAL_API_URL = process.env.XENTRAL_API_URL!;
const XENTRAL_API_TOKEN = process.env.XENTRAL_API_TOKEN!;

async function request(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${XENTRAL_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": "Bearer " + XENTRAL_API_TOKEN,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...options.headers
    }
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Xentral API Error: ${response.status} ${text}`);
    return null;
  }
  return response.json();
}

export async function runLeasingAgent() {
  console.log(`[${new Date().toISOString()}] Scanning for Leasing Orders...`);
  
  const providersPath = path.join(__dirname, "leasing-providers.json");
  if (!fs.existsSync(providersPath)) return;
  const providers = JSON.parse(fs.readFileSync(providersPath, "utf8"));
  
  const productRes = await request(`/api/v1/products?filter[0][key]=number&filter[0][op]=equals&filter[0][value]=CLY10192`);
  if (!productRes || !productRes.data || productRes.data.length === 0) return;
  const discountProductId = productRes.data[0].id;

  for (const provider of providers) {
    const qs = `?filter[0][key]=tags&filter[0][op]=equals&filter[0][value]=${encodeURIComponent(provider.triggerTag)}`;
    const ordersRes = await request(`/api/v3/salesOrders${qs}`);
    if (!ordersRes || !ordersRes.data) continue;

    for (const order of ordersRes.data) {
      // 1. Fetch tags from V1 API to preserve them
      const v1Order = await request(`/api/v1/salesOrders/${order.id}`);
      const existingTags = v1Order?.data?.tags || [];
      const hasProcessedTag = existingTags.some((t: any) => t.title === "Leasing-Processed" || t.title === "Jobrad");
      if (hasProcessedTag) continue;
      
      console.log(`Processing Order ${order.id} for ${provider.triggerTag}...`);
      
      // 2. Fetch customer address for shipping override
      const customerId = order.address?.id;
      let deviatingShipToAddress: any = null;
      if (customerId) {
        const addressRes = await request(`/api/v2/customers/${customerId}/addresses`);
        const addresses = addressRes?.data || [];
        const realAddress = addresses.find((a: any) => a.name !== provider.documentAddress.name && a.street);
        if (realAddress) {
          deviatingShipToAddress = {
            name: realAddress.name || order.customerName || "Kunde",
            street: realAddress.street,
            zipCode: realAddress.zip,
            city: realAddress.city,
            country: realAddress.country
          };
        }
      }

      // 3. Add Discount Line Item
      const grossTotal = parseFloat(order.totals?.gross?.amount || "0");
      if (grossTotal > 0 && provider.discountPercent > 0) {
        const discountAmount = grossTotal * (provider.discountPercent / 100);
        const netDiscount = discountAmount / 1.19;
        
        await request(`/api/v3/salesOrders/${order.id}/lineItems`, {
          method: "POST",
          body: JSON.stringify({
            product: { id: discountProductId },
            quantity: 1,
            price: {
              net: { amount: (-netDiscount).toFixed(2), currency: "EUR" },
              gross: { amount: (-discountAmount).toFixed(2), currency: "EUR" }
            }
          })
        });
      }
      
      // 4. Preserve existing tags, replace triggerTag with Leasing-Processed
      const preservedTags = existingTags
        .filter((t: any) => t.title !== provider.triggerTag)
        .map((t: any) => ({title: t.title}));
      preservedTags.push({title: "Leasing-Processed"});

      // 5. Update Order Address & Tags
      await request(`/api/v3/salesOrders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          documentAddress: provider.documentAddress, 
          deviatingShipToAddress: deviatingShipToAddress,
          tags: preservedTags 
        })
      });
      console.log(`-> Order ${order.id} fully processed!`);
    }
  }
}
