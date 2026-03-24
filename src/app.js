require("dotenv").config();
const express = require("express");
const cors = require("cors");
const serviceRoutes = require("./routes/serviceRouter");
const tasksRoutes = require("./routes/tasksRouter");
const authRoutes = require("./auth");
const profileRoutes = require("./routes/profileRouter");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Use routes
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/services", serviceRoutes);
app.use("/tasks", tasksRoutes);

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
