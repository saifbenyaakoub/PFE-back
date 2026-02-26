const {
  getAllTasks,
  getTaskById,
} = require("../models/tasks");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

// GET all tasks
const fetchAllTasks = asyncHandler(async (req, res) => {
  const tasks = await getAllTasks();
  res.json(new ApiResponse(200, tasks, "Tasks fetched successfully"));
});

// GET task by id
const fetchTasksById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const task = await getTaskById(id);

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  res.json(new ApiResponse(200, task, "Task fetched successfully"));
});

module.exports = {
  fetchAllTasks,
  fetchTasksById,
};
