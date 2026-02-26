const jwt = require("jsonwebtoken");
const User = require('../models/user');

exports.protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token, not authorized" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user without password
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Invalid user token" });

    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};