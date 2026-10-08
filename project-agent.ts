import dotenv from "dotenv";

dotenv.config();

const XENTRAL_API_URL = process.env.XENTRAL_API_URL!;
const XENTRAL_API_TOKEN = process.env.XENTRAL_API_TOKEN!;
const PROJECT_ID_CLAYTON_SHOP = process.env.XENTRAL_PROJECT_ID_CLAYTON_SHOP || "5";

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

export async function runProjectAgent() {
  console.log(`[${new Date().toISOString()}] Scanning for Project Automations...`);

  // Rule 1: Abholung Hamburg -> Force Clayton Shop
  const qsAbholung = `?filter[0][key]=tags&filter[0][op]=equals&filter[0][value]=Abholung%20Hamburg`;
  const resAbholung = await request(`/api/v3/salesOrders${qsAbholung}`);
  if (resAbholung && resAbholung.data) {
    for (const order of resAbholung.data) {
      if (!order.project || order.project.id !== PROJECT_ID_CLAYTON_SHOP) {
        console.log(`Order ${order.id}: Tag is 'Abholung Hamburg'. Forcing project to ${PROJECT_ID_CLAYTON_SHOP} (Clayton Shop)...`);
        await request(`/api/v3/salesOrders/${order.id}`, {
          method: "PATCH",
          body: JSON.stringify({ project: { id: PROJECT_ID_CLAYTON_SHOP } })
        });
      }
    }
  }

  // Rule 2: Direktversand OR B2B Versand -> Remove Project (if Clayton Shop)
  const removeProjectTags = ["Direktversand", "B2B Versand"];
  for (const tag of removeProjectTags) {
    const qsRemove = `?filter[0][key]=tags&filter[0][op]=equals&filter[0][value]=${encodeURIComponent(tag)}`;
    const resRemove = await request(`/api/v3/salesOrders${qsRemove}`);
    if (resRemove && resRemove.data) {
      for (const order of resRemove.data) {
        if (order.project && order.project.id === PROJECT_ID_CLAYTON_SHOP) {
          console.log(`Order ${order.id}: Tag is '${tag}'. Removing project...`);
          await request(`/api/v3/salesOrders/${order.id}`, {
            method: "PATCH",
            body: JSON.stringify({ project: null })
          });
        }
      }
    }
  }
}
