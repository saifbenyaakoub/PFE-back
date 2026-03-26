const { getAllServices, getServiceById } = require("../models/service");

// Get all services
const fetchAllServices = async (req, res) => {
  try {
    const services = await getAllServices();
    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
};

// Get single service by ID
const fetchServiceById = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: "Invalid service ID" });
  }

  try {
    const service = await getServiceById(id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    res.json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch service" });
  }
};

module.exports = { fetchAllServices, fetchServiceById };