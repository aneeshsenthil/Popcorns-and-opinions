// ============================================================
//  watchlist.js — Popcorn & Opinions
//  Fully wired to Supabase
//  Requires: supabase CDN + js/supabase.js before this file
// ============================================================

const API_KEY     = 'db536043007cfb075f36f62e669838a2';
const BASE_URL    = 'https://api.themoviedb.org/3';
const IMAGE_BASE  = 'https://image.tmdb.org/t/p/original';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

// -----------------------------------------------------------
// STATE
// -----------------------------------------------------------
let allMovies         = [];
let currentModalMovie = null;
let currentUserId     = null;

// -----------------------------------------------------------
// DOM REFS
// -----------------------------------------------------------
const wlContainer    = document.getElementById('watchlist-container');
const wlEmpty        = document.getElementById('watchlist-empty');
const wlLoading      = document.getElementById('watchlist-loading');
const wlSearch       = document.getElementById('wl-search');
const wlSort         = document.getElementById('wl-sort');
const countBadge     = document.getElementById('watchlist-count-badge');
const clearAllBtn    = document.getElementById('clear-all-btn');
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmYes     = document.getElementById('confirm-yes');
const confirmNo      = document.getElementById('confirm-no');

// -----------------------------------------------------------
// AUTH CHECK
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
// BADGE
// -----------------------------------------------------------
function updateBadge() {
  const n = allMovies.length;
  countBadge.textContent = `${n} movie${n !== 1 ? 's' : ''}`;
}

// -----------------------------------------------------------
// SUPABASE: GET WATCHLIST ROWS
// -----------------------------------------------------------
async function getWatchlistFromDb() {
  const { data, error } = await db
    .from('watchlist')
    .select('*')
    .eq('user_id', currentUserId)
    .order('added_at', { ascending: false });

  if (error) {
    console.error('Fetch watchlist error:', error.message);
    return [];
  }
  return data || [];
}

// -----------------------------------------------------------
// SUPABASE: REMOVE ONE MOVIE
// -----------------------------------------------------------
async function removeFromDb(movieId) {
  const { error } = await db
    .from('watchlist')
    .delete()
    .eq('user_id', currentUserId)
    .eq('movie_id', movieId);

  if (error) throw error;
}

// -----------------------------------------------------------
// SUPABASE: CLEAR ALL
// -----------------------------------------------------------
async function clearAllFromDb() {
  const { error } = await db
    .from('watchlist')
    .delete()
    .eq('user_id', currentUserId);

  if (error) throw error;
}

// -----------------------------------------------------------
// REMOVE MOVIE (UI + DB)
// -----------------------------------------------------------
async function removeFromWatchlist(movieId) {
  try {
    await removeFromDb(movieId);
    allMovies = allMovies.filter(m => m.id !== movieId);
    renderGrid();
    updateBadge();
    showToast('❌ Removed from Watchlist');
    closeModal();
  } catch (err) {
    showToast('❌ Failed to remove. Try again.');
    console.error('Remove watchlist error:', err);
  }
}

// -----------------------------------------------------------
// CARD BUILDER
// -----------------------------------------------------------
function buildCard(movie) {
  const card = document.createElement('div');
  card.className      = 'movie-card';
  card.style.position = 'relative';

  card.innerHTML = `
    <img
      src="${movie.poster_path ? POSTER_BASE + movie.poster_path : 'images/no-poster.png'}"
      alt="${movie.title}"
      loading="lazy"
    >
    <button class="wl-remove-btn" data-id="${movie.id}" title="Remove">🗑</button>
    <div class="movie-card-body">
      <div class="movie-card-title">${movie.title}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
        <span class="movie-card-meta">⭐ ${(movie.vote_average || 0).toFixed(1)}</span>
        <span class="movie-card-date">${movie.release_date ? movie.release_date.slice(0,4) : '—'}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', e => {
    if (e.target.classList.contains('wl-remove-btn')) return;
    openModal(movie);
  });

  card.querySelector('.wl-remove-btn').addEventListener('click', async e => {
    e.stopPropagation();
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.9)';
    setTimeout(() => removeFromWatchlist(movie.id), 280);
  });

  return card;
}

// -----------------------------------------------------------
// FILTER + SORT + SEARCH
// -----------------------------------------------------------
function getFiltered() {
  const query = wlSearch.value.trim().toLowerCase();
  const sort  = wlSort.value;
  let list    = [...allMovies];

  if (query) {
    list = list.filter(m => m.title.toLowerCase().includes(query));
  }

  switch (sort) {
    case 'title':  list.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'rating': list.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)); break;
    default: break; // 'added' — keeps DB order (newest first)
  }

  return list;
}

// -----------------------------------------------------------
// RENDER GRID
// -----------------------------------------------------------
function renderGrid() {
  wlContainer.innerHTML = '';
  const filtered = getFiltered();

  if (allMovies.length === 0) {
    wlEmpty.classList.remove('hidden');
    wlContainer.classList.add('hidden');
    return;
  }

  wlEmpty.classList.add('hidden');
  wlContainer.classList.remove('hidden');

  if (filtered.length === 0) {
    wlContainer.innerHTML = `
      <p style="color:#64748b;padding:20px;grid-column:1/-1;">
        No movies match your search.
      </p>`;
    return;
  }

  filtered.forEach(m => wlContainer.appendChild(buildCard(m)));
}

// -----------------------------------------------------------
// LOAD WATCHLIST
// Fetch watchlist rows from Supabase (already has all needed data)
// NO extra TMDB API calls needed
// -----------------------------------------------------------
async function loadWatchlist() {
  wlLoading.classList.remove('hidden');
  wlEmpty.classList.add('hidden');
  wlContainer.classList.add('hidden');

  try {
    const rows = await getWatchlistFromDb();

    if (rows.length === 0) {
      wlLoading.classList.add('hidden');
      wlEmpty.classList.remove('hidden');
      updateBadge();
      return;
    }

    // Convert database rows to movie objects
    // The database already has: movie_id, title, poster_path, vote_average, release_date
allMovies = rows.map(row => ({
  id: row.movie_id,
  title: row.movie_title || 'Untitled',
  poster_path: row.poster_path || 'images/no-poster.png',
  vote_average: row.vote_average || 0,
  release_date: '',
  backdrop_path: null,
  overview: 'No description available.',
  runtime: null,
  original_language: null
}));

  } catch (err) {
    console.error('Load watchlist error:', err);
    showToast('❌ Failed to load watchlist.');
  }

  wlLoading.classList.add('hidden');
  updateBadge();
  renderGrid();
}

// -----------------------------------------------------------
// SEARCH + SORT LISTENERS
// -----------------------------------------------------------
wlSearch.addEventListener('input', renderGrid);
wlSort.addEventListener('change', renderGrid);

// -----------------------------------------------------------
// CLEAR ALL
// -----------------------------------------------------------
clearAllBtn.addEventListener('click', () => {
  if (allMovies.length === 0) { showToast('Watchlist is already empty.'); return; }
  confirmOverlay.classList.remove('hidden');
});

confirmYes.addEventListener('click', async () => {
  try {
    await clearAllFromDb();
    allMovies = [];
    renderGrid();
    updateBadge();
    confirmOverlay.classList.add('hidden');
    showToast('🗑 Watchlist cleared');
  } catch (err) {
    showToast('❌ Failed to clear. Try again.');
    confirmOverlay.classList.add('hidden');
    console.error('Clear watchlist error:', err);
  }
});

confirmNo.addEventListener('click', () => {
  confirmOverlay.classList.add('hidden');
});

// -----------------------------------------------------------
// MODAL
// -----------------------------------------------------------
function openModal(movie) {
  currentModalMovie = movie;

  document.getElementById('modal-title').textContent    = movie.title;
  document.getElementById('modal-overview').textContent = movie.overview || 'No description available.';
  document.getElementById('modal-poster').src =
    movie.poster_path ? POSTER_BASE + movie.poster_path : 'images/no-poster.png';
  document.getElementById('modal-backdrop').style.backgroundImage =
    movie.backdrop_path ? `url(${IMAGE_BASE + movie.backdrop_path})` : 'none';

  const meta = document.getElementById('modal-meta');
  meta.innerHTML = '';
  if (movie.vote_average)      meta.innerHTML += `<span>⭐ ${movie.vote_average.toFixed(1)}</span>`;
  if (movie.release_date)      meta.innerHTML += `<span>📅 ${movie.release_date}</span>`;
  if (movie.runtime)           meta.innerHTML += `<span>⏱ ${movie.runtime} min</span>`;
  if (movie.original_language) meta.innerHTML += `<span>🌐 ${movie.original_language.toUpperCase()}</span>`;

  document.getElementById('modal-remove-btn').dataset.id = movie.id;
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  currentModalMovie = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

document.getElementById('modal-remove-btn').addEventListener('click', () => {
  if (!currentModalMovie) return;
  removeFromWatchlist(currentModalMovie.id);
});

// -----------------------------------------------------------
// MOBILE NAV
// -----------------------------------------------------------
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobile-nav').classList.toggle('open');
});

// -----------------------------------------------------------
// FADE OUT ANIMATION
// -----------------------------------------------------------
const fadeStyle = document.createElement('style');
fadeStyle.textContent = `@keyframes fadeOut { to { opacity:0; transform:scale(0.9); } }`;
document.head.appendChild(fadeStyle);

// -----------------------------------------------------------
// INIT
// -----------------------------------------------------------
async function init() {
  currentUserId = await checkAuth();
  if (!currentUserId) return;
  await loadWatchlist();
}

init();
