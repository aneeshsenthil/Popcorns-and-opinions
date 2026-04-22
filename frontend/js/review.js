// ============================================================
//  review.js — Popcorn & Opinions
//  Fully wired to Supabase
//  Requires: supabase CDN + js/supabase.js before this file
// ============================================================

const API_KEY     = 'db536043007cfb075f36f62e669838a2';
const BASE_URL    = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w200';

// -----------------------------------------------------------
// STATE
// -----------------------------------------------------------
let selectedMovie  = null;
let selectedRating = 0;
let searchDebounce = null;
let currentUserId  = null;

// -----------------------------------------------------------
// DOM REFS
// -----------------------------------------------------------
const movieSearchInput = document.getElementById('movie-search');
const searchResults    = document.getElementById('search-results');
const selectedMovieDiv = document.getElementById('selected-movie');
const selectedPoster   = document.getElementById('selected-poster');
const selectedTitle    = document.getElementById('selected-title');
const selectedYear     = document.getElementById('selected-year');
const clearSelBtn      = document.getElementById('clear-selection');
const starBtns         = document.querySelectorAll('.star');
const starLabel        = document.getElementById('star-label');
const reviewTextarea   = document.getElementById('movie-review');
const charCount        = document.getElementById('char-count');
const formError        = document.getElementById('form-error');
const submitBtn        = document.getElementById('submit-review');
const reviewsContainer = document.getElementById('reviews-container');
const reviewsEmpty     = document.getElementById('reviews-empty');
const reviewsCountEl   = document.getElementById('reviews-count');
const reviewsSort      = document.getElementById('reviews-sort');
const clearReviewsBtn  = document.getElementById('clear-reviews-btn');
const confirmOverlay   = document.getElementById('confirm-overlay');
const confirmYes       = document.getElementById('confirm-yes');
const confirmNo        = document.getElementById('confirm-no');

// -----------------------------------------------------------
// TOAST
// -----------------------------------------------------------
let toastTimer;
function showToast(msg) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  toastTimer = setTimeout(() => t.remove(), 3000);
}

// -----------------------------------------------------------
// AUTH CHECK — redirect if not logged in
// -----------------------------------------------------------
async function checkAuth() {
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  return session.user.id;
}
// -----------------------------------------------------------
// SUPABASE: FETCH REVIEWS
// -----------------------------------------------------------
async function getReviews() {
  const { data, error } = await db
    .from('reviews')
    .select('*')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch reviews error:', error.message);
    return [];
  }
  return data || [];
}

// -----------------------------------------------------------
// SUPABASE: INSERT REVIEW
// -----------------------------------------------------------
async function insertReview(review) {
  const { data, error } = await db
    .from('reviews')
    .insert({
      user_id:     currentUserId,
      movie_id:    review.movieId,
      movie_title: review.movieTitle,
      poster_path: review.posterPath,
      release_year: review.releaseYear,
      rating:      review.rating,
      review_text: review.text,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// -----------------------------------------------------------
// SUPABASE: DELETE REVIEW
// -----------------------------------------------------------
async function deleteReviewFromDb(id) {
  const { error } = await db
    .from('reviews')
    .delete()
    .eq('id', id)
    .eq('user_id', currentUserId); // safety check

  if (error) throw error;
}

// -----------------------------------------------------------
// SUPABASE: DELETE ALL REVIEWS
// -----------------------------------------------------------
async function deleteAllReviews() {
  const { error } = await db
    .from('reviews')
    .delete()
    .eq('user_id', currentUserId);

  if (error) throw error;
}

// -----------------------------------------------------------
// MOVIE SEARCH
// -----------------------------------------------------------
movieSearchInput.addEventListener('input', () => {
  const query = movieSearchInput.value.trim();
  clearTimeout(searchDebounce);

  if (!query) { hideDropdown(); return; }

  searchResults.innerHTML = `
    <div class="search-item">
      <div class="search-item-info">
        <div class="search-item-title" style="color:#64748b;">Searching...</div>
      </div>
    </div>`;
  searchResults.classList.remove('hidden');

  searchDebounce = setTimeout(() => doSearch(query), 350);
});

async function doSearch(query) {
  try {
    const res  = await fetch(
      `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=en-US`
    );
    const data = await res.json();
    renderDropdown(data.results?.slice(0, 6) || []);
  } catch (err) {
    searchResults.innerHTML = `
      <div class="search-item">
        <div class="search-item-info">
          <div class="search-item-title" style="color:#fb7185;">Network error. Try again.</div>
        </div>
      </div>`;
  }
}

function renderDropdown(movies) {
  searchResults.innerHTML = '';

  if (!movies.length) {
    searchResults.innerHTML = `
      <div class="search-item">
        <div class="search-item-info">
          <div class="search-item-title" style="color:#64748b;">No results found.</div>
        </div>
      </div>`;
    searchResults.classList.remove('hidden');
    return;
  }

  movies.forEach(movie => {
    const item = document.createElement('div');
    item.className = 'search-item';
    const year = movie.release_date ? movie.release_date.slice(0, 4) : 'N/A';

    item.innerHTML = `
      ${movie.poster_path
        ? `<img src="${POSTER_BASE + movie.poster_path}" alt="${movie.title}" loading="lazy">`
        : `<div style="width:32px;height:48px;background:#0f172a;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">🎬</div>`
      }
      <div class="search-item-info">
        <div class="search-item-title">${movie.title}</div>
        <div class="search-item-year">${year}${movie.vote_average > 0 ? ` · ⭐ ${movie.vote_average.toFixed(1)}` : ''}</div>
      </div>
    `;

    item.addEventListener('mousedown', e => {
      e.preventDefault();
      selectMovie(movie);
    });

    searchResults.appendChild(item);
  });

  searchResults.classList.remove('hidden');
}

function hideDropdown() {
  searchResults.classList.add('hidden');
  searchResults.innerHTML = '';
}

document.addEventListener('click', e => {
  if (!movieSearchInput.contains(e.target) && !searchResults.contains(e.target)) {
    hideDropdown();
  }
});

movieSearchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') hideDropdown();
});

// -----------------------------------------------------------
// SELECT MOVIE
// -----------------------------------------------------------
function selectMovie(movie) {
  selectedMovie             = movie;
  const year                = movie.release_date ? movie.release_date.slice(0, 4) : 'N/A';
  selectedPoster.src        = movie.poster_path ? POSTER_BASE + movie.poster_path : 'images/no-poster.png';
  selectedTitle.textContent = movie.title;
  selectedYear.textContent  = year;
  selectedMovieDiv.classList.remove('hidden');
  hideDropdown();
  movieSearchInput.value = movie.title;
  hideFormError();
}

clearSelBtn.addEventListener('click', () => {
  selectedMovie = null;
  selectedMovieDiv.classList.add('hidden');
  movieSearchInput.value = '';
  hideDropdown();
});

// -----------------------------------------------------------
// STAR RATING
// -----------------------------------------------------------
const STAR_LABELS = [
  '', 'Terrible 😖', 'Bad 😞', 'Poor 😕', 'Below Average 😐', 'Average 🙂',
  'Decent 😊', 'Good 👍', 'Great 😃', 'Excellent 🤩', 'Masterpiece 🏆'
];

starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedRating = Number(btn.dataset.val);
    updateStars(selectedRating);
    starLabel.textContent = `${selectedRating}/10 — ${STAR_LABELS[selectedRating]}`;
    hideFormError();
  });
  btn.addEventListener('mouseenter', () => updateStars(Number(btn.dataset.val)));
  btn.addEventListener('mouseleave', () => updateStars(selectedRating));
});

function updateStars(val) {
  starBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.val) <= val));
}

// -----------------------------------------------------------
// CHAR COUNT
// -----------------------------------------------------------
const MAX_CHARS = 500;
reviewTextarea.addEventListener('input', () => {
  const len = reviewTextarea.value.length;
  charCount.textContent = `${len} / ${MAX_CHARS}`;
  charCount.className   = 'char-count' +
    (len > MAX_CHARS ? ' over' : len > MAX_CHARS * 0.8 ? ' warn' : '');
});

// -----------------------------------------------------------
// FORM ERROR
// -----------------------------------------------------------
function showFormError(msg) {
  formError.textContent = msg;
  formError.classList.remove('hidden');
}

function hideFormError() {
  formError.classList.add('hidden');
}

// -----------------------------------------------------------
// SUBMIT REVIEW
// -----------------------------------------------------------
submitBtn.addEventListener('click', async () => {
  hideFormError();

  if (!selectedMovie) {
    showFormError('Please search and select a movie first.');
    movieSearchInput.focus();
    return;
  }
  if (!selectedRating) {
    showFormError('Please give a star rating.');
    return;
  }
  if (reviewTextarea.value.length > MAX_CHARS) {
    showFormError(`Review must be under ${MAX_CHARS} characters.`);
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Saving...';

  try {
    await insertReview({
      movieId:    selectedMovie.id,
      movieTitle: selectedMovie.title,
      posterPath: selectedMovie.poster_path || null,
      releaseYear: selectedMovie.release_date?.slice(0, 4) || 'N/A',
      rating:     selectedRating,
      text:       reviewTextarea.value.trim(),
    });

    showToast(`✅ Review saved for "${selectedMovie.title}"!`);
    resetForm();
    await loadReviews();

  } catch (err) {
    showFormError('Failed to save review. Please try again.');
    console.error('Submit review error:', err);
  }

  submitBtn.disabled    = false;
  submitBtn.textContent = 'Submit Review';
});

function resetForm() {
  selectedMovie  = null;
  selectedRating = 0;
  selectedMovieDiv.classList.add('hidden');
  movieSearchInput.value   = '';
  reviewTextarea.value     = '';
  charCount.textContent    = '0 / 500';
  charCount.className      = 'char-count';
  starLabel.textContent    = 'Click to rate';
  updateStars(0);
  hideDropdown();
}

// -----------------------------------------------------------
// LOAD & RENDER REVIEWS
// -----------------------------------------------------------
function getSorted(reviews) {
  switch (reviewsSort.value) {
    case 'oldest':  return [...reviews].reverse();
    case 'highest': return [...reviews].sort((a, b) => b.rating - a.rating);
    case 'lowest':  return [...reviews].sort((a, b) => a.rating - b.rating);
    default:        return reviews; // newest first (Supabase already ordered)
  }
}

async function loadReviews() {
  reviewsContainer.innerHTML = '<p style="color:#64748b;padding:10px;">Loading...</p>';

  const all    = await getReviews();
  const sorted = getSorted(all);

  reviewsCountEl.textContent = `${all.length} review${all.length !== 1 ? 's' : ''}`;
  reviewsContainer.innerHTML = '';

  if (all.length === 0) {
    reviewsEmpty.style.display = 'block';
    return;
  }

  reviewsEmpty.style.display = 'none';

  sorted.forEach(review => {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.id        = `review-${review.id}`;

    let starsHtml = '';
    for (let i = 1; i <= 10; i++) {
      starsHtml += `<span class="${i <= review.rating ? 'lit' : ''}">★</span>`;
    }

    const posterHtml = review.poster_path
      ? `<img class="review-card-poster" src="${POSTER_BASE + review.poster_path}" alt="${review.movie_title}" loading="lazy">`
      : `<div class="review-card-poster-placeholder">🎬</div>`;

    // Format date from Supabase timestamp
    const dateStr = review.created_at
      ? new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

    card.innerHTML = `
      ${posterHtml}
      <div class="review-card-body">
        <div class="review-card-top">
          <div class="review-movie-name">
            ${review.movie_title}
            <span style="font-size:12px;color:#64748b;font-weight:400;">(${review.release_year || ''})</span>
          </div>
          <div class="review-card-actions">
            <button class="review-action-btn delete-btn" title="Delete">🗑</button>
          </div>
        </div>
        <div class="review-stars">
          ${starsHtml}
          <span class="review-rating-num">${review.rating}/10</span>
        </div>
        ${review.review_text ? `<p class="review-text">"${review.review_text}"</p>` : ''}
        <div class="review-date">📅 ${dateStr}</div>
      </div>
    `;

    card.querySelector('.delete-btn').addEventListener('click', async () => {
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity    = '0';
      card.style.transform  = 'translateX(30px)';
      setTimeout(async () => {
        await deleteReview(review.id);
      }, 280);
    });

    reviewsContainer.appendChild(card);
  });
}

async function deleteReview(id) {
  try {
    await deleteReviewFromDb(id);
    showToast('🗑 Review deleted');
    await loadReviews();
  } catch (err) {
    showToast('❌ Failed to delete. Try again.');
    console.error('Delete review error:', err);
    await loadReviews(); // re-render to restore card
  }
}

// -----------------------------------------------------------
// SORT
// -----------------------------------------------------------
reviewsSort.addEventListener('change', loadReviews);

// -----------------------------------------------------------
// CLEAR ALL
// -----------------------------------------------------------
clearReviewsBtn.addEventListener('click', async () => {
  const all = await getReviews();
  if (all.length === 0) { showToast('No reviews to clear.'); return; }
  confirmOverlay.classList.remove('hidden');
});

confirmYes.addEventListener('click', async () => {
  try {
    await deleteAllReviews();
    await loadReviews();
    confirmOverlay.classList.add('hidden');
    showToast('🗑 All reviews cleared');
  } catch (err) {
    showToast('❌ Failed to clear. Try again.');
    confirmOverlay.classList.add('hidden');
  }
});

confirmNo.addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
});

// -----------------------------------------------------------
// MOBILE NAV
// -----------------------------------------------------------
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobile-nav').classList.toggle('open');
});

// -----------------------------------------------------------
// INIT
// -----------------------------------------------------------
async function init() {
  currentUserId = await checkAuth();
  if (!currentUserId) return; // redirected to login
  await loadReviews();
}

init();