const AdminModel = require("../models/admin");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/apiError");

exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await AdminModel.getAllUsers();
  res.status(200).json({
    status: "success",
    results: users.length,
    data: users
  });
});
exports.deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!id) return next(new ApiError("User ID is required", 400));
    await AdminModel.deleteUser(id);
    res.status(200).json({
      status: "success",
      message: "User deleted successfully"
    });
});


exports.getTasks = catchAsync(async (req, res) => {
  const tasks = await AdminModel.getAllTasks();
  res.status(200).json({
    status: "success",
    results: tasks.length,
    data: tasks
  });
});

exports.deleteTask = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!id) return next(new ApiError("Task ID is required", 400));
  
  await AdminModel.deleteTask(id);
  res.status(200).json({
    status: "success",
    message: "Task deleted successfully"
  });
});

exports.getServices = catchAsync(async (req, res) => {
  const services = await AdminModel.getAllServices();
  res.status(200).json({
    status: "success",
    results: services.length,
    data: services
  });
});

exports.deleteService = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!id) return next(new ApiError("Service ID is required", 400));

  await AdminModel.deleteService(id);
  res.status(200).json({
    status: "success",
    message: "Service deleted successfully"
  });
});