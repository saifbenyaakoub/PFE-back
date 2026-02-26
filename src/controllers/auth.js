const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Client = require("../models/client");
const Provider = require("../models/provider");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

exports.signupClient = asyncHandler(async (req, res) => {
  const { name, email, password, city } = req.body;

  const existing = await User.findByEmail(email);
  if (existing) throw new ApiError(400, "Email already exists");

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.createUser(name, email, hashed, "client");
  await Client.createClient(user.id, city);

  const token = generateToken(user);
  res.status(201).json(new ApiResponse(201, { token, user }, "Client created successfully"));
});

exports.signupProvider = asyncHandler(async (req, res) => {
  const { name, email, password, city, serviceCategory } = req.body;

  const existing = await User.findByEmail(email);
  if (existing) throw new ApiError(400, "Email already exists");

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.createUser(name, email, hashed, "provider");
  await Provider.createProvider(user.id, serviceCategory, city);

  const token = generateToken(user);
  res.status(201).json(new ApiResponse(201, { token, user }, "Provider created successfully"));
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findByEmail(email);
  if (!user) throw new ApiError(400, "Invalid credentials");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new ApiError(400, "Invalid credentials");

  const token = generateToken(user);
  res.json(new ApiResponse(200, { token, user }, "Login successful"));
});

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  const { password, ...userProfile } = user;
  res.json(new ApiResponse(200, userProfile, "Profile fetched successfully"));
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, email, city, category, profileImage } = req.body;

  if (email) {
    const existingEmail = await User.findByEmail(email);
    if (existingEmail && existingEmail.id !== req.user.id) {
      throw new ApiError(400, "Email already in use");
    }
  }

  const updatedUser = await User.updateProfile(req.user.id, { name, email, city, category, profileImage }, req.user.role);
  res.json(new ApiResponse(200, updatedUser, "Profile updated successfully"));
});

exports.uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No image uploaded");
  }

  res.json(new ApiResponse(200, { imageUrl: `/uploads/${req.file.filename}` }, "Image uploaded successfully"));
});