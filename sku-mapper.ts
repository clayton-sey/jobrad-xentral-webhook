export class SkuMapper {
  private xentralUrl: string;
  private xentralToken: string;

  constructor(xentralUrl: string, xentralToken: string) {
    this.xentralUrl = xentralUrl;
    this.xentralToken = xentralToken;
  }

  async getXentralProducts() {
    let allProducts: any[] = [];
    let page = 1;
    while(true) {
      const url = `${this.xentralUrl}/api/v1/products?page[size]=50&page[number]=${page}`;
      const res = await fetch(url, {
        headers: {
          "Authorization": "Bearer " + this.xentralToken,
          "Accept": "application/json"
        }
      });
      if (!res.ok) break;
      const json = await res.json();
      if (!json.data || json.data.length === 0) break;
      allProducts.push(...json.data);
      page++;
    }
    
    // C-Parts ignorieren
    return allProducts.filter(p => !(
      (p.category && p.category.name === "C-Parts") ||
      (p.tags && p.tags.includes("C-Parts")) ||
      (p.productGroup && p.productGroup.name === "C-Parts")
    ));
  }

  private normalize(str: string) {
    return str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  }

  async mapJobradOfferToXentralLineItems(offer: any) {
    const products = await this.getXentralProducts();
    const lineItems: any[] = [];
    const tags: string[] = ["Jobrad"];
    let grossTotal = 0;

    const aliases: Record<string, string> = {
      "Stem Tracker (fest verbaut)": "GPS-Tracker",
      "Stem Tracker": "GPS-Tracker",
      "Abus Iven Chain 8210": "Abus Kettenschloss Iven Chain",
      "Brooks B67": "Brooks B67, Brown - Einzelpreis",
      "Clayton Front Gepäckträger": "Front Gepäckträger",
      "Gepäckträger hinten": "Racktime Gepäckträger",
      "Clayton Gepäckträger hinten": "Racktime Gepäckträger",
      "Clayton verstellbarer Vorbau": "Lenkererhöhung",
      "verstellbarer Vorbau": "Lenkererhöhung"
    };

    // 1. Map main bike
    if (offer.product) {
      // Fallback for Jobrad typo ".- "
      const cleanModelName = offer.product.modelName.replace(/\.-/g, "-");
      const searchString = `${cleanModelName} - ${offer.product.size}`;
      const normSearch = this.normalize(searchString);

      let matchedProduct = products.find(p => p.name === searchString || p.name.includes(searchString));
      if (!matchedProduct) {
        // Try normalized match
        matchedProduct = products.find(p => this.normalize(p.name).includes(normSearch));
      }
      
      if (matchedProduct) {
        lineItems.push({
          productId: matchedProduct.id,
          quantity: 1,
          price: offer.product.priceGross
        });
        grossTotal += offer.product.priceGross;
      } else {
        console.warn("Could not find Main Bike:", offer.product.modelName, offer.product.size);
      }
    }

    // 2. Map accessories
    if (offer.accessory && offer.accessory.length > 0) {
      for (const acc of offer.accessory) {
        let accName = acc.modelName;
        if (acc.brandName && !accName.includes(acc.brandName)) {
          accName = `${acc.brandName} ${accName}`;
        }
        
        if (aliases[acc.modelName]) accName = aliases[acc.modelName];
        else if (aliases[accName]) accName = aliases[accName];

        const normSearch = this.normalize(accName);

        // Suche nach E-Bike Bundle priorisieren!
        let matchedAcc = products.find(p => 
          (p.name === accName || p.name.includes(accName) || this.normalize(p.name).includes(normSearch) || normSearch.includes(this.normalize(p.name)) || normSearch.includes(this.normalize(p.name))) && 
          (p.name.includes("- E-Bike Bundle") || p.name.includes("-B"))
        );
        
        if (!matchedAcc) {
          matchedAcc = products.find(p => p.name === accName || p.name.includes(accName) || this.normalize(p.name).includes(normSearch));
        }

        if (matchedAcc) {
          lineItems.push({
            productId: matchedAcc.id,
            quantity: 1,
            price: acc.priceGross
          });
          grossTotal += acc.priceGross;
        } else {
          console.warn("Could not find Accessory:", acc.modelName);
        }
      }
    }

    // 3. Map shipping
    if (offer.withShipping) {
      const shippingProduct = products.find(p => p.number === "CLY10191");
      if (shippingProduct) {
        lineItems.push({
          productId: shippingProduct.id,
          quantity: 1,
          price: offer.shippingCostGross
        });
        grossTotal += offer.shippingCostGross;
      }
    } else {
      // Selbstabholung
      tags.push("Abholung Hamburg");
    }

    // 4. Jobrad Rabatt (7% Einkaufsrabatt)
    const discountAmount = parseFloat((grossTotal * 0.07).toFixed(2));
    if (discountAmount > 0) {
      const discountProduct = products.find(p => p.number === "CLY10192"); // "Rabatt" SKU
      if (discountProduct) {
        lineItems.push({
          productId: discountProduct.id,
          quantity: 1,
          price: -discountAmount
        });
      }
    }

    return { lineItems, tags };
  }
}
