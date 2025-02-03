const express = require('express');
const bcrypt = require('bcryptjs');
const dotenv = require("dotenv");
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { Sequelize, DataTypes } = require('sequelize');
// const { Pool } = require("pg");
const router = express.Router();

// 載入環境變數（可選）
dotenv.config();
// dotenv.config({ path: './config.env' })

// SSL
const isSSL = process.env.DB_SSL === "true";

// 建立資料庫連線（使用 MySQL）
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432, // PostgreSQL 預設 5432
  dialect: 'postgres',
  dialectOptions: isSSL
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
  logging: false, // 避免過多日誌輸出
});

// 定義資料表模型
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nickname: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true }, // unique 表示唯一
  password: { type: DataTypes.STRING, allowNull: false }
}, { timestamps: true });

// 測試連線
sequelize.authenticate()
  .then(() => console.log("✅ 連線成功！"))
  .catch(err => console.log("❌ 連線失敗：", err));


// 同步模型到資料庫，重啟會自動經由模型設定建立資料表
// sequelize.sync();

// 定義 Joi 驗證規則，並自訂錯誤訊息
const userSchema = Joi.object({
  nickname: Joi.string().min(3).max(30).required()
    .messages({
      "string.base": "❌ 暱稱必須是文字",
      "string.empty": "❌ 暱稱不可為空",
      "string.min": "❌ 暱稱至少需要 3 個字",
      "string.max": "❌ 暱稱最多 30 個字",
      "any.required": "❌ 暱稱是必填欄位"
    }),
  email: Joi.string().email().required()
    .messages({
      "string.email": "❌ 電子郵件格式錯誤",
      "any.required": "❌ 電子郵件是必填欄位"
    }),
  password: Joi.string().min(6).required()
    .messages({
      "string.min": "❌ 密碼至少需要 6 個字",
      "any.required": "❌ 密碼是必填欄位"
    }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().strip() // strip 只判斷是否與password相同，不會加入資料庫
    .messages({
      "any.only": "❌ 密碼與確認密碼不一致",
      "any.required": "❌ 確認密碼是必填欄位"
    })
});

// 測試註冊
router.post('/signup', async function (req, res, next) {
  const { nickname, email, password, confirmPassword } = req.body;

  // 進行驗證
  const { error, value } = userSchema.validate(
    { nickname, email, password, confirmPassword },
    { abortEarly: false }
  ); // abortEarly 這行讓 Joi 回傳所有錯誤，而不是遇到第一個錯誤就停止。

  if (error !== undefined) {
    const errors = error.details.map(err => err.message); // 取得所有錯誤訊息
    return res.status(400).json({ signupStatus: false, errors });
  }

  // 雜湊加密(自動)
  const bcryptPassword = await bcrypt.hash(password, 12);

  // 雜湊加密(手動)
  // const salt = bcrypt.genSaltSync(10);
  // const hash = bcrypt.hashSync("B4c0/\/", salt);

  try {
    const result = await User.create({ nickname, email, password: bcryptPassword });

    if (!result) throw new Error("註冊失敗");
    res.render('successSignup', {
      nickname, email
    });
  } catch (errors) {
    console.log(errors);

    res.status(400).json({ signupStatus: false, errors: errors.message });
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



// PostgreSQL 連接設置
// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: parseInt(process.env.DB_PORT, 10), //10進制轉換
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false }, // 雲端資料庫常需要 SSL
// });


// 測試連線
// pool.connect((err, client, release) => {
//   if (err) {
//     return console.error("Error acquiring client", err.stack);
//   }
//   console.log("Connected to the database");
//   release();
// });


// 新增使用者
// const result = await pool.query(
//   "INSERT INTO users (nickname, email, password) VALUES ($1, $2, $3)",
//   [nickname, email, bcryptPassword]
// );
