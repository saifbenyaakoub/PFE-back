const Groq = require("groq-sdk");
const pool = require("../../db");
const weave = require("weave");

// Suppress weave's internal HTTP flush unhandled rejection (known Node 24 bug)
process.on("unhandledRejection", (reason) => {
  if (reason && typeof reason === "object" && typeof reason.json === "function") {
    reason.json().catch(() => {});
    console.warn("⚠️  Weave internal flush suppressed (known SDK issue).");
    return;
  }
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});

(async () => {
  try {
    await weave.init(
      "saifbenyaakoub-institut-superieur-d-informatique-et-math/fixhub-ai-backend"
    );
    console.log("✅ Weave initialized successfully.");
  } catch (err) {
    console.warn("⚠️  Weave init failed (non-fatal):", err?.message || err);
  }
})();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";

// ── Language detection ────────────────────────────────────────────────────────
function detectLanguage(text) {
  if (!text) return "en";
  const arPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  const frPattern = /\b(je|vous|le|la|les|est|pour|avec|une|des|oui|non|bonjour|merci|comment|pourquoi|quand|quel|quelle|annuler|r[ée]servation|devis|prix|appartement|peindre|tarif|prestataire)\b|[\u00C0-\u024F]/i;
  if (arPattern.test(text)) return "ar";
  if (frPattern.test(text)) return "fr";
  return "en";
}

// ── System prompt builder ─────────────────────────────────────────────────────
function buildSystemPrompt(bookings, quotations, providers, language) {
  const languageInstructions = {
    en: "IMPORTANT: Reply strictly in English. Be specific: name providers, mention prices in TND, and give contact info when relevant.",
    fr: "IMPORTANT: Répondez strictement en français. Soyez précis: nommez les prestataires, mentionnez les prix en TND et donnez les coordonnées si utile.",
    ar: "مهم: أجب باللغة العربية فقط. كن دقيقاً: اذكر أسماء مزودي الخدمة والأسعار بالدينار التونسي ومعلومات الاتصال عند الحاجة.",
  };
  const langInstruction = languageInstructions[language] || languageInstructions["en"];

  const bookingsBlock = bookings.length
    ? bookings
        .map((b) =>
          "- " + b.service_name +
          " by " + b.provider_name +
          " in " + (b.provider_city || "N/A") +
          " | Status: " + (b.status || "N/A") +
          (b.amount ? " | Amount: " + b.amount + " TND" : "")
        )
        .join("\n")
    : "- No recent bookings.";

  const quotationsBlock = quotations.length
    ? quotations
        .map((q) =>
          "- " + (q.service || "Service") +
          ": " + q.provider +
          " quoted " + q.total + " TND" +
          (q.status ? " [" + q.status + "]" : "")
        )
        .join("\n")
    : "- No recent quotes.";

  const providersBlock = providers.length
    ? providers
        .map((p) =>
          "- " + p.provider_name +
          " | " + (p.service_title || p.category || "General") +
          " | " + (p.city || "N/A") +
          " | Rating: " + (p.avg_rating || "N/A") + "/5" +
          " (" + (p.review_count || 0) + " reviews)" +
          (p.description ? " | " + p.description.slice(0, 80) : "")
        )
        .join("\n")
    : "- No providers available.";

  return [
    "You are FixHub Assistant — an AI helper for a Tunisian home services marketplace.",
    "Answer the client's question using ONLY the data provided below. Do not invent data.",
    langInstruction,
    "",
    "=== RECENT BOOKINGS ===",
    bookingsBlock,
    "",
    "=== QUOTES RECEIVED ===",
    quotationsBlock,
    "",
    "=== AVAILABLE PROVIDERS ===",
    providersBlock,
    ""
  ].join("\n");
}

// ── ✅ Fix 1: Wrapped in weave.op to track properly without looking for default Vertex/Gemini keys ──
const generateTrackedResponse = weave.op(async function generateTrackedResponse({ systemPrompt, userMessage }) {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMessage },
    ],
    temperature: 0.3,
  });
  return response.choices[0].message.content;
});

// ── Controller ────────────────────────────────────────────────────────────────

const aiController = {
  async chat(req, res) {
    try {
      const { message, userId } = req.body;
      if (!message || !userId) {
        return res.status(400).json({ error: "message and userId required" });
      }

      // ── Database Queries ────────────────────────────────────────────────
      const bookingsRes = await pool.query(
        `SELECT b.id, b.date, b.amount, b.status, s.title AS service_name,
                s.category AS service_category, u.name AS provider_name, p.city AS provider_city
         FROM bookings b
         JOIN services s ON s.id = b.service_id
         JOIN providers p ON p.id = s.provider_id
         JOIN users u ON u.id = p.user_id
         WHERE b.client_id = $1 ORDER BY b.created_at DESC LIMIT 10`,
        [userId]
      );

      const quotationsRes = await pool.query(
        `SELECT m.content, m.created_at, u.name AS provider_name
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         JOIN users u ON (CASE WHEN c.user1_id = $1 THEN u.id = c.user2_id ELSE u.id = c.user1_id END)
         WHERE (c.user1_id = $1 OR c.user2_id = $1)
           AND m.content LIKE '%"type":"quotation"%'
         ORDER BY m.created_at DESC LIMIT 5`,
        [userId]
      );

      const providersRes = await pool.query(
        `SELECT u.name AS provider_name, p.city, s.title AS service_title, s.category,
                s.description, ROUND(AVG(r.rating), 1) AS avg_rating, COUNT(r.id) AS review_count
         FROM providers p
         JOIN users u ON u.id = p.user_id
         JOIN services s ON s.provider_id = p.id
         LEFT JOIN bookings b2 ON b2.service_id = s.id
         LEFT JOIN reviews r ON r.booking_id = b2.id
         GROUP BY u.name, p.city, s.title, s.category, s.description
         ORDER BY avg_rating DESC NULLS LAST LIMIT 20`
      );

      // ── Data Shaping ────────────────────────────────────────────────────
      const bookings  = bookingsRes.rows;
      const providers = providersRes.rows;
      const quotations = quotationsRes.rows
        .map((row) => {
          try {
            const data = JSON.parse(row.content);
            return {
              provider: row.provider_name,
              service:  data.service || "Service",
              total:    data.amount,
              status:   data.status,
            };
          } catch { return null; }
        })
        .filter(Boolean);

      // ── Build prompt and call Groq ──────────────────────────────────────
      const language     = detectLanguage(message);
      const systemPrompt = buildSystemPrompt(bookings, quotations, providers, language);

      // ✅ Fix 2: Calling the wrapped operation passing variables inside an object structure
      const reply = await generateTrackedResponse({ systemPrompt, userMessage: message });
      return res.json({ reply });

    } catch (err) {
      console.error("AI Controller Error:", err?.message || err);
      return res.status(500).json({
        error: "AI assistant failed",
        message: err?.message || "An unknown error occurred",
      });
    }
  },
};

module.exports = aiController;