const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const CONFIG_PATH = path.join(__dirname, "business-config.json");

const DEFAULT_CONFIG = {
  businessName: "AR Clínica Estética",
  assistantName: "Sofia",
  address: "Calle Gaztambide 17, Argüelles, Madrid",
  openingHours: "Lunes a Viernes 10:00 - 20:00",
  phone: "+34 XXX XXX XXX",
  email: "info@clinicaalirivero.com",
  primaryColor: "#1a1208",
  accentColor: "#c9a96e",
  services: [
    { name: "Consulta inicial gratuita", price: "0", description: "40 min, evaluación personalizada sin compromiso" },
    { name: "Armonización facial", price: "300", description: "Ácido hialurónico, resultados naturales desde la primera sesión" },
    { name: "Tratamiento antiedad láser", price: "200", description: "Láser SmartXide, rejuvenecimiento sin cirugía" },
    { name: "Higiene facial Hidraglow AR", price: "80", description: "Limpieza profunda + hidratación intensa" },
    { name: "Estimulador de colágeno", price: "250", description: "Firmeza y luminosidad desde la primera sesión" },
    { name: "Consulta nutrición Método PnK®", price: "60", description: "Programa personalizado de pérdida de peso y bienestar" }
  ],
  amenities: "Clínica autorizada por la Comunidad de Madrid. Ambiente cercano y discreto. Todos los tratamientos 100% personalizados. Opción de financiación disponible.",
  promotions: "Primera consulta completamente gratuita y sin compromiso. Opciones de financiación disponibles para todos los tratamientos.",
  policies: "Cancelación gratuita hasta 24h antes de la cita. Pago tras el tratamiento. Primera visita de evaluación siempre gratuita.",
  notificationEmail: "",
  calendlyLink: "https://calendly.com/alvarogor69/30min",
  adminPassword: "admin123"
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) };
    }
  } catch (e) { console.error("Error loading config:", e); }
  return DEFAULT_CONFIG;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function buildSystemPrompt(config) {
  const serviceList = config.services
    .map(s => `- ${s.name}: ${s.price === "0" ? "Gratuito" : "€" + s.price} — ${s.description}`)
    .join("\n");

  return `Eres ${config.assistantName}, la recepcionista virtual de ${config.businessName}.

DATOS DEL NEGOCIO:
- Nombre: ${config.businessName}
- Dirección: ${config.address}
- Horario: ${config.openingHours}
- Teléfono: ${config.phone}
- Email: ${config.email}

SERVICIOS Y PRECIOS:
${serviceList}

COMODIDADES:
${config.amenities}

PROMOCIONES:
${config.promotions}

POLÍTICA DE CITAS:
${config.policies}

INSTRUCCIONES:
- Sé cálida, profesional y cercana
- Responde siempre en el idioma del cliente
- Cuando alguien quiera reservar una cita o consulta, manda SIEMPRE este link de Calendly: ${config.calendlyLink || ""} — di algo como "Puedes reservar directamente aquí y elegir el hueco que mejor te venga 👉 [link]"
- Si no hay link de Calendly configurado, recoge: nombre, servicio, fecha/hora preferida, teléfono
- Tras recoger los datos, confirma que el equipo contactará para confirmar la cita
- Si no sabes algo específico, di que lo consultarán con la doctora en la primera visita
- Usa emojis con moderación ✨`;
}

// ── Booking notification ───────────────────────────────────────────────────────
async function sendBookingNotification(config, booking) {
  if (!resend || !config.notificationEmail) {
    console.log("📋 Nueva reserva (email no configurado):", booking);
    return;
  }
  try {
    await resend.emails.send({
      from: "Recepcionista Virtual <onboarding@resend.dev>",
      to: config.notificationEmail,
      subject: `🔔 Nueva solicitud de cita — ${config.businessName}`,
      html: `
        <h2 style="color:#1a1208;">Nueva solicitud de cita</h2>
        <p><strong>Nombre:</strong> ${booking.name || "-"}</p>
        <p><strong>Servicio:</strong> ${booking.service || "-"}</p>
        <p><strong>Fecha/hora preferida:</strong> ${booking.datetime || "-"}</p>
        <p><strong>Teléfono:</strong> ${booking.phone || "-"}</p>
        <p><strong>Notas:</strong> ${booking.notes || "-"}</p>
        <hr>
        <p style="color:#888; font-size:12px;">Generado por tu recepcionista virtual.</p>
      `
    });
  } catch (err) { console.error("Error sending notification email:", err); }
}

const BOOKING_TOOL = {
  name: "register_booking",
  description: "Llama a esta función cuando el cliente ha confirmado una solicitud de cita con suficientes datos (nombre, servicio y fecha/hora mínimo).",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nombre del cliente" },
      service: { type: "string", description: "Servicio solicitado" },
      datetime: { type: "string", description: "Fecha y hora preferida" },
      phone: { type: "string", description: "Teléfono del cliente" },
      notes: { type: "string", description: "Notas adicionales" }
    },
    required: ["name", "service", "datetime"]
  }
};

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "Messages array required" });

  try {
    const config = loadConfig();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: buildSystemPrompt(config),
      messages,
      tools: [BOOKING_TOOL],
    });

    const toolUse = response.content.find(b => b.type === "tool_use" && b.name === "register_booking");
    let replyText = response.content.find(b => b.type === "text")?.text || "";

    if (toolUse) {
      sendBookingNotification(config, toolUse.input);
      if (!replyText) {
        const followUp = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 1024,
          system: buildSystemPrompt(config),
          messages: [
            ...messages,
            { role: "assistant", content: response.content },
            { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: "Cita registrada." }] }
          ],
          tools: [BOOKING_TOOL],
        });
        replyText = followUp.content.find(b => b.type === "text")?.text || "¡Cita registrada! Te contactaremos pronto para confirmar.";
      }
    }

    res.json({ reply: replyText });
  } catch (error) {
    console.error("API error:", error);
    res.status(500).json({ error: "Error al procesar la respuesta" });
  }
});

// ── Config endpoints ──────────────────────────────────────────────────────────
app.get("/api/config", (req, res) => {
  const { adminPassword, ...publicConfig } = loadConfig();
  res.json(publicConfig);
});

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  const config = loadConfig();
  password === config.adminPassword
    ? res.json({ success: true })
    : res.status(401).json({ success: false, error: "Contraseña incorrecta" });
});

app.post("/api/config", (req, res) => {
  const { password, ...newConfig } = req.body;
  const currentConfig = loadConfig();
  if (password !== currentConfig.adminPassword) return res.status(401).json({ error: "Contraseña incorrecta" });
  saveConfig({ ...currentConfig, ...newConfig, adminPassword: currentConfig.adminPassword });
  res.json({ success: true });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", business: loadConfig().businessName });
});

// ── WhatsApp webhook (Twilio) ─────────────────────────────────────────────────
app.post("/api/whatsapp", async (req, res) => {
  const incomingMsg = req.body.Body;
  const from = req.body.From;

  if (!incomingMsg) return res.status(400).send("No message");

  try {
    const config = loadConfig();

    // Use a simple in-memory conversation store keyed by phone number
    if (!app.locals.conversations) app.locals.conversations = {};
    if (!app.locals.conversations[from]) app.locals.conversations[from] = [];

    app.locals.conversations[from].push({ role: "user", content: incomingMsg });

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: buildSystemPrompt(config),
      messages: app.locals.conversations[from],
      tools: [BOOKING_TOOL],
    });

    const toolUse = response.content.find(b => b.type === "tool_use" && b.name === "register_booking");
    let replyText = response.content.find(b => b.type === "text")?.text || "";

    if (toolUse) {
      sendBookingNotification(config, { ...toolUse.input, phone: from });
      if (!replyText) replyText = "¡Cita registrada! Te contactaremos pronto para confirmar. 😊";
    }

    app.locals.conversations[from].push({ role: "assistant", content: replyText });

    // Limit conversation history to last 20 messages
    if (app.locals.conversations[from].length > 20) {
      app.locals.conversations[from] = app.locals.conversations[from].slice(-20);
    }

    // Respond in TwiML format
    res.set("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message>
</Response>`);

  } catch (error) {
    console.error("WhatsApp error:", error);
    res.set("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>Disculpa, estoy teniendo problemas técnicos. Por favor llama directamente a la clínica.</Message></Response>`);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`💆 Recepcionista Virtual en http://localhost:${PORT}`));
