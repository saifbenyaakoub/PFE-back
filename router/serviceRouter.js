const express = require("express");
const router = express.Router();

const {
  fetchAllServices,
  fetchServiceById,
} = require("../controller/serviceController");

router.get("/", fetchAllServices);
router.get("/:id", fetchServiceById);

module.exports = router;
