const pool = require('../../db');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');

const getClientId = async (userId) => {
  const res = await pool.query('SELECT id FROM clients WHERE user_id = $1', [userId]);
  return res.rows[0]?.id ?? null;
};

const uploadTaskImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError('No image file provided', 400));
  }
  const image_url = `/uploads/tasks/${req.file.filename}`;
  res.status(200).json({ image_url });
});

const createTask = catchAsync(async (req, res, next) => {
  const { title, description, category, location } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ message: 'Description must be at least 10 characters' });
  }
  const clientId = await getClientId(req.user.id);
  if (!clientId) {
    return next(new ApiError('Client profile not found. Please complete your profile.', 404));
  }

  let image_url = null;
  if (req.file) {
    image_url = `/uploads/tasks/${req.file.filename}`;
  }

  const query = `
    INSERT INTO tasks (client_id, title, description, category, location, image_url, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    clientId,
    title,
    description,
    category || null,
    location || null,
    image_url,
    'open'
  ];

  const { rows } = await pool.query(query, values);

  res.status(201).json(rows[0]);
});

const deleteTask = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;
  const { userId } = req.user;

  const clientRes = await pool.query('SELECT id FROM clients WHERE user_id = $1', [userId]);
  const clientId = clientRes.rows[0].id;

  const result = await pool.query(
    'DELETE FROM tasks WHERE id = $1 AND client_id = $2 RETURNING *',
    [taskId, clientId]
  );

  if (result.rowCount === 0) {
    return next(new ApiError('Tâche non trouvée ou non autorisée', 404));
  }

  res.status(204).json({ status: 'success', data: null });
});
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
  createTask,
  deleteTask,
  uploadTaskImage,
};
