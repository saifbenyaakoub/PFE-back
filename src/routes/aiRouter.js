const express = require("express");
const multer = require("multer"); // npm install multer (skip if already installed)
const router = express.Router();
const aiController = require("../controllers/aiController"); // adjust path to your actual file

// In-memory storage: we only need the buffer momentarily to extract text,
// we never need to persist the uploaded quotation PDF to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB cap, plenty for a text quotation PDF
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

// `upload.single("file")` makes this endpoint accept EITHER:
//   - a plain JSON POST (no file) — existing behavior, unchanged
//   - a multipart/form-data POST with a "file" field — new PDF upload path
// multer parses multipart fields onto req.body just like JSON did before,
// so aiController.chat doesn't need separate code paths for req.body access.
router.post("/chat", upload.single("file"), aiController.chat);
// Friendlier error message if multer rejects the file (wrong type / too big)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err?.message === "Only PDF files are allowed") {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;