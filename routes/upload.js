const express = require('express');
const multer = require("multer");
const bucket = require("../public/js/firebase-config");

const router = express.Router();

// Multer 設置
const storage = multer.memoryStorage(); // 儲存到記憶體，方便直接上傳到 Firebase
const upload = multer({ storage });


/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});


// 影片上傳 API
router.post("/", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    // 設定上傳目錄和文件名
    const folderPath = "coding-bit"; // 指定資料夾名稱
    const filePath = `${folderPath}/${req.file.originalname}`; // 完整路徑

    // 指定存儲桶中的文件路徑
    const blob = bucket.file(filePath);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: req.file.mimetype,
    });

    blobStream.on("error", (err) => {
      console.error(err);
      res.status(500).send("Upload failed.");
    });

    blobStream.on("finish", async () => {
      // 設置文件為公開可讀
      await blob.makePublic();

      // 獲取文件公開 URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      res.status(200).send({ message: "Upload successful", url: publicUrl });
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    console.error(error);
    res.status(500).send("Something went wrong.");
  }
});


module.exports = router;
