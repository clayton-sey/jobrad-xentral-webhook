import dotenv from "dotenv";
dotenv.config();
import { JobradService } from "./jobrad";

async function run() {
  console.log("Starte Jobrad API Test...");
  const service = new JobradService();
  try {
    const offers = await service.fetchAcceptedOffers();
    console.log("Erfolgreich abgerufen! Anzahl der Angebote:", offers.length);
    if (offers.length > 0) {
      console.log("Neuestes Angebot:", JSON.stringify(offers[0], null, 2));
    } else {
      console.log("Aktuell keine angenommenen Angebote bei Jobrad.");
    }
  } catch (error) {
    console.error("Fehler beim Abruf:", error.message);
  }
}
run();