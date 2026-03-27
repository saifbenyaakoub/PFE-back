const jwt = require("jsonwebtoken");

exports.authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    jwt.verify(token, process.env.JWT_SECRET || "0123456789", (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        // Normalize: JWT uses "userId" but controllers expect "id"
        req.user = { ...decoded, id: decoded.userId || decoded.id };
        next();
    });
};
