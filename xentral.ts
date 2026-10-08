export class XentralService {
  private apiUrl: string;
  private apiToken: string;

  constructor(apiUrl: string, apiToken: string) {
    this.apiUrl = apiUrl;
    this.apiToken = apiToken;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": "Bearer " + this.apiToken,
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...options.headers
      }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Xentral API Error: ${response.status} ${text}`);
    }
    return response;
  }

  async findCustomerByEmail(email: string) {
    const qs = `?filter[0][key]=email&filter[0][op]=equals&filter[0][value]=${encodeURIComponent(email)}&page[size]=10&page[number]=1`;
    const res = await this.request(`/api/v2/customers${qs}`);
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
    return null;
  }

  async createCustomer(firstName: string, lastName: string, email: string) {
    const payload = {
      firstname: firstName,
      lastname: lastName,
      contactDetails: { email: email },
      customerType: "person"
    };
    const response = await this.request("/api/v2/customers", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const location = response.headers.get("location");
    if (!location) throw new Error("Kein Location-Header bei Customer-Anlage erhalten!");
    const customerId = location.split("/").pop()!;



    return customerId;
  }

  async findSalesOrderByCustomerOrderNumber(orderNumber: string) {
    const qs = `?filter[0][key]=customerOrderNumber&filter[0][op]=equals&filter[0][value]=${encodeURIComponent(orderNumber)}&page[size]=1&page[number]=1`;
    const res = await this.request(`/api/v1/salesOrders${qs}`);
    const json = await res.json();
    return json.data && json.data.length > 0;
  }

  async createSalesOrder(customerId: string, lineItems: any[], tags: string[] = [], projectId: string | null = null, customerOrderNumber: string | null = null, customerName: string = "") {

    // Holt die echte Kundenadresse für die Lieferadresse
    const addressRes = await this.request(`/api/v2/customers/${customerId}/addresses`);
    const addressData = await addressRes.json();
    const addresses = addressData.data || [];
    let realAddress = addresses.find((a: any) => a.name !== "JobRad GmbH" && a.street);
    
    let deviatingShipToAddress: any = { name: customerName };
    if (realAddress) {
      deviatingShipToAddress = {
        name: realAddress.name || customerName,
        street: realAddress.street,
        zipCode: realAddress.zip,
        city: realAddress.city,
        country: realAddress.country
      };
    }

    const payload = {
      address: { id: customerId },
      tags: tags.map(t => ({title: t})),
      project: projectId ? { id: projectId } : null,
      documentAddress: {
        name: "JobRad GmbH",
        street: "Postfach 1367",
        zipCode: "79013",
        city: "Freiburg",
        country: "DE"
      },
      deviatingShipToAddress: deviatingShipToAddress,
      customerOrderNumber: customerOrderNumber,

      lineItems: lineItems.map(item => ({
        product: { id: item.productId },
        quantity: item.quantity,
        price: typeof item.price === "number" && item.price < 0 ? { net: { amount: (item.price / 1.19).toFixed(2), currency: "EUR" }, gross: { amount: item.price.toFixed(2), currency: "EUR" } } : item.price
      }))
    };
    // V3 NextGen API
    const response = await this.request("/api/v3/salesOrders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    return json.data;
  }
}
