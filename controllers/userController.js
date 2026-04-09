const { sql, poolPromise } = require('../config/db'); 

exports.getUserProfile = async (req, res) => {
    try {
        const pool = await poolPromise;

        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: "Không tìm thấy thông tin xác thực (userId)" });
        }

        const result = await pool.request()
            .input('userId', sql.Int, req.user.userId) 
            .query(`
                SELECT 
                    Username as username, 
                    AvatarURL as avatar, 
                    DisplayName as display_name, 
                    Email
                FROM Users 
                WHERE UserID = @userId
            `);

        const user = result.recordset[0];

        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng trong hệ thống" });
        }

        res.status(200).json(user);

    } catch (error) {
        console.error("❌ Lỗi getUserProfile:", error.message);
        res.status(500).json({ 
            message: "Lỗi hệ thống", 
            error: error.message 
        });
    }
};

// Hàm cập nhật thông tin cá nhân (DisplayName, Email, Avatar Base64)
exports.updateProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.userId;
        const { DisplayName, Email, AvatarURL, otp } = req.body; // Thêm otp từ body

        if (!userId) {
            return res.status(401).json({ message: "Không xác định được người dùng" });
        }

        // 1. Lấy thông tin hiện tại để so sánh email
        const userCurrent = await pool.request()
            .input('uid', sql.Int, userId)
            .query("SELECT Email FROM Users WHERE UserID = @uid");
        
        const oldEmail = userCurrent.recordset[0].Email;

        // 2. Kiểm tra nếu có thay đổi Email
        if (Email && Email.trim() !== "" && Email !== oldEmail) {
            if (!otp) {
                return res.status(400).json({ message: "Cần mã OTP để thay đổi Email" });
            }

            // Xác thực OTP (gửi về email cũ)
            const otpCheck = await pool.request()
                .input('email', sql.NVarChar, oldEmail)
                .input('otp', sql.Char, otp)
                .query(`
                    SELECT TOP 1 * FROM OtpCodes 
                    WHERE Email = @email AND OtpCode = @otp 
                    AND IsUsed = 0 AND CreatedAt > DATEADD(MINUTE, -5, GETDATE())
                `);

            if (otpCheck.recordset.length === 0) {
                return res.status(400).json({ message: "Mã OTP không đúng hoặc đã hết hạn" });
            }

            // Đánh dấu OTP đã dùng
            await pool.request()
                .input('id', sql.Int, otpCheck.recordset[0].Id)
                .query('UPDATE OtpCodes SET IsUsed = 1 WHERE Id = @id');
        }

        // 3. Tiến hành Update
        const request = pool.request()
            .input('uid', sql.Int, userId)
            .input('name', (DisplayName && DisplayName.trim() !== "") ? DisplayName : null)
            .input('mail', (Email && Email.trim() !== "") ? Email : null);

        let query = `
            UPDATE Users 
            SET DisplayName = COALESCE(@name, DisplayName), 
                Email = COALESCE(@mail, Email)`;

        if (AvatarURL && AvatarURL.trim() !== "") {
            request.input('avt', sql.NVarChar, AvatarURL);
            query += ", AvatarURL = @avt";
        }

        query += " WHERE UserID = @uid";
        await request.query(query);

        res.status(200).json({ message: "Cập nhật hồ sơ thành công!" });

    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
    }
};