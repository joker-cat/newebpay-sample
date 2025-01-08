const express = require('express');
const multer = require("multer");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');
const bucket = require("../public/js/firebase-config");

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
router.post("/", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    // 保存上傳的臨時檔案
    const inputPath = `./compressed/${req.file.originalname}`;
    const outputPath = `./compressed/compressed-${req.file.originalname}`;

    // 將文件從 Buffer 寫入臨時文件
    fs.writeFileSync(inputPath, req.file.buffer);

    // 壓縮影片
    const compressVideoResponse = await compressVideo(inputPath, outputPath);
    console.log(compressVideoResponse);

    // 設定 Firebase 上傳目錄和文件名
    const folderPath = "coding-bit"; // 指定資料夾名稱
    const filePath = `${folderPath}/compressed-${req.file.originalname}`; // 完整路徑
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
