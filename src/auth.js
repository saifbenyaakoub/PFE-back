const express = require("express");
const router = express.Router();
const { signupClient, signupProvider, signupAdmin, signin } = require("./controllers/authController");

router.post("/signup/client", signupClient);
router.post("/signup/provider", signupProvider);
router.post("/signup/admin", signupAdmin);
router.post("/signin", signin);

module.exports = router;
