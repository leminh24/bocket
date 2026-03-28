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

const nodemailer = require('nodemailer');

const sendEmailOTP = async (email, otp) => {
    // Ép kiểu email về string nếu lỡ truyền nhầm object, 
    // nhưng tốt nhất là sửa ở nơi gọi hàm (bước 2)
    console.log("Đang gửi OTP đến địa chỉ:", email); 

    if (!email || typeof email !== 'string') {
        console.error("LỖI: Email không hợp lệ hoặc bị trống!", email);
        return;
    }

    try {
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: '"BOCKET Admin" <no-reply@bocket.com>',
            to: email, // Ở đây phải là một chuỗi 'abc@gmail.com'
            subject: "Mã xác thực OTP của bạn",
            text: `Mã OTP của bạn là: ${otp}. Mã có hiệu lực trong 5 phút.`,
        });
        
        console.log("Đã gửi email thành công!");
    } catch (error) {
        console.error("Lỗi Nodemailer:", error.message);
    }
};

// Giả sử đây là hàm xử lý khi người dùng bấm gửi OTP
const handleRegister = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email là bắt buộc" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const pool = await poolPromise;

        // Lưu OTP vào Database (Vô hiệu hóa các mã cũ của email này trước khi lưu mã mới)
        await pool.request()
            .input('email', sql.NVarChar, email)
            .input('otp', sql.Char, otp)
            .query(`
                UPDATE OtpCodes SET IsUsed = 1 WHERE Email = @email;
                INSERT INTO OtpCodes (Email, OtpCode) VALUES (@email, @otp)
            `);

        // Gọi hàm gửi email đã viết trước đó
        await sendEmailOTP(email, otp);

        res.status(200).json({ message: "OTP đã được gửi đến email của bạn!" });
    } catch (error) {
        console.error("Lỗi handleRegister:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { register, login, sendEmailOTP, handleRegister };