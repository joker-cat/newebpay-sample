const express = require('express');
const multer = require("multer");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const { Pool } = require("pg");
const path = require('path');
const bucket = require("../public/js/firebase-config");
const jwt = require('jsonwebtoken');


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

const router = express.Router();

// 設置 FFmpeg 路徑
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Multer 設置
const storage = multer.memoryStorage(); // 儲存到記憶體
const upload = multer({ storage });

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource');
});

// 影片壓縮函數
function compressVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")       // 使用 H.264 編碼，兼容性高
      .audioCodec("aac")           // 使用 AAC 音頻編碼，音質與壓縮比平衡
      .size("1280x720")            // 設定解析度為 720p（高清）
      .outputOptions("-preset", "fast") // 壓縮速度與效率的平衡（可選 slower 獲得更高壓縮比）
      .outputOptions("-crf", "23") // CRF 壓縮品質（建議 20-28，23 是較佳平衡點）
      .outputOptions("-b:a", "128k") // 音頻比特率，128 kbps 足以應對清晰語音
      .on("end", () => {
        console.log("Compression complete");
        resolve(outputPath);
      })
      .on("error", (err) => {
        console.error("Compression error:", err.message);
        reject(err);
      })
      .save(outputPath); // 壓縮後輸出路徑
  });
}




// 影片上傳 API
router.post("/video", upload.single("video"), async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = await jwt.verify(token, process.env.JWT_SECRET); // 解碼 token
    let { email } = decoded;
    if (!req.file) return res.status(400).send("No file uploaded.");
    const resultEmail = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (resultEmail.rows.length !== 1) throw new Error("查無使用者");

    // 取得使用者 email @ 之前的字串
    email = resultEmail.rows[0].email.split('@')[0];

    const ext = path.extname(req.file.originalname);// 取得副檔名
    const now = (() => Date.now())(); // 取得當前時間戳

    // 保存上傳的臨時檔案
    const inputPath = `./compressed/${req.file.originalname}`;
    const outputPath = `./compressed/${email + now + ext}`;
    
    // 將文件從 Buffer 寫入臨時文件
    fs.writeFileSync(inputPath, req.file.buffer);

    // 壓縮影片
    await compressVideo(inputPath, outputPath);

    // 設定 Firebase 上傳目錄和文件名
    const folderPath = "coding-bit"; // 指定資料夾名稱
    const filePath = `${folderPath}/compressed-${email + now + ext}`; // 完整路徑
    console.log(filePath);

    // 指定存儲桶中的文件路徑
    const blob = bucket.file(filePath);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: req.file.mimetype,
    });

    // 讀取壓縮後的文件並上傳
    const compressedFileBuffer = fs.readFileSync(outputPath);
    blobStream.on("error", (err) => {
      console.error(err);
      res.status(500).send("Upload failed.");
    });

    blobStream.on("finish", async () => {
      // 設置文件為公開可讀
      await blob.makePublic();

      // 獲取文件公開 URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

      // 清理臨時檔案
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);

      // 回應成功結果
      res.render('successUpload', {
        title: '影片預覽',
        src: publicUrl
      });
    });

    blobStream.end(compressedFileBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong.");
  }
});

module.exports = router;
