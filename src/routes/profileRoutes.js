const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const profileController = require("../controllers/profileController");
const { authenticateToken } = require("../middleware/authMiddleware");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, req.user.userId + "-" + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

router.get("/:userId", authenticateToken, profileController.getProfile);
router.put("/", authenticateToken, profileController.updateProfile);
router.post("/image/:userId", authenticateToken, upload.single("profileImage"), profileController.uploadProfileImage);

module.exports = router;
