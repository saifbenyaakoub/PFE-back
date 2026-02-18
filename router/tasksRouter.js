const express = require("express");
const router = express.Router();

const {
  fetchAllTasks,
  fetchTasksById,
} = require("../controller/tasksController");

router.get("/", fetchAllTasks);
router.get("/:id", fetchTasksById);

module.exports = router;
