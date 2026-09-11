import { Request, Response } from "express";
import { JobradService } from "./jobrad";
import { XentralService } from "./xentral";

export const syncHandler = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.SYNC_API_KEY || "default-sync-key";
    
    if (authHeader !== `Bearer ${expectedKey}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const jobradService = new JobradService();
    const xentralService = new XentralService();

    const offers = await jobradService.fetchAcceptedOffers();
    const processedOffers = [];
    const errors = [];

    for (const offer of offers) {
      try {
        let customer = await xentralService.findCustomerByEmail(offer.customer.email);
        if (!customer) {
          customer = await xentralService.createCustomer(offer.customer);
        }
        await xentralService.createOrder(customer.id, offer.items);
        await jobradService.markOfferAsProcessed(offer.id);
        processedOffers.push(offer.id);
      } catch (err) {
        console.error(`Error processing Jobrad offer ${offer.id}:`, err);
        errors.push({ offerId: offer.id, error: err.message });
      }
    }

    return res.status(200).json({
      message: "Sync completed",
      processedCount: processedOffers.length,
      processedOffers,
      errorsCount: errors.length,
      errors
    });
  } catch (error) {
    console.error("Jobrad Sync Error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};
