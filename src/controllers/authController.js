const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/user");
const clientModel = require("../models/client");
const providerModel = require("../models/provider");

const JWT_SECRET = process.env.JWT_SECRET || "0123456789";

exports.signupClient = async (req, res) => {
    try {
        const { name, email, password, city } = req.body;

        const existingUser = await userModel.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: "Email already in use." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await userModel.createUser(name, email, hashedPassword, "client");
        await clientModel.createClient(user.id, city);

        const token = jwt.sign({ userId: user.id, email: user.email, role: "client" }, JWT_SECRET, { expiresIn: "10h" });

        res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: "client" } });
    } catch (error) {
        console.error("SIGNUP CLIENT ERROR:", error.message, error.stack);
        res.status(500).json({ error: "Server error during signup" });
    }
};

exports.signupProvider = async (req, res) => {
    try {
        const { name, email, password, serviceCategory, city } = req.body;

        const existingUser = await userModel.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: "Email already in use." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await userModel.createUser(name, email, hashedPassword, "provider");
        await providerModel.createProvider(user.id, serviceCategory, city);

        const token = jwt.sign({ userId: user.id, email: user.email, role: "provider" }, JWT_SECRET, { expiresIn: "10h" });

        res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: "provider" } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error during signup" });
    }
};

exports.signin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await userModel.findByEmail(email);
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid credentials." });
        }

        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "10h" });

        res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error during signin" });
    }
};
