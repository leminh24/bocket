const { poolPromise, sql } = require('../config/db');

const register = async (req, res) => {
    try {
        const { username, password, display_name } = req.body;
        const pool = await poolPromise;
        
        await pool.request()
            .input('user', sql.NVarChar, username)
            .input('pass', sql.NVarChar, password)
            .input('name', sql.NVarChar, display_name)
            .query('INSERT INTO Users (Username, Password, DisplayName) VALUES (@user, @pass, @name)');

        res.status(201).json({ message: "Đăng ký thành công!" });
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
            .input('pass', sql.NVarChar, password)
            .query('SELECT UserID, Username, DisplayName FROM Users WHERE Username = @user AND Password = @pass');

        if (result.recordset.length > 0) {
            res.json({ message: "Đăng nhập thành công", user: result.recordset[0] });
        } else {
            res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { register, login };