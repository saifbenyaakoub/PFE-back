const express = require("express");
const router = express.Router();
const reviewsController = require("../controllers/reviewsController");
const { authenticateToken } = require('../middleware/authMiddleware');

router.get("/provider/:userId",authenticateToken, reviewsController.getProviderReviews);

router.get("/summary/:userId",authenticateToken, reviewsController.getRatingSummary);
 
router.post("/",authenticateToken, reviewsController.submitReview);

module.exports = router;