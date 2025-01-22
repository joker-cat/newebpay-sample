const express = require('express');
const bcrypt = require('bcryptjs');
const dotenv = require("dotenv");
const jwt = require('jsonwebtoken');

const { Pool } = require("pg");
const router = express.Router();

// 載入環境變數（可選）
dotenv.config();
// dotenv.config({ path: './config.env' })

// PostgreSQL 連接設置
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT, 10), //10進制轉換
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // 雲端資料庫常需要 SSL
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error acquiring client", err.stack);
  }
  console.log("Connected to the database");
  release();
});

// 測試註冊
router.post('/signup', async function (req, res, next) {
  const { nickname, email, password, confirmpassword } = req.body;
  if (nickname.trim() === "" ||
    email.trim() === "" ||
    password.trim() === "" ||
    confirmpassword.trim() === "") throw new Error("請填寫完整欄位資訊");
  if (password !== confirmpassword) throw new Error("密碼請確認一致");

  // 雜湊加密(自動)
  const bcryptPassword = await bcrypt.hash(password, 12);

  // 雜湊加密(手動)
  // const salt = bcrypt.genSaltSync(10);
  // const hash = bcrypt.hashSync("B4c0/\/", salt);

  try {
    const result = await pool.query(
      "INSERT INTO users (nickname, email, password) VALUES ($1, $2, $3)",
      [nickname, email, bcryptPassword]
    );

    if (result.rowCount !== 1) throw new Error("註冊失敗");
    res.render('successSignup', {
      nickname, email
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 測試登入
router.post('/login', async function (req, res, next) {
  const { email, password } = req.body;
  if (email.trim() === "" || password.trim() === "") throw new Error("請填寫完整欄位資訊");

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rowCount !== 1) throw new Error("帳號或密碼錯誤");

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) throw new Error("帳號或密碼錯誤");
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_DAY
    });
    // console.log(token);

    res.render('successLogin', {
      nickname: user.nickname,
      token
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 密碼找回
router.post('/forgot', async function (req, res, next) {
  console.log('forgot');

  const { email } = req.body;
  if (email.trim() === "") throw new Error("請填寫收件信箱");

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rowCount !== 1) throw new Error("請重新輸入收件信箱");
    console.log(result.rows[0].password);
    const email = result.rows[0].email;
    res.render('successforgot', {
      email
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
