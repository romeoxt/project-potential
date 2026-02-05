const express = require('express');
const Joi = require('joi');

const Book = require('../models/Book');
const { query } = require('../services/postgres');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// shared validation for create + update
const bookSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  author: Joi.string().min(1).max(200).required(),
  isbn: Joi.string().min(3).max(30).required(),
  category: Joi.string().min(1).max(100).required(),
  collection_id: Joi.number().integer().optional()
});

const reviewSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().max(1000).allow('').optional()
  // comment: Joi.string().min(1).max(1000).required()
});

async function getUserCollectionId(userId) {
  const result = await query(
    'SELECT id FROM user_collections WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
    [userId]
  );
  if (!result.rows.length) {
    return null;
  }
  return result.rows[0].id;
}

// paginated list
router.get('/', async function listBooks(req, res, next) {
  try {
    const { all, collectionId, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    let filter = {};

    if (req.session.user.isAdmin && all === 'true') {
      filter = {};
    } else if (req.session.user.isAdmin && collectionId) {
      filter = { collection_id: Number(collectionId) };
    } else {
      const collection_id = await getUserCollectionId(req.session.user.id);
      if (!collection_id) {
        return res.json({ books: [], page: 1, totalPages: 0, total: 0 });
      }
      filter = { collection_id };
    }

    const total = await Book.countDocuments(filter);
    const totalPages = Math.ceil(total / pageSize);
    const books = await Book.find(filter)
      .sort({ added_at: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean();

    res.json({ books, page: pageNum, totalPages, total });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async function searchBooks(req, res, next) {
  try {
    const { q, category, all, collectionId, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    let filter = {};

    if (req.session.user.isAdmin && all === 'true') {
      filter = {};
    } else if (req.session.user.isAdmin && collectionId) {
      filter = { collection_id: Number(collectionId) };
    } else {
      const collection_id = await getUserCollectionId(req.session.user.id);
      filter = { collection_id };
    }

    if (category) {
      filter.category = category;
    }

    if (q) {
      // **** switch to text index
      const regex = new RegExp(q, 'i');
      filter.$or = [{ title: regex }, { author: regex }, { isbn: regex }];
    }

    const total = await Book.countDocuments(filter);
    const totalPages = Math.ceil(total / pageSize);
    const books = await Book.find(filter)
      .sort({ added_at: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean();

    res.json({ books, page: pageNum, totalPages, total });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { value, error } = bookSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    let collection_id = value.collection_id;
    if (!collection_id) {
      collection_id = await getUserCollectionId(req.session.user.id);
    }

    const book = await Book.create({
      title: value.title,
      author: value.author,
      isbn: value.isbn,
      category: value.category,
      collection_id
    });

    res.status(201).json(book);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, async function updateBook(req, res, next) {
  try {
    const { value, error } = bookSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const updated = await Book.findByIdAndUpdate(
      req.params.id,
      {
        title: value.title,
        author: value.author,
        isbn: value.isbn,
        category: value.category,
        collection_id: value.collection_id
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async function deleteBook(req, res, next) {
  try {
    const removed = await Book.findByIdAndDelete(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// *** limit to one review per user per book
router.post('/:id/reviews', async function addReview(req, res, next) {
  try {
    const { value, error } = reviewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    book.reviews.push({
      userId: req.session.user.id,
      username: req.session.user.username,
      rating: value.rating,
      comment: value.comment || ''
    });

    await book.save();
    res.status(201).json(book);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
