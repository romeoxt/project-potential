const express = require('express');
const bcrypt = require('bcrypt');
const Book = require('../src/models/Book');
const { query } = require('../src/services/postgres');

const router = express.Router();

// keep these in sync with whatever the seed script uses
const CATEGORIES = ['Fiction', 'Programming', 'Philosophy', 'Self Help', 'Science', 'Design', 'History', 'Systems'];

function adminOnly(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/admin/login');
  }
  if (!req.session.user.isAdmin) {
    return res.status(403).send('admin only');
  }
  next();
}


// ---- auth ----

router.get('/login', function(req, res) {
  if (req.session && req.session.user && req.session.user.isAdmin) {
    return res.redirect('/admin/books');
  }
  res.render('admin/login', { title: 'Admin Login' });
});

router.post('/login', async function(req, res) {
  try {
    const { username, password } = req.body;
    const result = await query(
      'SELECT id, username, password_hash, is_admin FROM users WHERE username = $1',
      [username]
    );

    if (!result.rows.length) {
      return res.render('admin/login', { title: 'Admin Login', error: 'Invalid credentials' });
    }

    let user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid || !user.is_admin) {
      return res.render('admin/login', { title: 'Admin Login', error: 'Invalid credentials' });
    }

    req.session.user = { id: user.id, username: user.username, isAdmin: user.is_admin };
    res.redirect('/admin/books');
  } catch (err) {
    console.error(err);
    res.render('admin/login', { title: 'Admin Login', error: 'Something went wrong' });
  }
});

router.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/admin/login');
  });
});


// ---- books list ----

router.get('/', adminOnly, function(req, res) {
  res.redirect('/admin/books');
});

router.get('/books', adminOnly, async function(req, res, next) {
  try {
    let { search, category, page } = req.query;
    let pageNum = parseInt(page) || 1;
    if (pageNum < 1) pageNum = 1;
    const limit = 15;

    let filter = {};
    if (category) filter.category = category;
    if (search) {
      let regex = new RegExp(search, 'i');
      filter.$or = [{ title: regex }, { author: regex }, { isbn: regex }];
    }

    const total = await Book.countDocuments(filter);
    let totalPages = Math.ceil(total / limit) || 1;
    const books = await Book.find(filter)
      .sort({ added_at: -1 })
      .skip((pageNum - 1) * limit)
      .limit(limit)
      .lean();

    // grab collection names from postgres so we can show who owns what
    let collectionIds = books.map(function(b) { return b.collection_id; }).filter(Boolean);
    let collectionMap = {};
    if (collectionIds.length) {
      const colResult = await query(
        'SELECT uc.id, uc.name, u.username FROM user_collections uc JOIN users u ON u.id = uc.user_id WHERE uc.id = ANY($1)',
        [collectionIds]
      );
      colResult.rows.forEach(function(r) {
        collectionMap[r.id] = r.name + ' (' + r.username + ')';
      });
    }

    books.forEach(function(book) {
      book.collectionName = collectionMap[book.collection_id] || 'unknown';
      book.reviewCount = book.reviews ? book.reviews.length : 0;
    });

    // mark selected category for the dropdown
    let cats = CATEGORIES.map(function(c) {
      return { name: c, selected: c === category };
    });

    res.render('admin/books', {
      title: 'Books',
      books,
      search: search || '',
      category: category || '',
      categories: cats,
      page: pageNum,
      totalPages,
      total,
      hasPrev: pageNum > 1,
      hasNext: pageNum < totalPages,
      prevPage: pageNum - 1,
      nextPage: pageNum + 1,
      showNav: true
    });
  } catch (err) {
    next(err);
  }
});


// ---- add ----

router.get('/books/add', adminOnly, async function(req, res, next) {
  try {
    const result = await query(
      'SELECT uc.id, uc.name, u.username FROM user_collections uc JOIN users u ON u.id = uc.user_id ORDER BY uc.name'
    );
    res.render('admin/add', {
      title: 'Add Book',
      categories: CATEGORIES.map(function(c) { return { name: c }; }),
      collections: result.rows,
      showNav: true
    });
  } catch (err) {
    next(err);
  }
});

router.post('/books/add', adminOnly, async function(req, res, next) {
  try {
    let { title, author, isbn, category, collection_id } = req.body;

    // quick validation, the api has joi but didnt feel like importing it here
    if (!title || !author || !isbn || !category || !collection_id) {
      const colResult = await query(
        'SELECT uc.id, uc.name, u.username FROM user_collections uc JOIN users u ON u.id = uc.user_id ORDER BY uc.name'
      );
      return res.render('admin/add', {
        title: 'Add Book',
        categories: CATEGORIES.map(function(c) { return { name: c, selected: c === category }; }),
        collections: colResult.rows,
        error: 'all fields required',
        form: req.body,
        showNav: true
      });
    }

    await Book.create({
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim(),
      category,
      collection_id: Number(collection_id)
    });

    res.redirect('/admin/books');
  } catch (err) {
    next(err);
  }
});


// ---- edit ----

router.get('/books/:id/edit', adminOnly, async function(req, res, next) {
  try {
    const book = await Book.findById(req.params.id).lean();
    if (!book) return res.redirect('/admin/books');

    const colResult = await query(
      'SELECT uc.id, uc.name, u.username FROM user_collections uc JOIN users u ON u.id = uc.user_id ORDER BY uc.name'
    );

    res.render('admin/edit', {
      title: 'Edit Book',
      book,
      categories: CATEGORIES.map(function(c) { return { name: c, selected: c === book.category }; }),
      collections: colResult.rows.map(function(c) {
        return { id: c.id, name: c.name, username: c.username, selected: c.id === book.collection_id };
      }),
      showNav: true
    });
  } catch (err) {
    next(err);
  }
});

router.post('/books/:id/edit', adminOnly, async function(req, res, next) {
  try {
    let { title, author, isbn, category, collection_id } = req.body;

    if (!title || !author || !isbn || !category) {
      const book = await Book.findById(req.params.id).lean();
      const colResult = await query(
        'SELECT uc.id, uc.name, u.username FROM user_collections uc JOIN users u ON u.id = uc.user_id ORDER BY uc.name'
      );
      return res.render('admin/edit', {
        title: 'Edit Book',
        book: Object.assign({}, book, req.body),
        categories: CATEGORIES.map(function(c) { return { name: c, selected: c === category }; }),
        collections: colResult.rows,
        error: 'all fields required',
        showNav: true
      });
    }

    // console.log('updating', req.params.id, req.body);
    await Book.findByIdAndUpdate(req.params.id, {
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim(),
      category,
      collection_id: Number(collection_id)
    });

    res.redirect('/admin/books');
  } catch (err) {
    next(err);
  }
});


// ---- delete ----

router.post('/books/:id/delete', adminOnly, async function(req, res) {
  try {
    await Book.findByIdAndDelete(req.params.id);
    res.redirect('/admin/books');
  } catch (err) {
    // not great but at least it doesnt crash
    console.error('delete failed:', err.message);
    res.redirect('/admin/books');
  }
});

module.exports = router;
