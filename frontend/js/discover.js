// ============================================================
//  discover.js — Popcorn & Opinions
//  Features: Search, Genre/Sort/Year filters, Load More,
//            Watchlist toggle, Movie modal, Toast
//  Now using Supabase for watchlist storage
// ============================================================

const API_KEY     = 'db536043007cfb075f36f62e669838a2';
const BASE_URL    = 'https://api.themoviedb.org/3';
const IMAGE_BASE  = 'https://image.tmdb.org/t/p/original';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

// -----------------------------------------------------------
// STATE
// -----------------------------------------------------------
let currentPage       = 1;
let currentQuery      = '';
let totalPages        = 1;
let isLoading         = false;
let currentModalMovie = null;
let currentUserId     = null;

// -----------------------------------------------------------
// DOM REFS
// -----------------------------------------------------------
const moviesContainer = document.getElementById('movies-container');
const searchInput     = document.getElementById('search-input');
const searchBtn       = document.getElementById('search-btn');
const searchClear     = document.getElementById('search-clear');
const genreFilter     = document.getElementById('genre-filter');
const sortFilter      = document.getElementById('sort-filter');
const yearFilter      = document.getElementById('year-filter');
const resetBtn        = document.getElementById('reset-filters');
const loadMoreBtn     = document.getElementById('load-more-btn');
const loadMoreWrap    = document.getElementById('load-more-wrap');
const emptyState      = document.getElementById('empty-state');
const resultsInfo     = document.getElementById('results-info');

// -----------------------------------------------------------
// AUTH CHECK
// -----------------------------------------------------------
async function checkAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    console.warn('User not logged in - watchlist disabled');
    return null;
  }
  return session.user.id;
}

// -----------------------------------------------------------
// WATCHLIST (SUPABASE VERSION)
// -----------------------------------------------------------

// Get watchlist from Supabase
async function getWatchlist() {
  if (!currentUserId) return [];
  
  const { data, error } = await db
    .from('watchlist')
    .select('movie_id, movie_title, poster_path')
    .eq('user_id', currentUserId);

  if (error) {
    console.error('Fetch watchlist error:', error.message);
    return [];
  }
  return data || [];
}

// Check if movie is in watchlist
async function isInWatchlist(movieId) {
  if (!currentUserId) return false;
  
  try {
    const { count, error } = await db
      .from('watchlist')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUserId)
      .eq('movie_id', movieId);

    if (error) {
      console.error('Check watchlist error:', error.message);
      return false;
    }

    return (count || 0) > 0;  // ✅ Returns true if count > 0
  } catch (err) {
    console.error('Check watchlist error:', err.message);
    return false;
  }
}

// Toggle watchlist (add/remove)
async function toggleWatchlist(movie) {
  if (!currentUserId) {
    showToast('⚠️ Please log in to use Watchlist');
    return false;
  }

  const exists = await isInWatchlist(movie.id);

  if (exists) {
    // Remove from watchlist
    const { error } = await db
      .from('watchlist')
      .delete()
      .eq('user_id', currentUserId)
      .eq('movie_id', movie.id);

    if (error) {
      console.error('Remove from watchlist error:', error.message);
      showToast('❌ Failed to remove from Watchlist');
      return false;
    }

    showToast(`❌ Removed "${movie.title}" from Watchlist`);
    await refreshWatchlistUI(movie.id);
    return false;

  } else {
    // Add to watchlist
// Add to watchlist - ONLY insert columns that exist in your table
// Add to watchlist - minimal version
const { error } = await db
  .from('watchlist')
  .insert({
    user_id: currentUserId,
    movie_id: movie.id,
    movie_title: movie.title || 'Untitled Movie',
    poster_path: movie.poster_path || null,
    vote_average: movie.vote_average || 0,
  });
    if (error) {
      console.error('Add to watchlist error:', error.message);
      showToast('❌ Failed to add to Watchlist');
      return false;
    }

    showToast(`✅ Added "${movie.title}" to Watchlist`);
    await refreshWatchlistUI(movie.id);
    return true;
  }
}

// Refresh watchlist button UI
async function refreshWatchlistUI(movieId) {
  const saved = await isInWatchlist(movieId);
  
  document.querySelectorAll(`.card-watchlist-btn[data-id="${movieId}"]`).forEach(btn => {
    btn.textContent = saved ? '❤️' : '🤍';
    btn.classList.toggle('saved', saved);
  });

  const mBtn = document.getElementById('modal-watchlist-btn');
  if (mBtn && Number(mBtn.dataset.id) === movieId) {
    mBtn.textContent = saved ? '❤️ In Watchlist' : '+ Add to Watchlist';
  }
}

// -----------------------------------------------------------
// TOAST
// -----------------------------------------------------------
let toastTimer;
function showToast(msg) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  toastTimer = setTimeout(() => t.remove(), 3000);
}

// -----------------------------------------------------------
// SKELETON LOADERS
// -----------------------------------------------------------
function showSkeletons(count = 12) {
  moviesContainer.innerHTML = Array(count)
    .fill('<div class="skeleton skeleton-card"></div>')
    .join('');
}

// -----------------------------------------------------------
// CARD BUILDER
// -----------------------------------------------------------
async function buildCard(movie) {
  const saved = await isInWatchlist(movie.id);
  const card  = document.createElement('div');
  card.className = 'movie-card';
  card.innerHTML = `
    <img
      src="${movie.poster_path ? POSTER_BASE + movie.poster_path : 'images/no-poster.png'}"
      alt="${movie.title}"
      loading="lazy"
    >
    <button class="card-watchlist-btn ${saved ? 'saved' : ''}" data-id="${movie.id}">
      ${saved ? '❤️' : '🤍'}
    </button>
    <div class="movie-card-body">
      <div class="movie-card-title">${movie.title}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
        <span class="movie-card-meta">⭐ ${(movie.vote_average || 0).toFixed(1)}</span>
        <span class="movie-card-date">${movie.release_date ? movie.release_date.slice(0,4) : '—'}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', e => {
    if (e.target.classList.contains('card-watchlist-btn')) return;
    openModal(movie);
  });

  card.querySelector('.card-watchlist-btn').addEventListener('click', async e => {
    e.stopPropagation();
    await toggleWatchlist(movie);
  });

  return card;
}

// -----------------------------------------------------------
// MODAL
// -----------------------------------------------------------
async function openModal(movie) {
  currentModalMovie = movie;
  document.getElementById('modal-title').textContent    = movie.title;
  document.getElementById('modal-overview').textContent = movie.overview || 'No description available.';
  document.getElementById('modal-poster').src =
    movie.poster_path ? POSTER_BASE + movie.poster_path : 'images/no-poster.png';
  document.getElementById('modal-backdrop').style.backgroundImage =
    movie.backdrop_path ? `url(${IMAGE_BASE + movie.backdrop_path})` : 'none';

  const meta = document.getElementById('modal-meta');
  meta.innerHTML = '';
  if (movie.vote_average) meta.innerHTML += `<span>⭐ ${movie.vote_average.toFixed(1)}</span>`;
  if (movie.release_date) meta.innerHTML += `<span>📅 ${movie.release_date}</span>`;
  if (movie.original_language) meta.innerHTML += `<span>🌐 ${movie.original_language.toUpperCase()}</span>`;

  const wBtn = document.getElementById('modal-watchlist-btn');
  wBtn.dataset.id  = movie.id;
  const inWatchlist = await isInWatchlist(movie.id);
  wBtn.textContent = inWatchlist ? '❤️ In Watchlist' : '+ Add to Watchlist';

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

document.getElementById('modal-watchlist-btn').addEventListener('click', async () => {
  if (!currentModalMovie) return;
  const added = await toggleWatchlist(currentModalMovie);
  const wBtn = document.getElementById('modal-watchlist-btn');
  wBtn.textContent = added ? '❤️ In Watchlist' : '+ Add to Watchlist';
});

// -----------------------------------------------------------
// BUILD ENDPOINT
// -----------------------------------------------------------
function buildEndpoint(page = 1) {
  const query  = searchInput.value.trim();
  const genre  = genreFilter.value;
  const sort   = sortFilter.value;
  const year   = yearFilter.value;

  if (query) {
    let url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}`;
    if (year) url += `&year=${year}`;
    return url;
  }

  let url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=${sort}&page=${page}`;
  if (genre) url += `&with_genres=${genre}`;
  if (year)  url += `&primary_release_year=${year}`;
  return url;
}

// -----------------------------------------------------------
// FETCH & RENDER
// -----------------------------------------------------------
async function loadMovies(page = 1, append = false) {
  if (isLoading) return;
  isLoading = true;

  if (!append) showSkeletons(12);

  try {
    const res  = await fetch(buildEndpoint(page));
    const data = await res.json();
    const movies = data.results || [];
    totalPages = data.total_pages || 1;

    if (!append) moviesContainer.innerHTML = '';

    if (movies.length === 0 && !append) {
      emptyState.classList.remove('hidden');
      loadMoreWrap.classList.add('hidden');
      resultsInfo.textContent = '';
    } else {
      emptyState.classList.add('hidden');
      
      // Build cards sequentially to handle async watchlist checks
      for (const m of movies) {
        const card = await buildCard(m);
        moviesContainer.appendChild(card);
      }

      const total = data.total_results || movies.length;
      resultsInfo.textContent = `Showing ${moviesContainer.children.length} of ${total.toLocaleString()} movies`;

      // Hide load more if last page
      loadMoreWrap.classList.toggle('hidden', page >= totalPages);
    }
  } catch (err) {
    console.error('Discover fetch error:', err);
    moviesContainer.innerHTML = '<p style="color:#64748b;padding:20px">Failed to load movies. Check your connection.</p>';
  }

  isLoading = false;
}

// -----------------------------------------------------------
// SEARCH
// -----------------------------------------------------------
function runSearch() {
  currentPage  = 1;
  currentQuery = searchInput.value.trim();
  searchClear.classList.toggle('hidden', !currentQuery);
  loadMovies(1, false);
}

searchBtn.addEventListener('click', runSearch);

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') runSearch();
});

searchInput.addEventListener('input', () => {
  searchClear.classList.toggle('hidden', !searchInput.value.trim());
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.add('hidden');
  currentQuery = '';
  loadMovies(1, false);
});

// -----------------------------------------------------------
// FILTERS
// -----------------------------------------------------------
[genreFilter, sortFilter, yearFilter].forEach(el => {
  el.addEventListener('change', () => {
    currentPage = 1;
    loadMovies(1, false);
  });
});

// -----------------------------------------------------------
// RESET
// -----------------------------------------------------------
function resetAll() {
  searchInput.value  = '';
  genreFilter.value  = '';
  sortFilter.value   = 'popularity.desc';
  yearFilter.value   = '';
  currentPage        = 1;
  currentQuery       = '';
  searchClear.classList.add('hidden');
  loadMovies(1, false);
}

resetBtn.addEventListener('click', resetAll);

// -----------------------------------------------------------
// LOAD MORE
// -----------------------------------------------------------
loadMoreBtn.addEventListener('click', () => {
  currentPage++;
  loadMovies(currentPage, true);
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
  if (!currentUserId) {
    console.warn('User not authenticated - watchlist features disabled');
  }
  await loadMovies(1, false);
}

init();
