const express = require("express");
const router = express.Router();
const reviewsController = require("../controllers/reviewsController");
const { authenticateToken } = require('../middleware/authMiddleware');

router.get("/provider",authenticateToken, reviewsController.getProviderReviews);

router.get("/summary",authenticateToken, reviewsController.getRatingSummary);
 
router.post("/",authenticateToken, reviewsController.submitReview);

module.exports = router;