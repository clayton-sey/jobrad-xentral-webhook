import express from 'express';
import dotenv from 'dotenv';
import { JobradService } from './jobrad';
import { syncHandler } from './sync';

dotenv.config();

const app = express();
app.use(express.json());

const jobradService = new JobradService();

// Step 2: Typeform Webhook
app.post('/webhook/typeform', async (req, res) => {
  try {
    const payload = req.body;
    
    // Typeform payload is typically nested inside "form_response"
    const formResponse = payload.form_response;
    if (!formResponse) {
      return res.status(400).json({ error: 'Invalid Typeform payload' });
    }

    // This is a naive extraction. In a real scenario, we map answers by field IDs.
    // Assuming we extract name, email, and selected bike details from answers:
    const answers = formResponse.answers || [];
    
    // Example mapping logic (needs adaptation to the actual Typeform fields)
    let email = '';
    let firstName = '';
    let lastName = '';
    let bikeSku = '';
    let bikeName = '';
    let bikePrice = 0;

    for (const answer of answers) {
      if (answer.type === 'email') email = answer.email;
      if (answer.type === 'text') {
        // We'd map by answer.field.id in reality
        if (!firstName) firstName = answer.text;
        else if (!lastName) lastName = answer.text;
        else if (!bikeSku) bikeSku = answer.text;
      }
      if (answer.type === 'number') {
        bikePrice = answer.number;
      }
    }

    const customerData = {
      email,
      firstName,
      lastName,
      // Default dummy address, as Typeform might not have it
      street: 'Unbekannt',
      zip: '00000',
      city: 'Unbekannt',
      country: 'DE'
    };

    const selectedItems = [
      {
        sku: bikeSku || 'UNKNOWN_SKU',
        name: bikeName || 'Fahrrad aus Typeform',
        quantity: 1,
        price: bikePrice || 0
      }
    ];

    // Create the offer in Jobrad
    const offer = await jobradService.createOffer(customerData, selectedItems);
    
    res.status(200).json({ message: 'Offer created', offerId: offer.id });
  } catch (error) {
    console.error('Typeform webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/sync', syncHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Jobrad Agent Server is running on port ${PORT}`);
});
