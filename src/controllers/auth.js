const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Client = require("../models/client");
const Provider = require("../models/provider");

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

exports.signupClient = async (req, res) => {
  try {
    const { fullName, email, password, city } = req.body;

    const existing = await User.findByEmail(email);
    if (existing) return res.status(400).json({ message: "Email exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.createUser(fullName, email, hashed, "client");

    await Client.createClient(user.id, city);

    const token = generateToken(user);

    res.status(201).json({ token, user });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.signupProvider = async (req, res) => {
  try {
    const { fullName, email, password, city, serviceCategory } = req.body;

    const existing = await User.findByEmail(email);
    if (existing) return res.status(400).json({ message: "Email exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.createUser(fullName, email, hashed, "provider");

    await Provider.createProvider(user.id, serviceCategory, city);

    const token = generateToken(user);

    res.status(201).json({ token, user });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user);

    res.json({ token, user });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};