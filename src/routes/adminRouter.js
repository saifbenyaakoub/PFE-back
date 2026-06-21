const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/authMiddleware");

// All admin routes are protected by authentication
router.use(authenticateToken);

// Users
router.get("/users",         adminController.getAllUsers);
router.delete("/users/:id",  adminController.deleteUser);

// Tasks
router.get("/tasks",         adminController.getTasks);
router.delete("/tasks/:id",  adminController.deleteTask);

// Services
router.get("/services",          adminController.getServices);
router.delete("/services/:id",   adminController.deleteService);

// ✅ Reports (ajoutés)
router.get("/reports",           adminController.getReports);
router.delete("/reports/:id",    adminController.deleteReport);

module.exports = router;