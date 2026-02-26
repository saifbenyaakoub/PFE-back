const express = require("express");
const router = express.Router();

const {
  fetchAllServices,
  fetchServiceById,
} = require("../controllers/serviceController");

router.get("/", fetchAllServices);
router.get("/:id", fetchServiceById);

module.exports = router;
