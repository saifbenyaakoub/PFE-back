const pool = require("../../db");

exports.getProfile = async (req, res) => {
 

    const {userId}=req.params;
    try {
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

   
        const result = await pool.query("SELECT id, name, email, role,profile_image FROM users WHERE id = $1", [userId]);
      
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = result.rows[0];
        let profileData = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileImage: user.profile_image ? `http://localhost:5000/uploads/${user.profile_image}` : null
        };

        switch (user.role) {
            case 'client':
                const clientResult = await pool.query("SELECT city FROM clients WHERE user_id = $1", [userId]);
                if (clientResult.rows.length > 0) {
                    Object.assign(profileData, clientResult.rows[0]);
                }
                break;
            case 'provider':
                const providerResult = await pool.query("SELECT city, service_category FROM providers WHERE user_id = $1", [userId]);
                if (providerResult.rows.length > 0) {
                    profileData.city = providerResult.rows[0].city;
                    profileData.categories = providerResult.rows[0].service_category ? providerResult.rows[0].service_category.split(', ') : [];
                }
                break;
        }

        res.json(profileData);
    } catch (error) {
        console.error("GET PROFILE ERROR:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
       const {userId}=req.params;
        console.log("🚀 ~ userId:", userId)
        const { name, email, city, categories,role } = req.body;
        console.log("🚀 ~ req.body:", req.body)

        await pool.query("UPDATE users SET name = $1, email = $2 WHERE id = $3", [name, email, userId]);

        switch (role) {
            case 'client':
                await pool.query("UPDATE clients SET city = $1 WHERE user_id = $2", [city, userId]);
                break;
            case 'provider':
                const categoryString = categories && categories.length > 0 ? categories.join(', ') : '';
                await pool.query("UPDATE providers SET city = $1, service_category = $2 WHERE user_id = $3", [city, categoryString, userId]);
                break;
        }

        res.status(200).json({ success: true, message: "Profile updated successfully" });
    } catch (error) {
        console.error("UPDATE PROFILE ERROR:", error.message, error.stack);
        res.status(500).json({ error: "Server error updating profile" });
    }
};

exports.uploadProfileImage = async (req, res) => {
    const { userId } = req.params;

    try {
        
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided" });
        }

        const filename = req.file.filename;

    const resultQuery=    await pool.query(
            "UPDATE users SET profile_image = $1 WHERE id = $2",
            [filename, userId]
        );
    console.log("🚀 ~ resultQuery:", resultQuery.rowCount)
if(resultQuery.rowCount>0)
      {
        const result ={
            success: true,
            imageUrl: `http://localhost:5000/uploads/${filename}`
        }
        console.log("🚀 ~ result:", result)
        res.status(200).json(result);}else{
            res.status(403).json({ error: "there is an error" }); 
        }
    } catch (error) {
        console.log(error)
        console.error("UPLOAD PROFILE IMAGE ERROR:", error);
        res.status(500).json({ error: "Server error uploading image" });
    }
};
