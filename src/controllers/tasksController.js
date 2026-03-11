const {
  getAllTasks,
  getTaskById,
} = require("../models/tasks");

// GET all tasks
const fetchAllTasks = async (req, res) => {
  try {
    const tasks = await getAllTasks();
    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// GET service by id
const fetchTasksById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await getTaskById(id);

    if (!task) {
      return res.status(404).json("Task not found");
    }

    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

module.exports = {
  fetchAllTasks,
  fetchTasksById,
};
