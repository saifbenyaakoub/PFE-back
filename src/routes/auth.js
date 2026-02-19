const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth");

router.post("/signup/client", controller.signupClient);
router.post("/signup/provider", controller.signupProvider);
router.post("/login", controller.login);

module.exports = router;