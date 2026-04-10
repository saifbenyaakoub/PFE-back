const express = require("express");
const router = express.Router();
const ctrl    = require('../controllers/tasksController');
const { authenticateToken } = require('../middleware/authMiddleware');


const multer  = require('multer');
const path    = require('path');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/tasks/'),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },           // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});
/*5dmet fristo*/
const {
  fetchAllTasks,
  fetchTasksById,
  createTask,
  uploadTaskImage
} = require("../controllers/tasksController");

router.get("/", fetchAllTasks);
router.get("/:id", fetchTasksById);
router.post('/upload-image', authenticateToken, upload.single('image'), ctrl.uploadTaskImage);

// tasksRouter.js
router.post('/', authenticateToken, upload.single('image'), ctrl.createTask);
module.exports = router;
