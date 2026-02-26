const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  uploadImage
} = require('../controllers/auth');

router.get('/', protect, getProfile);
router.put('/', protect, updateProfile);
router.post('/upload', protect, upload.single('image'), uploadImage);

module.exports = router;