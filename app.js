var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const multer = require("multer");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
// 載入環境變數（可選）
dotenv.config();

const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // 處理換行符
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
};

// 初始化 Firebase Admin
// const serviceAccount = require({type, project_id, private_key_id, private_key, client_email, client_id, auth_uri, token_uri, auth_provider_x509_cert_url, client_x509_cert_url, universe_domain});
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "joker-cat-coding.appspot.com", // 使用您的儲存桶名稱 // 修改為你的 Firebase Storage Bucket
});

// Firebase Storage
const bucket = admin.storage().bucket();


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const { log } = require('console');

// Multer 設置
const storage = multer.memoryStorage(); // 儲存到記憶體，方便直接上傳到 Firebase
const upload = multer({ storage });




var app = express();


// 上傳影片到 Firebase Storage
app.post("/upload", upload.single("video"), async (req, res) => {
  console.log(req.body);

  try {
    const data = req.body;
    console.log(data);
    const file = req.file;
    console.log(file);
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // 設置檔案名稱
    const fileName = `videos/${Date.now()}_${file.originalname}`;
    const blob = bucket.file(fileName);

    // 上傳檔案到 Firebase Storage
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on("error", (err) => {
      console.error("Error uploading to Firebase:", err);
      res.status(500).json({ message: "Upload failed", error: err.message });
    });

    blobStream.on("finish", async () => {
      // 獲取檔案的公開 URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      console.log("File uploaded successfully:", publicUrl);
      res.status(200).json({
        message: "File uploaded successfully",
        url: publicUrl,
      });
    });

    blobStream.end(file.buffer);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Unexpected error occurred", error: err.message });
  }
});





// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
