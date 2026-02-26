const express = require("express");
const router = express.Router();
const { signupClient, signupProvider, login } = require("../controllers/auth");

router.post("/signup-client", signupClient);
router.post("/signup-provider", signupProvider);
router.post("/login", login);

module.exports = router;
