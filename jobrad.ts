export interface JobradItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface JobradCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

export interface JobradOffer {
  id: string;
  status: string; // e.g., 'accepted'
  customer: JobradCustomer;
  items: JobradItem[];
  acceptedAt: string;
}

export class JobradService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.JOBRAD_API_URL || 'https://api.jobrad.org';
    this.apiKey = process.env.JOBRAD_API_KEY || '';
  }

  /**
   * Fetches newly accepted offers from Jobrad.
   * This is a stub that should be adjusted according to the actual Jobrad API specification.
   */
  async fetchAcceptedOffers(): Promise<JobradOffer[]> {
    if (!this.apiKey) {
      console.warn('JOBRAD_API_KEY is missing. Returning empty accepted offers.');
      return [];
    }

    try {
      // Replace with the actual endpoint for accepted offers
      const response = await fetch(`${this.apiUrl}/v1/offers?status=accepted`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
  const text = await response.text();
  throw new Error("API ERROR " + response.status + ": " + text);
}`);
      }

      const data = await response.json();
      
      // Map the response to our internal JobradOffer interface
      // Note: Adjust the mapping based on the actual Jobrad API response
      return (data.offers || []) as JobradOffer[];
    } catch (error) {
      console.error('Error fetching Jobrad offers:', error);
      throw error;
    }
  }

  /**
   * Marks an offer as processed in Jobrad so we don't fetch it again.
   */
  async markOfferAsProcessed(offerId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/offers/${offerId}/mark-processed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to mark offer as processed: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error marking offer ${offerId} as processed:`, error);
      throw error;
    }
  }

  /**
   * Creates a new offer in Jobrad (Step 2)
   */
  async createOffer(customerData: any, items: any[]): Promise<any> {
    try {
      const payload = {
        customer: customerData,
        items,
        status: "draft"
      };
      const response = await fetch(`${this.apiUrl}/v1/offers`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`Failed to create offer: ${response.statusText}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error creating Jobrad offer:", error);
      throw error;
    }
  }
}
