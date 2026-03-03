require("dotenv").config();
const express = require("express");
const cors = require("cors");
const serviceRoutes = require("./router/serviceRouter"); // Make sure you have this router file
const tasksRoutes = require("./router/tasksRouter");

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

// Use routes
app.use("/services", serviceRoutes);
app.use("/tasks", tasksRoutes);

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
