const express = require('express');
const bcrypt = require('bcrypt');
const Joi = require('joi');

const { query } = require('../services/postgres');

const router = express.Router();

const SALT_ROUNDS = 10;

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(8).max(128).required()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

router.post('/register', async function register(req, res, next) {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const passwordHash = await bcrypt.hash(value.password, SALT_ROUNDS);
    const result = await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, is_admin',
      [value.username, passwordHash]
    );

    const user = result.rows[0];
    await query(
      'INSERT INTO user_collections (user_id, name) VALUES ($1, $2)',
      [user.id, 'My Collection']
    );

    req.session.user = { id: user.id, username: user.username, isAdmin: user.is_admin };

    res.status(201).json({ id: user.id, username: user.username, isAdmin: user.is_admin });
  } catch (err) {
    // 23505 = unique violation
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    return next(err);
  }
});

router.post('/login', async function login(req, res, next) {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const result = await query(
      'SELECT id, username, password_hash, is_admin FROM users WHERE username = $1',
      [value.username]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const row = result.rows[0];
    const matches = await bcrypt.compare(value.password, row.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = { id: row.id, username: row.username, isAdmin: row.is_admin };
    res.json({ id: row.id, username: row.username, isAdmin: row.is_admin });
  } catch (err) {
    return next(err);
  }
});

// **** regenerate session id on login
router.post('/logout', function logout(req, res) {
  req.session.destroy(function onDestroyed() {
    res.clearCookie('book.sid');
    res.json({ success: true });
  });
});

// session check
router.get('/me', function me(req, res) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json(req.session.user);
});

module.exports = router;
