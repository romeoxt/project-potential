const createError = require('http-errors');
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const indexRouter = require('./routes/index');
const authRoutes = require('./src/routes/auth');
const bookRoutes = require('./src/routes/books');
const { requireAuth, requireAdmin } = require('./src/middleware/auth');
const { pool } = require('./src/services/postgres');

const app = express();

app.set('trust proxy', 1);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(helmet());
app.use(logger('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'user_sessions'
    }),
    name: 'book.sid',
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8 // 8 hrs, bumped up from 2 bc i kept getting logged out
    }
  })
);

app.use(express.static(path.join(__dirname, 'public')));

// api routes
app.use('/api/auth', authRoutes);
app.use('/api/books', requireAuth, bookRoutes);

// admin pages, auth is handled per route
app.use('/admin', indexRouter);

app.use(function apiErrorHandler(err, req, res, next) {
  if (req.originalUrl.indexOf('/api') !== 0) {
    return next(err);
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use('/api', function apiNotFound(req, res) {
  res.status(404).json({ error: 'Not found' });
});


// serve react build if it exists, vite handles this in dev
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', function serveReact(req, res, next) {
    if (req.originalUrl.indexOf('/admin') === 0 || req.originalUrl.indexOf('/api') === 0) {
      return next();
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// catch 404 and forward to error handler
app.use(function handleNotFound(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function handleError(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
