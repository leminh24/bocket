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

exports.updateProfile = async (req, res) => {
    try {
        const pool = await poolPromise;
        const userId = req.user.userId;

        // 1. SỬA LỖI NHẬN BIẾN: Kiểm tra cả 2 trường hợp để không bị undefined
        const nameInput = req.body.display_name || req.body.DisplayName;
        const emailInput = req.body.email || req.body.Email;
        const avatarInput = req.body.avatar || req.body.AvatarURL;
        const otp = req.body.otp;

        console.log("--- DEBUG UPDATE ---");
        console.log("UserID:", userId);
        console.log("Email mới nhận được:", emailInput);
        console.log("OTP nhận được:", otp);

        if (!userId) return res.status(401).json({ message: "Không xác định được người dùng" });

        // 2. Lấy email cũ để kiểm tra
        const userResult = await pool.request()
            .input('uid', sql.Int, userId)
            .query("SELECT Email FROM Users WHERE UserID = @uid");
        
        const oldEmail = userResult.recordset[0].Email;

        // 3. Logic kiểm tra OTP khi đổi Email (giữ nguyên logic của bạn nhưng dùng emailInput)
        if (emailInput && emailInput.trim() !== "" && emailInput !== oldEmail) {
            if (!otp) return res.status(400).json({ message: "Cần mã OTP để thay đổi Email" });

            const otpCheck = await pool.request()
                .input('email', sql.NVarChar, oldEmail)
                .input('otp', sql.Char, otp)
                .query(`SELECT TOP 1 * FROM OtpCodes WHERE Email = @email AND OtpCode = @otp AND IsUsed = 0`);

            if (otpCheck.recordset.length === 0) {
                return res.status(400).json({ message: "Mã OTP không đúng hoặc hết hạn" });
            }
            // Đánh dấu OTP đã dùng...
        }

        // 4. THỰC HIỆN UPDATE
        const request = pool.request()
            .input('uid', sql.Int, userId)
            .input('name', (nameInput && nameInput.trim() !== "") ? nameInput : null)
            .input('mail', (emailInput && emailInput.trim() !== "") ? emailInput : null);

        let query = `
            UPDATE Users 
            SET DisplayName = COALESCE(@name, DisplayName), 
                Email = COALESCE(@mail, Email)`;

        if (avatarInput && avatarInput.trim() !== "") {
            request.input('avt', sql.NVarChar(sql.MAX), avatarInput);
            query += ", AvatarURL = @avt";
        }

        query += " WHERE UserID = @uid";
        
        const result = await request.query(query);
        
        console.log("Rows affected:", result.rowsAffected);
        res.status(200).json({ message: "Cập nhật thành công!" });

    } catch (error) {
        console.error("Lỗi:", error.message);
        res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
    }
};