const express = require("express");
const cors = require("cors");
const path = require("path");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const serviceRoutes = require("./routes/serviceRouter");
const tasksRoutes = require("./routes/tasksRouter");
const profileRoutes = require("./routes/profileRoutes");

const app = express();


app.use(cors());
app.use(express.json());

app.use("/services", serviceRoutes);
app.use("/tasks", tasksRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);

app.use(errorHandler);

module.exports = app;
