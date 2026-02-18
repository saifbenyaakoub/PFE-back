const express = require("express");
const cors = require("cors");

const serviceRoutes = require("./router/serviceRouter");

const app = express();

app.use(cors());
app.use(express.json());

// Use routes
app.use("/services", serviceRoutes);
app.use("/tasks", require("./router/tasksRouter"));

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
