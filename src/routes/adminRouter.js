const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/authMiddleware");

// All admin routes are protected by authentication
router.use(authenticateToken);

router.get("/users", adminController.getAllUsers);
router.delete("/users/:id", adminController.deleteUser);

router.get("/tasks", adminController.getTasks);
router.delete("/tasks/:id", adminController.deleteTask);

router.get("/services", adminController.getServices);
router.delete("/services/:id", adminController.deleteService);

module.exports = router;