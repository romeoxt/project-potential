import React, { useEffect, useMemo, useRef, useState } from 'react';

// fetch wrapper, need credentials: include for the session cookie
async function fetchJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers
  });
  if (!res.ok) {
    const body = await res.json().catch(function handleJsonError() {
      return {};
    });
    const message = body.error || 'Request failed';
    throw new Error(message);
  }
  return res.json();
}

function ReviewForm(props) {
  const bookId = props.bookId;
  const onCreated = props.onCreated;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const ratingOptions = [5, 4, 3, 2, 1];

  function handleRatingChange(e) {
    setRating(Number(e.target.value));
  }

  function handleCommentChange(e) {
    setComment(e.target.value);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (comment.trim().length > 1000) {
      setError('Comment is too long.');
      return;
    }
    setSaving(true);
    try {
      await fetchJson(`/api/books/${bookId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: comment.trim() })
      });
      setComment('');
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderRatingOption(value) {
    return (
      <option key={value} value={value}>
        {value}
      </option>
    );
  }

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      <label>
        Rating
        <select value={rating} onChange={handleRatingChange}>
          {ratingOptions.map(renderRatingOption)}
        </select>
      </label>
      <label>
        Comment
        <textarea
          rows="2"
          value={comment}
          onChange={handleCommentChange}
          placeholder="Share your thoughts..."
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Add Review'}
      </button>
    </form>
  );
}

function Dropdown({ value, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(function closeOnOutsideClick() {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return function cleanup() {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  function handleToggle() {
    setOpen(!open);
  }

  function handleSelect(val) {
    onChange(val);
    setOpen(false);
  }

  return (
    <div
      className={'dropdown' + (open ? ' expanded' : '')}
      ref={dropRef}
      onClick={handleToggle}
    >
      <div className="dropdown-selected">{value || placeholder}</div>
      <div className="dropdown-options">
        <div
          className={'dropdown-option' + (!value ? ' active' : '')}
          onClick={function(e) { e.stopPropagation(); handleSelect(''); }}
        >
          {placeholder}
        </div>
        {options.map(function(opt) {
          return (
            <div
              key={opt}
              className={'dropdown-option' + (opt === value ? ' active' : '')}
              onClick={function(e) { e.stopPropagation(); handleSelect(opt); }}
            >
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [bookError, setBookError] = useState('');

  // *** only shows categories from whats loaded, not all
  const categories = useMemo(function buildCategories() {
    const unique = new Set(
      books.map(function pickCategory(book) {
        return book.category;
      })
    );
    return Array.from(unique);
  }, [books]);

  async function loadUser() {
    try {
      const data = await fetchJson('/api/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  // passing page directly bc setState doesnt update in time
  async function loadBooks(p) {
    const currentPage = p || page;
    setLoadingBooks(true);
    setBookError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (category) params.set('category', category);
      params.set('page', currentPage);

      const data = params.has('q') || params.has('category')
        ? await fetchJson(`/api/books/search?${params.toString()}`)
        : await fetchJson(`/api/books?${params.toString()}`);
      // console.log('loaded', data.books.length, 'books');
      setBooks(data.books);
      setTotalPages(data.totalPages);
    } catch (err) {
      setBookError(err.message);
    } finally {
      setLoadingBooks(false);
    }
  }

  useEffect(function loadOnStart() {
    loadUser();
  }, []);

  useEffect(function loadOnUser() {
    if (user) {
      loadBooks();
    }
  }, [user]);

  // tried auto searching on keystroke but it fires way too much
  // and the results come back out of order sometimes
  // useEffect(function() {
  //   if (user && (search || category)) {
  //     loadBooks(1);
  //   }
  // }, [search, category]);

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError('');
    try {
      const username = authForm.username.trim();
      const password = authForm.password;
      if (username.length < 3) {
        setAuthError('Username must be at least 3 characters.');
        return;
      }
      if (password.length < 8) {
        setAuthError('Password must be at least 8 characters.');
        return;
      }
      const data = await fetchJson(`/api/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setUser(data);
    } catch (err) {
      setAuthError(err.message);
    }
  }

  async function handleLogout() {
    await fetchJson('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setBooks([]);
  }

  function handleUsernameChange(e) {
    setAuthForm({ ...authForm, username: e.target.value });
  }

  function handlePasswordChange(e) {
    setAuthForm({ ...authForm, password: e.target.value });
  }

  function handleAuthModeToggle() {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  }

  function handleSearchChange(e) {
    setSearch(e.target.value);
  }

  // was just calling loadBooks() here before but it kept the old page number
  // so youd get empty results after paging then searching
  function handleApplyClick() {
    setPage(1);
    loadBooks(1);
  }

  const handleRefreshClick = () => loadBooks();

  function handlePrevPage() {
    const p = Math.max(1, page - 1);
    setPage(p);
    loadBooks(p);
  }

  function handleNextPage() {
    const p = Math.min(totalPages, page + 1);
    setPage(p);
    loadBooks(p);
  }

  function renderReview(review) {
    return (
      <li key={review._id}>
        <strong>{review.username}</strong> · {review.rating}/5
        {review.comment && <p>{review.comment}</p>}
      </li>
    );
  }

  function renderBook(book) {
    return (
      <article key={book._id} className="book-card">
        <div className="book-main">
          <h3>{book.title}</h3>
          <p className="meta">{book.author}</p>
          <p className="meta">ISBN: {book.isbn}</p>
          <span className="tag">{book.category}</span>
        </div>
        <div className="reviews">
          <h4>reviews</h4>
          {book.reviews?.length ? (
            <ul>{book.reviews.map(renderReview)}</ul>
          ) : (
            <p className="subtext">no reviews yet, be the first.</p>
          )}
        </div>
        <ReviewForm bookId={book._id} onCreated={loadBooks} />
      </article>
    );
  }

  if (authLoading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>my book shelf</h1>
          <p className="subtext">look around, search a bit, add thoughts when you want.</p>
        </div>
        {user && (
          <div className="user-pill">
            <span>{user.username}</span>
            <button className="link-button" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        )}
      </header>

      {!user ? (
        <section className="panel">
          <h2>{authMode === 'login' ? 'sign in' : 'create account'}</h2>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label>
              username
              <input
                type="text"
                value={authForm.username}
                onChange={handleUsernameChange}
                required
              />
            </label>
            <label>
              password
              <input
                type="password"
                value={authForm.password}
                onChange={handlePasswordChange}
                required
              />
            </label>
            {authError && <p className="error">{authError}</p>}
            <button type="submit">
              {authMode === 'login' ? 'sign in' : 'create account'}
            </button>
          </form>
          <button className="link-button" type="button" onClick={handleAuthModeToggle}>
            {authMode === 'login'
              ? "don't have an account? register"
              : 'already have an account? sign in'}
          </button>
        </section>
      ) : (
        <>
          <section className="panel filters">
            <div className="field">
              <label>search</label>
              <input
                type="text"
                placeholder="Title, author, maybe an ISBN"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
            <div className="field">
              <label>category</label>
              <Dropdown
                value={category}
                options={categories}
                placeholder="all categories"
                onChange={setCategory}
              />
            </div>
            <button type="button" onClick={handleApplyClick}>
              apply
            </button>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>books</h2>
              <button type="button" className="link-button" onClick={handleRefreshClick}>
                refresh
              </button>
            </div>
            {loadingBooks && <p>loading books...</p>}
            {bookError && <p className="error">{bookError}</p>}
            {!loadingBooks && books.length === 0 && <p>nothing here yet.</p>}
            <div className="book-grid">{books.map(renderBook)}</div>
            {totalPages > 1 && (
              <div className="pagination">
                <button type="button" disabled={page <= 1} onClick={handlePrevPage}>
                  prev
                </button>
                <span>{page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={handleNextPage}>
                  next
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default App;
