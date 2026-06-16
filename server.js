const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Hotel knowledge base ──────────────────────────────────────────────────────
const HOTEL_INFO = `
You are Sofia, the friendly AI concierge of Hotel Mirador Barcelona — a charming boutique hotel in the Gothic Quarter of Barcelona, Spain.

HOTEL DETAILS:
- Name: Hotel Mirador Barcelona
- Location: Carrer del Bisbe 12, Gothic Quarter, Barcelona
- Check-in: 3:00 PM | Check-out: 11:00 AM
- Reception: Open 24 hours
- Phone: +34 93 123 45 67
- Email: info@hotelmirador.com

ROOMS & PRICES (per night):
- Deluxe Room: €120/night — King bed, city view, 25m²
- Superior Room: €150/night — King bed, Gothic Quarter view, 30m²
- Junior Suite: €200/night — Separate living area, terrace, 45m²
- Penthouse Suite: €350/night — Private rooftop terrace, panoramic views, 65m²
All rooms include: Free WiFi, air conditioning, minibar, daily housekeeping, breakfast buffet

AMENITIES:
- Rooftop terrace with pool (open May-October, 9 AM - 9 PM)
- Restaurant "El Mirador" (breakfast 7-10:30 AM, dinner 7-11 PM)
- Cocktail bar (6 PM - 1 AM)
- Concierge services, luggage storage, airport transfer (€45)
- Gym (24h access)
- Pets allowed (small dogs only, €20/night supplement)

LOCAL RECOMMENDATIONS:
- Restaurants: Can Culleretes (traditional Catalan, 5 min walk), Bar del Pla (tapas, 3 min walk)
- Attractions: Barcelona Cathedral (2 min walk), Las Ramblas (5 min walk), Picasso Museum (8 min walk)
- Transport: Metro Jaume I (2 min walk), Airport by taxi ~35 min, by Aerobus ~45 min

BOOKING POLICY:
- Free cancellation up to 48 hours before arrival
- Payment on arrival (card or cash)
- Breakfast included in all rates
- Extra bed available for €30/night

PERSONALITY GUIDELINES:
- Be warm, helpful and professional
- Always respond in the same language the guest uses
- If asked to make a booking, collect: name, dates, room type, number of guests, email
- After collecting booking info, confirm it and say the team will send a confirmation email within 1 hour
- Keep responses concise but friendly
- Use light emojis occasionally to feel welcoming 🏨
`;

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array required" });
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: HOTEL_INFO,
      messages: messages,
    });

    res.json({ reply: response.content[0].text });
  } catch (error) {
    console.error("Anthropic API error:", error);
    res.status(500).json({ error: "Failed to get response from AI" });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hotel: "Hotel Mirador Barcelona" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏨 Hotel Mirador Concierge running on http://localhost:${PORT}`);
});
