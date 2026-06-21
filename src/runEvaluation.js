/**
 * FixHub AI Aggregated Evaluation Script (Groq Version)
 * Mock data now mirrors the real DB schema from aiController.js
 * Run with: node src/runEvaluation.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const Groq  = require("groq-sdk");
const weave = require("weave");

process.on("unhandledRejection", (reason) => {
  if (reason && typeof reason === "object" && typeof reason.json === "function") {
    reason.json().catch(() => {});
    return;
  }
  console.error("Unhandled Rejection:", reason);
  process.exit(1);
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ASSISTANT_MODEL = "llama-3.3-70b-versatile";
const JUDGE_MODEL     = "openai/gpt-oss-120b";

// ── 1. Test Dataset ──────────────────────────────────────────────────────────
const EVAL_DATASET = [
  { message: "I need a plumber in Tunis urgently",                                               expected_topics: ["plumber", "contact", "provider", "city"],   language: "en" },
  { message: "ما هو أفضل كهربائي في صفاقس؟",                                                   expected_topics: ["كهربائي", "صفاقس"],                          language: "ar" },
  { message: "J'ai reçu un devis de 500 TND pour repeindre mon appartement, c'est raisonnable?", expected_topics: ["devis", "peinture", "prix", "TND"],          language: "fr" },
  { message: "Compare the two quotes I received",                                                expected_topics: ["quote", "compare", "price", "provider"],     language: "en" },
  { message: "Who are the best rated providers?",                                                expected_topics: ["rating", "provider", "stars", "recommend"],  language: "en" },
  { message: "هل يمكنني الدفع بالتقسيط؟",                                                       expected_topics: ["دفع", "تقسيط"],                              language: "ar" },
  { message: "Comment annuler une réservation?",                                                 expected_topics: ["annuler", "réservation"],                    language: "fr" },
  { message: "I want to book a cleaning service for next week",                                  expected_topics: ["book", "cleaning", "service", "provider"],   language: "en" },
  { message: "What's the difference between Mohamed and Karim's services?",                      expected_topics: ["difference", "Mohamed", "Karim", "service"], language: "en" },
  { message: "أريد مقارنة التقييمات بين مزودي الخدمة",                                         expected_topics: ["تقييم", "مزود"],                             language: "ar" },
];

// ── 2. Realistic Mock Data (mirrors DB query output from aiController.js) ────
//
// Field names match exactly what the real SQL queries return:
//   bookings:    id, date, amount, status, service_name, service_category, provider_name, provider_city
//   quotations:  provider, service, total, status
//   providers:   provider_name, city, service_title, category, description, avg_rating, review_count
//
// No phone numbers here — the real DB doesn't return them either.

const MOCK_BOOKINGS = [
  {
    id:               1,
    date:             "2025-06-10",
    amount:           380,
    status:           "confirmed",
    service_name:     "Plumbing repair",
    service_category: "plumbing",
    provider_name:    "Karim Trabelsi",
    provider_city:    "Tunis",
  },
  {
    id:               2,
    date:             "2025-06-15",
    amount:           450,
    status:           "pending",
    service_name:     "Painting service",
    service_category: "painting",
    provider_name:    "Mohamed Ben Ali",
    provider_city:    "Tunis",
  },
  {
    id:               3,
    date:             "2025-06-20",
    amount:           120,
    status:           "completed",
    service_name:     "Cleaning service",
    service_category: "cleaning",
    provider_name:    "Fatima Zahra",
    provider_city:    "Tunis",
  },
  {
    id:               4,
    date:             "2025-06-25",
    amount:           200,
    status:           "confirmed",
    service_name:     "Electrical repair",
    service_category: "electrical",
    provider_name:    "Ali Mansour",
    provider_city:    "Sfax",
  },
];

const MOCK_QUOTATIONS = [
  { provider: "Mohamed Ben Ali", service: "Painting",   total: 450, status: "pending"  },
  { provider: "Karim Trabelsi",  service: "Plumbing",   total: 380, status: "accepted" },
  { provider: "Fatima Zahra",    service: "Cleaning",   total: 120, status: "accepted" },
  { provider: "Ali Mansour",     service: "Electrical", total: 200, status: "pending"  },
];

const MOCK_PROVIDERS = [
  {
    provider_name: "Fatima Zahra",
    city:          "Tunis",
    service_title: "Deep Cleaning Service",
    category:      "cleaning",
    description:   "Professional home and office deep cleaning with eco-friendly products.",
    avg_rating:    4.9,
    review_count:  42,
  },
  {
    provider_name: "Mohamed Ben Ali",
    city:          "Tunis",
    service_title: "Interior Painting",
    category:      "painting",
    description:   "High-quality interior and exterior painting with premium materials.",
    avg_rating:    4.8,
    review_count:  35,
  },
  {
    provider_name: "Ali Mansour",
    city:          "Sfax",
    service_title: "Electrical Installation & Repair",
    category:      "electrical",
    description:   "Certified electrician for all residential and commercial electrical work.",
    avg_rating:    4.7,
    review_count:  28,
  },
  {
    provider_name: "Karim Trabelsi",
    city:          "Tunis",
    service_title: "Plumbing & Pipe Repair",
    category:      "plumbing",
    description:   "Emergency and scheduled plumbing repairs, leak fixing, pipe installation.",
    avg_rating:    4.5,
    review_count:  19,
  },
  {
    provider_name: "Sana Mejri",
    city:          "Sousse",
    service_title: "Carpet & Upholstery Cleaning",
    category:      "cleaning",
    description:   "Specialist in carpet steam cleaning and upholstery restoration.",
    avg_rating:    4.6,
    review_count:  22,
  },
];

// ── 3. Shared system-prompt builder (copy from aiController.js) ──────────────
//
// This is the SAME function as in the real controller so the eval tests
// the exact prompt the production chatbot generates.

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
    "",
    "- To book a new service: browse providers above and contact them through the app.",
  ].join("\n");
}

// ── 4. Language detection (copy from aiController.js) ────────────────────────
function detectLanguage(text) {
  if (!text) return "en";
  const arPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  const frPattern = /\b(je|vous|le|la|les|est|pour|avec|une|des|oui|non|bonjour|merci|comment|pourquoi|quand|quel|quelle|annuler|r[ée]servation|devis|prix|appartement|peindre|tarif|prestataire)\b|[\u00C0-\u024F]/i;
  if (arPattern.test(text)) return "ar";
  if (frPattern.test(text)) return "fr";
  return "en";
}

// ── 5. Helper: unwrap Weave's nested argument structure ──────────────────────
function unwrapScorer(args) {
  const modelOutput = args.modelOutput || {};
  const datasetRow  = args.datasetRow  || {};
  return { modelOutput, datasetRow };
}

function unwrapModel(args) {
  const row = args.datasetRow || args || {};
  return {
    message:  row.message  ?? "",
    language: row.language ?? "en",
  };
}

// ── 6. Scorers ───────────────────────────────────────────────────────────────

const scoreRelevance = weave.op(async function scoreRelevance(args) {
  const { modelOutput, datasetRow } = unwrapScorer(args);
  const expected_topics = datasetRow.expected_topics ?? [];
  const reply           = modelOutput.reply ?? "";

  if (!reply) {
    console.warn("scoreRelevance: empty reply for:", datasetRow.message);
    return { relevance_score: 0 };
  }
  if (expected_topics.length === 0) return { relevance_score: 0 };

  const relevancePrompt =
    "You are an evaluation grader. Check if the AI assistant's reply covers the required topics.\n\n" +
    "Required topics (check for meaning or close synonyms): " + JSON.stringify(expected_topics) + "\n" +
    "AI Assistant Reply: \"" + reply + "\"\n\n" +
    "Count how many required topics are addressed (even indirectly or via synonyms).\n" +
    "Reply with ONLY valid JSON: { \"covered_count\": <integer>, \"reason\": \"<one sentence>\" }";

  try {
    const result = await groq.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [{ role: "user", content: relevancePrompt }],
      temperature: 0,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(result.choices[0].message.content.trim());
    const count  = Number(parsed.covered_count) || 0;
    return { relevance_score: Math.min(count / expected_topics.length, 1) };
  } catch (err) {
    console.error("scoreRelevance error:", err.message);
    return { relevance_score: 0 };
  }
});

const scoreLanguage = weave.op(async function scoreLanguage(args) {
  const { modelOutput, datasetRow } = unwrapScorer(args);
  const language = datasetRow.language;
  const reply    = modelOutput.reply ?? "";

  const arPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

  const frWords = [
    "je","vous","le","la","les","est","pour","avec","une","des","oui","non",
    "devis","bonjour","annuler","prix","service","prestataire","meilleur",
    "paiement","semaine","tarif","versement","noter","raisonnable",
    "reservation","appartement","peindre","difference","etoile",
  ];
  const frPattern = new RegExp("\\b(" + frWords.join("|") + ")\\b|[\u00C0-\u024F]", "i");

  const enWords = [
    "the","is","are","you","for","with","your","have","can",
    "book","cleaning","difference","provider","quote","rating",
    "stars","service","payment","cancel","installment","plumber",
    "recommend","compare","urgent","tunis","contact","best","between",
  ];
  const enPattern = new RegExp("\\b(" + enWords.join("|") + ")\\b", "i");

  let passed;
  if      (language === "ar") passed = arPattern.test(reply);
  else if (language === "fr") passed = frPattern.test(reply);
  else if (language === "en") passed = enPattern.test(reply);
  else                        passed = true;

  return { language_matched: passed ? 1 : 0 };
});

const scoreLLMJudge = weave.op(async function scoreLLMJudge(args) {
  const { modelOutput, datasetRow } = unwrapScorer(args);
  const message = datasetRow.message ?? "";
  const reply   = modelOutput.reply  ?? "";

  const judgePrompt =
    "You are evaluating an AI assistant for a Tunisian home services marketplace.\n\n" +
    "User message: \"" + message + "\"\n" +
    "AI reply: \"" + reply + "\"\n\n" +
    "Rate the reply 1-5:\n" +
    "1 = Completely unhelpful or wrong\n" +
    "3 = Partially helpful, missing key details\n" +
    "5 = Excellent, specific and actionable\n\n" +
    "Reply with ONLY valid JSON: { \"score\": <1-5>, \"reason\": \"<one sentence>\" }";

  try {
    const result = await groq.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [{ role: "user", content: judgePrompt }],
      temperature: 0,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(result.choices[0].message.content.trim());
    return { judge_rating: Number(parsed.score) || 0 };
  } catch (err) {
    console.error("scoreLLMJudge error:", err.message);
    return { judge_rating: 0 };
  }
});

// ── 7. Pipeline Model ─────────────────────────────────────────────────────────
//
// Now uses:
//   - detectLanguage()    — same function as aiController.js
//   - buildSystemPrompt() — same function as aiController.js
//   - MOCK_* data         — field names match real DB query output

const runFixHubPipeline = weave.op(async function runFixHubPipeline(args) {
  const { message, language: hintLanguage } = unwrapModel(args);

  if (!message) {
    console.error("runFixHubPipeline: empty message. Full args:", JSON.stringify(args));
    return { reply: "" };
  }

  // Use the same language detection as the real controller.
  // The dataset's `language` field is used only as a hint for the scorer;
  // detection here mirrors real runtime behaviour.
  const language     = detectLanguage(message);
  const systemPrompt = buildSystemPrompt(
    MOCK_BOOKINGS,
    MOCK_QUOTATIONS,
    MOCK_PROVIDERS,
    language,
  );

  const response = await groq.chat.completions.create({
    model: ASSISTANT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: message },
    ],
    temperature: 0.3,
  });

  return { reply: response.choices[0].message.content };
});

// ── 8. Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("Initializing Weave project context...");
  await weave.init("saifbenyaakoub-institut-superieur-d-informatique-et-math/fixhub-ai-backend");

  console.log("Starting unified evaluation session via Weave native runner...");

  const evaluation = new weave.Evaluation({
    dataset: EVAL_DATASET,
    scorers: [scoreRelevance, scoreLanguage, scoreLLMJudge],
  });

  const summary = await evaluation.evaluate({ model: runFixHubPipeline });

  console.log("\n══════════════════════════════════════");
  console.log("Evaluation Complete! Session Summary Metrics:");
  console.log(JSON.stringify(summary, null, 2));
  console.log("══════════════════════════════════════\n");

  await new Promise((r) => setTimeout(r, 4000));
  process.exit(0);
}

main().catch((err) => {
  console.error("Aggregated evaluation execution aborted:", err);
  process.exit(1);
});