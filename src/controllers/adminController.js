const AdminModel = require("../models/admin");

// ─── Users ────────────────────────────────────────────────────────────────────

exports.getAllUsers = async (req, res) => {
  try {
    const users = await AdminModel.getAllUsers();
    return res.json(users);
  } catch (err) {
    console.error("getAllUsers:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Empêcher l'admin de se supprimer lui-même
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    await AdminModel.deleteUser(id);
    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("deleteUser:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

exports.getTasks = async (req, res) => {
  try {
    const tasks = await AdminModel.getAllTasks();
    return res.json(tasks);
  } catch (err) {
    console.error("getTasks:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    await AdminModel.deleteTask(req.params.id);
    return res.json({ message: "Task deleted successfully" });
  } catch (err) {
    console.error("deleteTask:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Services ─────────────────────────────────────────────────────────────────

exports.getServices = async (req, res) => {
  try {
    const services = await AdminModel.getAllServices();
    return res.json(services);
  } catch (err) {
    console.error("getServices:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteService = async (req, res) => {
  try {
    await AdminModel.deleteService(req.params.id);
    return res.json({ message: "Service deleted successfully" });
  } catch (err) {
    console.error("deleteService:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Reports ──────────────────────────────────────────────────────────────────

exports.getReports = async (req, res) => {
  try {
    const reports = await AdminModel.getAllReports();
    return res.json(reports);
  } catch (err) {
    console.error("getReports:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    await AdminModel.deleteReport(req.params.id);
    return res.json({ message: "Report deleted successfully" });
  } catch (err) {
    console.error("deleteReport:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};