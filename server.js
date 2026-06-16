const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CONFIG_PATH = path.join(__dirname, "hotel-config.json");

// ── Default hotel configuration ───────────────────────────────────────────────
const DEFAULT_CONFIG = {
  hotelName: "Hotel Mirador Barcelona",
  assistantName: "Sofia",
  address: "Carrer del Bisbe 12, Gothic Quarter, Barcelona",
  checkIn: "3:00 PM",
  checkOut: "11:00 AM",
  phone: "+34 93 123 45 67",
  email: "info@hotelmirador.com",
  rooms: [
    { name: "Deluxe Room", price: "120", description: "King bed, city view, 25m²" },
    { name: "Superior Room", price: "150", description: "King bed, Gothic Quarter view, 30m²" },
    { name: "Junior Suite", price: "200", description: "Separate living area, terrace, 45m²" },
    { name: "Penthouse Suite", price: "350", description: "Private rooftop terrace, panoramic views, 65m²" }
  ],
  amenities: "Rooftop terrace with pool, Restaurant, Cocktail bar, 24h gym, Pets allowed (€20/night supplement)",
  localTips: "Can Culleretes (traditional Catalan, 5 min walk), Barcelona Cathedral (2 min walk), Las Ramblas (5 min walk)",
  bookingPolicy: "Free cancellation up to 48 hours before arrival. Payment on arrival. Breakfast included in all rates.",
  primaryColor: "#d4af37",
  adminPassword: "admin123"
};

// ── Load / save config ────────────────────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("Error loading config:", e);
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function buildSystemPrompt(config) {
  const roomList = config.rooms
    .map(r => `- ${r.name}: €${r.price}/night — ${r.description}`)
    .join("\n");

  return `
You are ${config.assistantName}, the friendly AI receptionist of ${config.hotelName}.

HOTEL DETAILS:
- Name: ${config.hotelName}
- Location: ${config.address}
- Check-in: ${config.checkIn} | Check-out: ${config.checkOut}
- Phone: ${config.phone}
- Email: ${config.email}

ROOMS & PRICES (per night):
${roomList}

AMENITIES:
${config.amenities}

LOCAL RECOMMENDATIONS:
${config.localTips}

BOOKING POLICY:
${config.bookingPolicy}

PERSONALITY GUIDELINES:
- Be warm, helpful and professional
- Always respond in the same language the guest uses
- If asked to make a booking, collect: name, dates, room type, number of guests, email
- After collecting booking info, confirm it and say the team will send a confirmation email within 1 hour
- Keep responses concise but friendly
- Use light emojis occasionally to feel welcoming 🏨
`;
}

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array required" });
  }

  try {
    const config = loadConfig();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: buildSystemPrompt(config),
      messages: messages,
    });

    res.json({ reply: response.content[0].text });
  } catch (error) {
    console.error("Anthropic API error:", error);
    res.status(500).json({ error: "Failed to get response from AI" });
  }
});

// ── Config endpoints (for admin panel + chat widget) ───────────────────────────
app.get("/api/config", (req, res) => {
  const config = loadConfig();
  // Don't expose the admin password publicly
  const { adminPassword, ...publicConfig } = config;
  res.json(publicConfig);
});

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  const config = loadConfig();
  if (password === config.adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Contraseña incorrecta" });
  }
});

app.post("/api/config", (req, res) => {
  const { password, ...newConfig } = req.body;
  const currentConfig = loadConfig();

  if (password !== currentConfig.adminPassword) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const updatedConfig = { ...currentConfig, ...newConfig, adminPassword: currentConfig.adminPassword };
  saveConfig(updatedConfig);
  res.json({ success: true });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const config = loadConfig();
  res.json({ status: "ok", hotel: config.hotelName });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏨 Hotel Concierge running on http://localhost:${PORT}`);
  console.log(`⚙️  Admin panel: http://localhost:${PORT}/admin.html`);
});
