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

// DELETE /tasks/:taskId
//
// Client cancels their own posted task — hard delete, matching the warning
// shown on the frontend ("you will no longer be able to follow this task").
//
// If the task has an active booking (confirmed or in-progress), that
// booking is deleted first — same effect as cancelActiveBooking in
// bookingsController.js, just triggered from the task side instead of the
// booking side. A completed booking blocks task deletion entirely, since
// that history shouldn't silently disappear from under a finished job.
//
// FIX: the original version read `const { userId } = req.user`, but
// authenticateToken normalizes the JWT payload to req.user.id (not
// req.user.userId) — so that lookup was always undefined and this endpoint
// could never have worked. Also added the booking cascade-delete, since
// bookings.task_id has no ON DELETE clause and would otherwise block this
// DELETE with a foreign key violation whenever a booking exists.
const deleteTask = catchAsync(async (req, res, next) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  const clientRes = await pool.query('SELECT id FROM clients WHERE user_id = $1', [userId]);
  const clientId = clientRes.rows[0]?.id;
  if (!clientId) {
    return next(new ApiError('Client profile not found', 404));
  }

  // Ownership check up front, before touching any booking.
  const taskRes = await pool.query(
    'SELECT id, client_id FROM tasks WHERE id = $1',
    [taskId]
  );
  if (taskRes.rows.length === 0) {
    return next(new ApiError('Tâche non trouvée', 404));
  }
  if (Number(taskRes.rows[0].client_id) !== Number(clientId)) {
    return next(new ApiError("Vous n'êtes pas autorisé à supprimer cette tâche", 403));
  }

  const bookingRes = await pool.query(
    'SELECT id, status FROM bookings WHERE task_id = $1',
    [taskId]
  );
  const booking = bookingRes.rows[0];

  if (booking) {
    if (booking.status === 'completed') {
      return next(new ApiError(
        'Impossible de supprimer une tâche dont la réservation est terminée',
        400
      ));
    }
    await pool.query('DELETE FROM bookings WHERE id = $1', [booking.id]);
  }

  const result = await pool.query(
    'DELETE FROM tasks WHERE id = $1 AND client_id = $2 RETURNING *',
    [taskId, clientId]
  );

  if (result.rowCount === 0) {
    return next(new ApiError('Tâche non trouvée ou non autorisée', 404));
  }

  res.status(200).json({ status: 'success', message: 'Tâche supprimée' });
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