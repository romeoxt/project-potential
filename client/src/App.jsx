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
    <form className="reviewForm" onSubmit={handleSubmit}>
      <div className="row">
        <div>
          <span className="label">Rating</span>
          <select className="select" value={rating} onChange={handleRatingChange}>
            {ratingOptions.map(renderRatingOption)}
          </select>
        </div>
        <div style={{ flex: 3 }}>
          <span className="label">Comment</span>
          <input
            className="input"
            value={comment}
            onChange={handleCommentChange}
            placeholder="Share your thoughts..."
          />
        </div>
      </div>
      {error && <div className="alert alertError">{error}</div>}
      <div>
        <button className="btn btnPrimary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Add Review'}
        </button>
      </div>
    </form>
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
  // added overrides param later bc category clicks had the same stale state problem
  async function loadBooks(p, overrides) {
    const currentPage = p || page;
    const q = overrides && overrides.search !== undefined ? overrides.search : search;
    const cat = overrides && overrides.category !== undefined ? overrides.category : category;
    setLoadingBooks(true);
    setBookError('');
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (cat) params.set('category', cat);
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

  function handleCategoryChange(e) {
    setCategory(e.target.value);
  }

  // was just calling loadBooks() here before but it kept the old page number
  // so youd get empty results after paging then searching
  // also reset category on text search bc it was filtering and confusing
  function handleApplyClick() {
    setCategory('');
    setPage(1);
    loadBooks(1, { category: '' });
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

  function renderStars(rating) {
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < rating ? '★' : '☆';
    }
    return <span className="stars">{stars}</span>;
  }

  function renderBook(book) {
    const reviewCount = book.reviews?.length || 0;
    const avgRating = reviewCount > 0
      ? (book.reviews.reduce(function(sum, r) { return sum + r.rating; }, 0) / reviewCount).toFixed(1)
      : null;

    return (
      <div key={book._id} className="bookCard">
        <div className="bookHeader">
          <div className="bookInfo">
            <h3>{book.title}</h3>
            <p className="bookAuthor">by {book.author}</p>
          </div>
          <div className="bookSide">
            <span className="tag">{book.category}</span>
            {avgRating && (
              <div className="bookRating">
                {renderStars(Math.round(avgRating))}
                <span className="ratingNum">{avgRating}</span>
              </div>
            )}
          </div>
        </div>
        <div className="bookIsbn">ISBN {book.isbn}</div>

        <div className="reviewsSection">
          <div className="reviewsHeader">
            <h4>Reviews</h4>
            <span className="reviewCount">{reviewCount}</span>
          </div>
          {reviewCount > 0 ? (
            <ul className="reviewList">
              {book.reviews.map(function(review) {
                return (
                  <li key={review._id} className="reviewItem">
                    <div className="reviewTop">
                      <strong>{review.username}</strong>
                      {renderStars(review.rating)}
                    </div>
                    {review.comment && <p className="reviewComment">{review.comment}</p>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="subtle" style={{ fontSize: 13 }}>no reviews yet</p>
          )}
          <ReviewForm bookId={book._id} onCreated={loadBooks} />
        </div>
      </div>
    );
  }

  // topbar shows on all views
  function renderTopbar() {
    return (
      <div className="topbar">
        <div className="topbarInner">
          <span className="brand">book shelf</span>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="subtle">{user.username}</span>
              <button className="linkBtn" type="button" onClick={handleLogout}>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <>
        {renderTopbar()}
        <div className="authWrap"><p className="subtle">Loading...</p></div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        {renderTopbar()}
        <div className="authWrap">
          <div className="card authCard">
            <div className="h1">{authMode === 'login' ? 'Sign in' : 'Create account'}</div>
            <form onSubmit={handleAuthSubmit}>
              <div style={{ marginBottom: 12 }}>
                <span className="label">Username</span>
                <input
                  className="input"
                  type="text"
                  value={authForm.username}
                  onChange={handleUsernameChange}
                  placeholder="enter username"
                  required
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <span className="label">Password</span>
                <input
                  className="input"
                  type="password"
                  value={authForm.password}
                  onChange={handlePasswordChange}
                  placeholder="enter password"
                  required
                />
              </div>
              {authError && <div className="alert alertError" style={{ marginBottom: 12 }}>{authError}</div>}
              <button className="btn btnPrimary" type="submit" style={{ width: '100%' }}>
                {authMode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <div className="authToggle">
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button className="linkBtn" type="button" onClick={handleAuthModeToggle}>
                {authMode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {renderTopbar()}
      <div className="container">
        <div className="searchHero">
          <div className="glassBar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="What would you like to find today?"
              value={search}
              onChange={handleSearchChange}
              onKeyDown={function(e) { if (e.key === 'Enter') handleApplyClick(); }}
            />
          </div>

          {categories.length > 0 && (
            <div className="glassPanel">
              <div
                className={'glassPanelRow' + (category === '' ? ' active' : '')}
                onClick={function() { setCategory(''); setPage(1); loadBooks(1, { category: '' }); }}
              >
                <span>All Categories</span>
                <span className="rowIcons">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                </span>
              </div>
              {categories.map(function(cat) {
                return (
                  <div
                    key={cat}
                    className={'glassPanelRow' + (category === cat ? ' active' : '')}
                    onClick={function() { setCategory(cat); setPage(1); loadBooks(1, { category: cat }); }}
                  >
                    <span>{cat}</span>
                    <span className="rowIcons">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="searchActions">
            <button className="btn btnPrimary" type="button" onClick={handleApplyClick}>
              Search
            </button>
            <button className="btn" type="button" onClick={handleRefreshClick}>
              Refresh
            </button>
          </div>
        </div>

        <div className="sectionHead">
          <span className="h2">Books</span>
        </div>

        {loadingBooks && <p className="subtle">loading books...</p>}
        {bookError && <div className="alert alertError">{bookError}</div>}
        {!loadingBooks && books.length === 0 && <p className="subtle">Nothing here yet.</p>}

        <div className="bookGrid">{books.map(renderBook)}</div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn" type="button" disabled={page <= 1} onClick={handlePrevPage}>
              Prev
            </button>
            <span>{page} / {totalPages}</span>
            <button className="btn" type="button" disabled={page >= totalPages} onClick={handleNextPage}>
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
