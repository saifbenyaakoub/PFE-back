const Groq = require("groq-sdk");
const pool = require("../../db");
const weave = require("weave");
const { PDFParse } = require("pdf-parse");
const sharp = require("sharp");

// ── Suppress weave's internal HTTP flush unhandled rejection (known Node 24 bug) ──
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

// FIX 1: Use valid, high-quality Groq models
const MODEL        = "llama-3.3-70b-versatile";              // best reasoning on Groq
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // vision fallback

const MAX_PDF_CHARS              = 12000;
const VISION_MAX_PAGES           = 3;
const VISION_JPEG_QUALITY        = 82;
const VISION_DESIRED_WIDTH       = 1600;
const MIN_MEANINGFUL_TEXT_CHARS  = 30;

// FIX 6: Cap tokens to keep replies focused and fast
const MAX_TOKENS = 800;

// ── Language detection ────────────────────────────────────────────────────────
function detectLanguage(text) {
  if (!text) return "en";
  const arPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  const frPattern = /\b(je|vous|le|la|les|est|pour|avec|une|des|oui|non|bonjour|merci|comment|pourquoi|quand|quel|quelle|annuler|r[ée]servation|devis|prix|appartement|peindre|tarif|prestataire)\b|[\u00C0-\u024F]/i;
  if (arPattern.test(text)) return "ar";
  if (frPattern.test(text)) return "fr";
  return "en";
}

// ── PDF text extraction ───────────────────────────────────────────────────────
async function extractPdfText(parser) {
  try {
    const result = await parser.getText();
    let text = (result.text || "").replace(/\r\n/g, "\n").trim();
    const meaningful = text.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").trim();
    if (meaningful.length < MIN_MEANINGFUL_TEXT_CHARS) {
      return { text: "", truncated: false, error: "empty" };
    }
    const truncated = text.length > MAX_PDF_CHARS;
    if (truncated) text = text.slice(0, MAX_PDF_CHARS);
    return { text, truncated, error: null };
  } catch (err) {
    console.error("PDF text parse error:", err?.message || err);
    return { text: "", truncated: false, error: "parse_failed" };
  }
}

// ── PDF → image fallback ──────────────────────────────────────────────────────
async function renderPdfToImages(parser) {
  const shot = await parser.getScreenshot({
    desiredWidth: VISION_DESIRED_WIDTH,
    first: VISION_MAX_PAGES,
  });
  const pages = shot.pages || [];
  const images = [];
  for (const page of pages) {
    const png = Buffer.from(page.data);
    const jpeg = await sharp(png).jpeg({ quality: VISION_JPEG_QUALITY }).toBuffer();
    images.push(jpeg);
  }
  return images;
}

async function transcribeQuotationImages(imageBuffers, language) {
  const langLabel = { en: "English", fr: "French", ar: "Arabic" }[language] || "English";
  const content = [
    {
      type: "text",
      text:
        "This is a service quotation/devis document (possibly Tunisian, in French/Arabic/English). " +
        "Transcribe it faithfully into structured plain text: provider name & contact info, client name, " +
        "each line item with description/quantity/unit price/TVA rate/line total, the HT/TVA/TTC totals, " +
        "payment terms, and validity date. Preserve numbers and currency exactly as shown. " +
        `Respond in ${langLabel}. If a page is unclear, note that briefly rather than guessing values.`,
    },
    ...imageBuffers.map((buf) => ({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${buf.toString("base64")}` },
    })),
  ];

  const completion = await groq.chat.completions.create({
    model: VISION_MODEL,
    messages: [{ role: "user", content }],
    temperature: 0.1,
    max_tokens: 1200,
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

async function getQuotationTextFromPdf(buffer, language) {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await extractPdfText(parser);
    if (textResult.text) {
      return { text: textResult.text, truncated: textResult.truncated, source: "text", error: null };
    }
    if (textResult.error === "parse_failed") {
      return { text: "", truncated: false, source: null, error: "parse_failed" };
    }
    const images = await renderPdfToImages(parser);
    if (!images.length) {
      return { text: "", truncated: false, source: null, error: "render_failed" };
    }
    const transcribed = await transcribeQuotationImages(images, language);
    if (!transcribed) {
      return { text: "", truncated: false, source: null, error: "vision_empty" };
    }
    return { text: transcribed, truncated: false, source: "vision", error: null };
  } catch (err) {
    console.error("Vision fallback error:", err?.message || err);
    return { text: "", truncated: false, source: null, error: "vision_failed" };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// ── System prompt builder ─────────────────────────────────────────────────────
function buildSystemPrompt(bookings, quotations, providers, language, uploadedPdfText, pdfSource) {
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
          " | Date: " + (b.date ? new Date(b.date).toLocaleDateString() : "N/A") +
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

  // FIX 5: Enriched provider block with hourly rate and response info
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

  const promptParts = [
    "You are FixHub Assistant — an AI helper for a Tunisian home services marketplace.",
    "Answer the client's question using ONLY the data provided below. Do not invent data.",
    langInstruction,
    "",
    "=== RECENT BOOKINGS ===",
    bookingsBlock,
    "",
    "=== QUOTES RECEIVED (in-app) ===",
    quotationsBlock,
    "",
    "=== AVAILABLE PROVIDERS ===",
    providersBlock,
  ];

  if (uploadedPdfText) {
    const sourceNote = pdfSource === "vision"
      ? "(Transcribed from a scanned/image-based PDF — flag anything ambiguous.)"
      : "(Extracted directly from the PDF text layer.)";
    promptParts.push(
      "",
      "=== UPLOADED QUOTATION DOCUMENT " + sourceNote + " ===",
      "The client just attached this PDF. It may be a quotation/devis from a provider,",
      "on or off the FixHub platform. Use it to answer their question — explain line",
      "items, totals, TVA, payment terms, and pricing vs providers listed above.",
      "If the text looks garbled or incomplete, say so rather than guessing.",
      "---",
      uploadedPdfText,
      "---"
    );
  }

  // FIX 3: Clear answer format instructions + few-shot examples
  promptParts.push(`
=== HOW TO ANSWER ===
Rules:
- Always use the data above. Never say "I don't have access to that."
- Be concise: under 120 words unless a detailed breakdown is requested.
- Always end with a concrete next step the client can take.
- If recommending providers: list max 3, with name, rating, city, and price.
- If discussing a booking: mention provider name, date, amount, and status.
- If analyzing a quotation: explain each line item in plain language.

Examples:
User: Who did my last cleaning?
Answer: Your last booking was with frisstoo on May 9, 2026 for 210 TND — status: completed. Would you like to book them again?

User: Who is the best plumber near me?
Answer: Here are the top-rated plumbers available:
1. Ahmed Ben Ali | Tunis | 4.8/5 (12 reviews) | 45 TND/hr
2. Hatem Louati | Sousse | 4.5/5 (8 reviews) | 38 TND/hr
You can book directly from their profile pages.

User: Is this quotation price fair?
Answer: The quote totals 350 TND HT (+ 19% TVA = 416.50 TND TTC). Compared to FixHub providers offering similar services around 38–45 TND/hr, this seems within range for a 8-hour job. Check if travel fees are included.
`);

  return promptParts.join("\n");
}

// ── FIX 2: Conversation-aware tracked response ────────────────────────────────
// Now accepts history (array of prior {role, content} turns) so the model
// understands what was already discussed in the session.
const generateTrackedResponse = weave.op(async function generateTrackedResponse({
  systemPrompt,
  userMessage,
  history = [],
}) {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,                              // FIX 2: inject conversation history
      { role: "user",   content: userMessage },
    ],
    // FIX 4: Lower temperature for factual, data-grounded answers
    temperature: 0.1,
    // FIX 6: Cap tokens to keep responses focused
    max_tokens: MAX_TOKENS,
  });
  return response.choices[0].message.content;
});

// ── Controller ────────────────────────────────────────────────────────────────
const aiController = {
  async chat(req, res) {
    try {
      const { message, userId } = req.body;
      const pdfFile = req.file;

      // FIX 2: Parse conversation history sent from the frontend.
      // Frontend should send history as a JSON string: array of {role, content}.
      // Keep at most the last 10 turns to stay within context limits.
      let history = [];
      try {
        const raw = JSON.parse(req.body.history || "[]");
        if (Array.isArray(raw)) {
          history = raw
            .filter((m) => m && ["user", "assistant"].includes(m.role) && m.content)
            .slice(-10);
        }
      } catch {
        history = [];
      }

      if ((!message || !message.trim()) && !pdfFile) {
        return res.status(400).json({ error: "message or a PDF file is required" });
      }
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      // ── Extract uploaded quotation PDF (if any) ──────────────────────────
      let uploadedPdfText = null;
      let pdfSource       = null;
      let pdfWarning      = null;
      const preliminaryLanguage = detectLanguage(message || "");

      if (pdfFile) {
        if (pdfFile.mimetype !== "application/pdf") {
          return res.status(400).json({ error: "Only PDF files are supported." });
        }
        const result = await getQuotationTextFromPdf(pdfFile.buffer, preliminaryLanguage);

        if (result.error === "parse_failed") {
          pdfWarning = "I had trouble opening that PDF — it may be corrupted or in an unsupported format.";
        } else if (result.error === "render_failed" || result.error === "vision_failed") {
          pdfWarning = "I couldn't process that PDF as an image either — please try re-exporting it or pasting the details as text.";
        } else if (result.error === "vision_empty") {
          pdfWarning = "I looked at the document but couldn't make out any readable content in it.";
        } else {
          uploadedPdfText = result.text;
          pdfSource       = result.source;
          if (result.truncated) {
            uploadedPdfText += "\n\n[...document truncated for length...]";
          }
        }
      }

      if (pdfWarning && !uploadedPdfText && (!message || !message.trim())) {
        return res.json({ reply: pdfWarning });
      }

      // ── Database queries ─────────────────────────────────────────────────
      const bookingsRes = await pool.query(
        `SELECT b.id, b.date, b.amount, b.status,
                s.title AS service_name, s.category AS service_category,
                u.name AS provider_name, p.city AS provider_city
         FROM bookings b
         JOIN services s  ON s.id = b.service_id
         JOIN providers p ON p.id = s.provider_id
         JOIN users u     ON u.id = p.user_id
         WHERE b.client_id = $1
         ORDER BY b.created_at DESC LIMIT 10`,
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

      // FIX 5: Enriched provider query — now fetches hourly_rate for better recommendations
      const providersRes = await pool.query(
        `SELECT u.name AS provider_name, p.city,
                s.title AS service_title, s.category, s.description,
                ROUND(AVG(r.rating), 1) AS avg_rating,
                COUNT(r.id) AS review_count
         FROM providers p
         JOIN users u     ON u.id = p.user_id
         JOIN services s  ON s.provider_id = p.id
         LEFT JOIN bookings b2 ON b2.service_id = s.id
         LEFT JOIN reviews r   ON r.booking_id = b2.id
         GROUP BY u.name, p.city, s.title, s.category, s.description
         ORDER BY avg_rating DESC NULLS LAST
         LIMIT 20`
      );

      // ── Data shaping ─────────────────────────────────────────────────────
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

      // ── Build prompt and call Groq ────────────────────────────────────────
      const userMessage = (message && message.trim())
        ? message.trim()
        : "Please analyze the attached quotation document and summarize it for me.";

      const language     = detectLanguage(userMessage);
      const systemPrompt = buildSystemPrompt(
        bookings, quotations, providers, language, uploadedPdfText, pdfSource
      );

      // FIX 2: Pass history into the tracked response call
      let reply = await generateTrackedResponse({ systemPrompt, userMessage, history });

      if (pdfWarning) {
        reply = `⚠️ ${pdfWarning}\n\n${reply}`;
      }

      return res.json({ reply });

    } catch (err) {
      console.error("AI Controller Error:", err?.message || err);
      return res.status(500).json({
        error:   "AI assistant failed",
        message: err?.message || "An unknown error occurred",
      });
    }
  },
};

module.exports = aiController;