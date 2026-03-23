const { poolPromise, sql } = require('../config/db');
const bcrypt = require('bcrypt'); // 1. Khai báo bcrypt
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
    try {
        const { username, password, display_name } = req.body;
        const pool = await poolPromise;

        // 2. Kiểm tra user tồn tại
        const checkUser = await pool.request()
            .input('user', sql.NVarChar, username)
            .query('SELECT * FROM Users WHERE Username = @user');

        if (checkUser.recordset.length > 0) {
            return res.status(400).json({ message: "Username đã tồn tại!" });
        }

        // 3. MÃ HÓA MẬT KHẨU (Hashing)
        // saltRounds = 10 là độ phức tạp tiêu chuẩn
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Lưu vào DB với mật khẩu ĐÃ MÃ HÓA
        await pool.request()
            .input('user', sql.NVarChar, username)
            .input('pass', sql.NVarChar, hashedPassword) // Lưu hashedPassword thay vì password
            .input('name', sql.NVarChar, display_name)
            .query('INSERT INTO Users (Username, Password, DisplayName) VALUES (@user, @pass, @name)');

        res.status(201).json({ message: "Đăng ký thành công và bảo mật mật khẩu!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const pool = await poolPromise;

        const result = await pool.request()
            .input('user', sql.NVarChar, username)
            .query('SELECT UserID, Username, Password, DisplayName FROM Users WHERE Username = @user');

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            const isMatch = await bcrypt.compare(password, user.Password);

            if (isMatch) {
                delete user.Password; // Xóa pass trước khi gửi về

                // 2. TẠO TOKEN KHI MẬT KHẨU ĐÚNG
                const token = jwt.sign(
                    { userId: user.UserID, username: user.Username }, // Thông tin gửi kèm trong vé
                    process.env.JWT_SECRET, // Chữ ký bí mật lấy từ .env
                    { expiresIn: '7d' } // Vé có hạn sử dụng 7 ngày
                );

                // 3. Trả về cả user và token
                res.json({ 
                    message: "Đăng nhập thành công", 
                    user: user,
                    token: token // Kèm theo vé thông hành
                });
            } else {
                res.status(401).json({ message: "Sai mật khẩu!" });
            }
        } else {
            res.status(401).json({ message: "Tài khoản không tồn tại!" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { register, login };