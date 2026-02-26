const {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
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

const createNewTask = async (req, res) => {
  try {
    const { title, description } = req.body;
    const newTask = await createTask(title, description);
    res.status(201).json(newTask);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

const updateExistingTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const updatedTask = await updateTask(id, title, description);
    if (!updatedTask) {
      return res.status(404).json("Task not found");
    }
    res.json(updatedTask);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

const deleteExistingTask = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteTask(id);
    res.json({ msg: "Task removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

module.exports = {
  fetchAllTasks,
  fetchTasksById,
  createNewTask,
  updateExistingTask,
  deleteExistingTask,
};
