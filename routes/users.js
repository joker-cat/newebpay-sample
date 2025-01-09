const express = require('express');
const bcrypt = require('bcryptjs');
const dotenv = require("dotenv");

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
});

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource');
});


// 測試 PostgreSQL 撈取資料
router.post('/signup', async function (req, res, next) {
  const { email, password } = req.body;

  // 雜湊加密(自動)
  const bcryptPassword = await bcrypt.hash(password, 12);

  // 雜湊加密(手動)
  // const salt = bcrypt.genSaltSync(10);
  // const hash = bcrypt.hashSync("B4c0/\/", salt);


  try {
    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2)",
      [email, bcryptPassword]
    );

    if (result.rowCount !== 1) throw new Error("註冊失敗");

    res.render('successSignup', {
      email, bcryptPassword
    });

  } catch (err) {
    // console.error(err);
    res.status(500).send(err.message);
  }
});



// 測試 PostgreSQL 撈取資料
router.get('/sql', async function (req, res, next) {
  try {
    const result = await pool.query("SELECT * FROM test_table");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


module.exports = router;
