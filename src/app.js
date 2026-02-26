require("dotenv").config();
const express = require("express");
const cors = require("cors");
const serviceRoutes = require("./routes/serviceRouter");
const tasksRoutes = require("./routes/tasksRouter");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Use routes
app.use("/services", serviceRoutes);
app.use("/tasks", tasksRoutes);

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
