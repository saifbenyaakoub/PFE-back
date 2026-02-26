const pool = require("../config/db");

exports.findByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0];
};

exports.findById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

exports.createUser = async (name, email, password, role) => {
  const result = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, email, password, role]
  );
  return result.rows[0];
};

exports.updateProfile = async (id, data, role) => {
  const { name, email, city, category, profileImage } = data;

  // Update users table
  const userResult = await pool.query(
    `UPDATE users 
     SET name = COALESCE($1, name), 
         email = COALESCE($2, email),
         profile_image = COALESCE($3, profile_image)
     WHERE id = $4 
     RETURNING id, name, email, role, profile_image`,
    [name, email, profileImage, id]
  );

  if (userResult.rows.length === 0) throw new Error("User not found");

  // Update specific role tables if needed
  if (role === 'provider') {
    await pool.query(
      `UPDATE providers
        SET city = COALESCE($1, city),
            service_category = COALESCE($2, service_category)
        WHERE id = $3`,
      [city, category, id]
    );
  } else if (role === 'client') {
    await pool.query(
      `UPDATE clients
        SET city = COALESCE($1, city)
        WHERE id = $2`,
      [city, id]
    );
  }

  return userResult.rows[0];
};