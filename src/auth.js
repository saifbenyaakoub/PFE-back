const express = require("express");
const router = express.Router();
const { signupClient, signupProvider, signin } = require("./controllers/authController");

router.post("/signup/client", signupClient);
router.post("/signup/provider", signupProvider);
router.post("/signin", signin);

module.exports = router;
