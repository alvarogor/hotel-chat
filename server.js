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
const CONFIG_PATH = path.join(__dirname, "business-config.json");

// ── Default business configuration (Beauty / Aesthetic Clinic) ────────────────
const DEFAULT_CONFIG = {
  businessName: "Centro de Estética Bella",
  assistantName: "Sofia",
  address: "Calle Colón 45, Valencia",
  openingHours: "Lunes a Viernes 9:30 - 20:00, Sábados 10:00 - 14:00",
  phone: "+34 96 123 45 67",
  email: "info@esteticabella.com",
  services: [
    { name: "Limpieza facial profunda", price: "45", description: "60 min, incluye exfoliación e hidratación" },
    { name: "Depilación láser (piernas completas)", price: "60", description: "Por sesión, paquete de 6 disponible" },
    { name: "Manicura + Pedicura", price: "35", description: "Incluye esmaltado semipermanente" },
    { name: "Masaje relajante", price: "50", description: "60 min, aceites esenciales" },
    { name: "Tratamiento anti-edad", price: "70", description: "Radiofrecuencia facial, 45 min" }
  ],
  amenities: "Zona de espera con café e infusiones, cabinas privadas, productos veganos y cruelty-free, parking cercano",
  policies: "Cancelación gratuita hasta 24h antes de la cita. Se requiere un 20% de depósito para tratamientos de más de 60 min. Pago con tarjeta o efectivo.",
  promotions: "10% de descuento en el primer tratamiento para nuevos clientes. Bono de 6 sesiones de láser con 15% de descuento.",
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
  const serviceList = config.services
    .map(s => `- ${s.name}: €${s.price} — ${s.description}`)
    .join("\n");

  return `
You are ${config.assistantName}, the friendly AI receptionist of ${config.businessName}, a beauty and aesthetic center.

BUSINESS DETAILS:
- Name: ${config.businessName}
- Location: ${config.address}
- Opening hours: ${config.openingHours}
- Phone: ${config.phone}
- Email: ${config.email}

SERVICES & PRICES:
${serviceList}

AMENITIES:
${config.amenities}

CURRENT PROMOTIONS:
${config.promotions}

POLICIES:
${config.policies}

PERSONALITY GUIDELINES:
- Be warm, friendly and professional — like a trusted beauty advisor
- Always respond in the same language the client uses
- If asked to book an appointment, collect: name, desired service, preferred date/time, phone number
- After collecting booking info, confirm it and say the team will call to confirm within a few hours
- Keep responses concise but friendly
- Use light emojis occasionally to feel welcoming ✨💆‍♀️
- If asked about something outside your knowledge (medical advice, specific allergic reactions), recommend they discuss it with the specialist during their visit
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
  res.json({ status: "ok", business: config.businessName });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`💆 Recepcionista Virtual running on http://localhost:${PORT}`);
  console.log(`⚙️  Admin panel: http://localhost:${PORT}/admin.html`);
});
