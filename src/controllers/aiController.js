const { GoogleGenerativeAI } = require("@google/generative-ai");
const pool = require("../../db");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
const aiController = {
  async chat(req, res) {
    try {
      const { message, userId } = req.body;
      if (!message || !userId)
        return res.status(400).json({ error: "message and userId required" });

      // ── Fetch client's bookings ──────────────────────────────────────────
      const bookingsRes = await pool.query(`
        SELECT
          b.id, b.date, b.amount, b.status,
          s.title        AS service_name,
          s.category     AS service_category,
          u.name         AS provider_name,
          p.city         AS provider_city
        FROM bookings b
        JOIN services  s ON s.id = b.service_id
        JOIN providers p ON p.id = s.provider_id
        JOIN users     u ON u.id = p.user_id
        WHERE b.client_id = $1
        ORDER BY b.created_at DESC
        LIMIT 10
      `, [userId]);

      // ── Fetch recent quotations from chat messages ────────────────────────
      const quotationsRes = await pool.query(`
        SELECT m.content, m.created_at, u.name AS provider_name
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        JOIN users u ON (
          CASE WHEN c.user1_id = $1 THEN u.id = c.user2_id
               ELSE u.id = c.user1_id END
        )
        WHERE (c.user1_id = $1 OR c.user2_id = $1)
          AND m.content LIKE '%"type":"quotation"%'
        ORDER BY m.created_at DESC
        LIMIT 5
      `, [userId]);

      // ── Fetch available providers ────────────────────────────────────────
     const providersRes = await pool.query(`
  SELECT
    u.name         AS provider_name,
    p.city,
    s.title        AS service_title,
    s.category,
    s.description,
    ROUND(AVG(r.rating), 1) AS avg_rating,
    COUNT(r.id)             AS review_count
  FROM providers p
  JOIN users    u ON u.id = p.user_id
  JOIN services s ON s.provider_id = p.id
  LEFT JOIN bookings b2 ON b2.service_id = s.id
  LEFT JOIN reviews  r  ON r.booking_id  = b2.id
  GROUP BY u.name, p.city, s.title, s.category, s.description
  ORDER BY avg_rating DESC NULLS LAST
  LIMIT 20
`);

      const bookings  = bookingsRes.rows;
      const providers = providersRes.rows;

      // Parse quotations safely
      const quotations = quotationsRes.rows.map(row => {
        try {
          const data = JSON.parse(row.content);
          return {
            provider: row.provider_name,
            date: row.created_at,
            items: data.items ?? [{ description: data.description, qty: 1, unitPrice: data.amount }],
            total: data.amount,
            status: data.status,
            duration: data.duration,
            startDate: data.startDate,
          };
        } catch { return null; }
      }).filter(Boolean);

      // ── Build Gemini prompt ──────────────────────────────────────────────
      const context = `
You are FixHub Assistant, an AI helper embedded in the FixHub platform — a home services marketplace in Tunisia.
You help clients by:
1. Recommending the best service providers based on their needs, location, ratings, and past bookings.
2. Explaining and analyzing quotations they have received (items, pricing, duration, fairness).
Always respond in the same language the user writes in (French, Arabic, or English).
Be concise, friendly, specific, and use the real data below. Never make up providers or prices.

═══ CLIENT BOOKING HISTORY ═══
${bookings.length > 0
  ? bookings.map(b =>
      `• ${b.service_name} (${b.service_category}) with ${b.provider_name} from ${b.provider_city} on ${b.date} — ${b.amount} TND — Status: ${b.status}`
    ).join('\n')
  : 'No bookings yet.'}

═══ RECENT QUOTATIONS RECEIVED ═══
${quotations.length > 0
  ? quotations.map(q => {
      const itemsList = q.items.map(it =>
        `    - ${it.description}: qty ${it.qty} × ${it.unitPrice} TND`
      ).join('\n');
      return `• From ${q.provider} | Status: ${q.status} | Total: ${q.total} TND | Start: ${q.startDate} | Duration: ${q.duration}\n${itemsList}`;
    }).join('\n\n')
  : 'No quotations yet.'}

═══ AVAILABLE PROVIDERS & SERVICES ═══
${providers.map(p =>
  `• ${p.provider_name} (${p.city}) — "${p.service_title}" [${p.category}] — ${p.avg_rating ?? 'No'} stars (${p.review_count} reviews) — ${(p.description ?? '').slice(0, 100)}`
).join('\n')}
      `.trim();

      const result = await model.generateContent(`${context}\n\nClient: ${message}`);
      const reply  = result.response.text();
      console.log("GEMINI_API_KEY loaded:", !!process.env.GEMINI_API_KEY);
console.log("KEY EXISTS:", !!process.env.GEMINI_API_KEY);
      res.json({ reply });
    } catch (err) {
      console.error("Gemini error:", err.message);
      res.status(500).json({ error: "AI assistant failed" });
    }
  }
};

module.exports = aiController;