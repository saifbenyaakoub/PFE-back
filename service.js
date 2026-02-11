const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// GET all services
app.get("/services", async (req, res) => {
  try {
    const allServices = await pool.query("SELECT * FROM services");
    res.json(allServices.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// GET a specific service
app.get("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const service = await pool.query("SELECT * FROM services WHERE id = $1", [id]);

    if (service.rows.length === 0) {
      return res.status(404).json("Service not found");
    }

    res.json(service.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
