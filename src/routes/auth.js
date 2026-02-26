const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth");
const validate = require("../middleware/validate");
const authValidation = require("../validations/authValidation");

router.post("/signup/client", validate(authValidation.signupClient), controller.signupClient);
router.post("/signup/provider", validate(authValidation.signupProvider), controller.signupProvider);
router.post("/signin", validate(authValidation.login), controller.login);

module.exports = router;