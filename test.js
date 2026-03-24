const pool = require("./db");
const clientModel = require("./src/models/client");
const bcrypt = require("bcrypt");

async function run() {
    try {
        const hashedPassword = await bcrypt.hash("TEST", 10);
        console.log("DB connecting...");
        const result = await pool.query(
            `INSERT INTO users (name, email, password, role)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            ["Test Client 5", "test12345@example.com", hashedPassword, "client"]
        );
        const user = result.rows[0];
        console.log("User created:", user);
        await clientModel.createClient(user.id, "Tunis");
        console.log("Client created!");
    } catch (err) {
        console.error("OH NO ERROR:", err);
    }
}
run();
