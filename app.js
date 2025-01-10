const cookieParser = require('cookie-parser');
const createError = require('http-errors');
const express = require('express');
const logger = require('morgan');
const path = require('path');
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

// 載入環境變數（可選）
dotenv.config();
// dotenv.config({ path: './config.env' })

// 路由
const indexRouter = require('./routes/index');
const uploadRouter = require('./routes/upload');
const usersRouter = require('./routes/users');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static('node_modules'));

app.use('/', indexRouter);
app.use('/upload', uploadRouter);
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

app.all("*", (req, res) => {
  res.send(`找不到 ${req.originalUrl} 路徑`);
});

module.exports = app;
