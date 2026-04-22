// ============================================================
//  upcoming.js — Popcorn & Opinions
//  Features: Upcoming movies, spotlight cards with countdown,
//            date filters (all / this month / 3 months),
//            sort, load more, watchlist, modal
// ============================================================

const API_KEY     = 'db536043007cfb075f36f62e669838a2';
const BASE_URL    = 'https://api.themoviedb.org/3';
const IMAGE_BASE  = 'https://image.tmdb.org/t/p/original';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

// -----------------------------------------------------------
// STATE
// -----------------------------------------------------------
let currentPage       = 1;
let totalPages        = 1;
let isLoading         = false;
let activeFilter      = 'all';
let currentModalMovie = null;
let allLoaded         = [];

// -----------------------------------------------------------
// DOM REFS
// -----------------------------------------------------------
const container    = document.getElementById('upcoming-container');
const spotGrid     = document.getElementById('spotlight-grid');
const loadMoreBtn  = document.getElementById('load-more-btn');
const loadMoreWrap = document.getElementById('load-more-wrap');
const emptyState   = document.getElementById('empty-state');
const resultsInfo  = document.getElementById('results-info');
const sortSelect   = document.getElementById('upcoming-sort');

// -----------------------------------------------------------
// DATE HELPERS
// -----------------------------------------------------------
const today = new Date();
today.setHours(0, 0, 0, 0);

function isFuture(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) >= today;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === today.getFullYear() &&
         d.getMonth()    === today.getMonth() &&
         d >= today;
}

function isNext3Months(dateStr) {
  if (!dateStr) return false;
  const d    = new Date(dateStr);
  const end  = new Date(today);
  end.setMonth(end.getMonth() + 3);
  return d >= today && d <= end;
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return 'TBA';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function countdownLabel(dateStr) {
  const days = daysUntil(dateStr);
  if (days === 0)  return { text: 'TODAY!',       soon: true };
  if (days === 1)  return { text: 'TOMORROW',     soon: true };
  if (days <= 7)   return { text: `IN ${days} DAYS`, soon: true };
  if (days <= 30)  return { text: `IN ${days} DAYS`, soon: false };
  const weeks = Math.ceil(days / 7);
  return { text: `IN ${weeks} WEEKS`, soon: false };
}

// -----------------------------------------------------------
// WATCHLIST
// -----------------------------------------------------------
function getWatchlist() {
  return JSON.parse(localStorage.getItem('watchlist')) || [];
}

function saveWatchlist(list) {
  localStorage.setItem('watchlist', JSON.stringify(list));
}

function isInWatchlist(id) {
  return getWatchlist().some(m => m.id === id);
}

function toggleWatchlist(movie) {
  let list   = getWatchlist();
  const exists = list.some(m => m.id === movie.id);
  if (exists) {
    list = list.filter(m => m.id !== movie.id);
    showToast(`❌ Removed "${movie.title}" from Watchlist`);
  } else {
    list.push({ id: movie.id, title: movie.title, poster_path: movie.poster_path });
    showToast(`✅ Added "${movie.title}" to Watchlist`);
  }
  saveWatchlist(list);
  refreshWatchlistUI(movie.id);
  return !exists;
}

function refreshWatchlistUI(movieId) {
  const saved = isInWatchlist(movieId);
  document.querySelectorAll(`[data-wl-id="${movieId}"]`).forEach(btn => {
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
  t.className   = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  toastTimer = setTimeout(() => t.remove(), 3000);
}

// -----------------------------------------------------------
// SKELETONS
// -----------------------------------------------------------
function showSkeletons(count = 8) {
  container.innerHTML = Array(count)
    .fill('<div class="skeleton skeleton-card"></div>')
    .join('');
}

// -----------------------------------------------------------
// SPOTLIGHT CARDS (top 3 most anticipated)
// -----------------------------------------------------------
function buildSpotlightCard(movie) {
  const saved     = isInWatchlist(movie.id);
  const { text, soon } = countdownLabel(movie.release_date);

  const card = document.createElement('div');
  card.className = 'spotlight-card';

  const backdropHtml = movie.backdrop_path
    ? `<img class="spotlight-backdrop" src="${IMAGE_BASE + movie.backdrop_path}" alt="" loading="lazy">`
    : `<div class="spotlight-backdrop-placeholder"></div>`;

  card.innerHTML = `
    ${backdropHtml}
    <button class="spotlight-wl-btn ${saved ? 'saved' : ''}" data-wl-id="${movie.id}">
      ${saved ? '❤️' : '🤍'}
    </button>
    <div class="spotlight-body">
      <img
        class="spotlight-poster"
        src="${movie.poster_path ? POSTER_BASE + movie.poster_path : 'images/no-poster.png'}"
        alt="${movie.title}"
        loading="lazy"
      >
      <div class="spotlight-info">
        <div class="spotlight-title">${movie.title}</div>
        <div class="spotlight-meta">
          <span>📅 ${formatDate(movie.release_date)}</span>
          ${movie.vote_average > 0 ? `<span>⭐ ${movie.vote_average.toFixed(1)}</span>` : ''}
        </div>
        <span class="countdown-badge ${soon ? 'soon' : ''}">${text}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', e => {
    if (e.target.classList.contains('spotlight-wl-btn')) return;
    openModal(movie);
  });

  card.querySelector('.spotlight-wl-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleWatchlist(movie);
  });

  return card;
}

function renderSpotlight(movies) {
  spotGrid.innerHTML = '';
  // Pick top 3 by popularity among future movies
  movies
    .filter(m => isFuture(m.release_date))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3)
    .forEach(m => spotGrid.appendChild(buildSpotlightCard(m)));
}

// -----------------------------------------------------------
// REGULAR MOVIE CARD
// -----------------------------------------------------------
function buildCard(movie) {
  const saved = isInWatchlist(movie.id);
  const days  = daysUntil(movie.release_date);
  const badge = days <= 30
    ? `<span style="font-size:11px;color:#fbbf24;">🔔 ${days}d away</span>`
    : '';

  const card = document.createElement('div');
  card.className = 'movie-card';
  card.innerHTML = `
    <img
      src="${movie.poster_path ? POSTER_BASE + movie.poster_path : 'images/no-poster.png'}"
      alt="${movie.title}"
      loading="lazy"
    >
    <button class="card-watchlist-btn ${saved ? 'saved' : ''}" data-wl-id="${movie.id}">
      ${saved ? '❤️' : '🤍'}
    </button>
    <div class="movie-card-body">
      <div class="movie-card-title">${movie.title}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;flex-wrap:wrap;gap:4px;">
        <span class="movie-card-date">📅 ${formatDate(movie.release_date)}</span>
        ${badge}
      </div>
    </div>
  `;

  card.addEventListener('click', e => {
    if (e.target.classList.contains('card-watchlist-btn')) return;
    openModal(movie);
  });

  card.querySelector('.card-watchlist-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleWatchlist(movie);
  });

  return card;
}

// -----------------------------------------------------------
// FILTER MOVIES CLIENT-SIDE
// -----------------------------------------------------------
function applyFilter(movies) {
  switch (activeFilter) {
    case 'month':   return movies.filter(m => isThisMonth(m.release_date));
    case '3months': return movies.filter(m => isNext3Months(m.release_date));
    default:        return movies.filter(m => isFuture(m.release_date));
  }
}

// -----------------------------------------------------------
// RENDER GRID
// -----------------------------------------------------------
function renderGrid(movies, append = false) {
  if (!append) container.innerHTML = '';

  const filtered = applyFilter(movies);

  if (filtered.length === 0 && !append) {
    emptyState.classList.remove('hidden');
    loadMoreWrap.classList.add('hidden');
    resultsInfo.textContent = '';
    return;
  }

  emptyState.classList.add('hidden');
  filtered.forEach(m => container.appendChild(buildCard(m)));
  resultsInfo.textContent = `Showing ${container.children.length} upcoming movies`;
  loadMoreWrap.classList.toggle('hidden', currentPage >= totalPages);
}

// -----------------------------------------------------------
// FETCH
// -----------------------------------------------------------
async function fetchUpcoming(page = 1, append = false) {
  if (isLoading) return;
  isLoading = true;

  if (!append) showSkeletons(8);

  const sort = sortSelect.value;

  try {
    // Get today + 1 year range
    const from = today.toISOString().split('T')[0];
    const to   = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
      .toISOString().split('T')[0];

    const url = `${BASE_URL}/discover/movie?api_key=${API_KEY}` +
      `&sort_by=${sort}` +
      `&primary_release_date.gte=${from}` +
      `&primary_release_date.lte=${to}` +
      `&page=${page}`;

    const res  = await fetch(url);
    const data = await res.json();
    const movies = (data.results || []);
    totalPages = data.total_pages || 1;

    if (!append) {
      allLoaded = movies;
      renderSpotlight(movies);
    } else {
      allLoaded = [...allLoaded, ...movies];
    }

    renderGrid(movies, append);
  } catch (err) {
    console.error('Upcoming fetch error:', err);
    container.innerHTML = '<p style="color:#64748b;padding:20px">Failed to load. Check your connection.</p>';
  }

  isLoading = false;
}

// -----------------------------------------------------------
// FILTER TABS
// -----------------------------------------------------------
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.filter;
    renderGrid(allLoaded, false);
  });
});

// -----------------------------------------------------------
// SORT
// -----------------------------------------------------------
sortSelect.addEventListener('change', () => {
  currentPage = 1;
  allLoaded   = [];
  fetchUpcoming(1, false);
});

// -----------------------------------------------------------
// LOAD MORE
// -----------------------------------------------------------
loadMoreBtn.addEventListener('click', () => {
  currentPage++;
  fetchUpcoming(currentPage, true);
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
  meta.innerHTML += `<span>📅 ${formatDate(movie.release_date)}</span>`;
  if (movie.vote_average > 0) meta.innerHTML += `<span>⭐ ${movie.vote_average.toFixed(1)}</span>`;
  if (movie.original_language) meta.innerHTML += `<span>🌐 ${movie.original_language.toUpperCase()}</span>`;
  const days = daysUntil(movie.release_date);
  if (days >= 0) meta.innerHTML += `<span>⏳ ${days === 0 ? 'Today!' : days + ' days away'}</span>`;

  const wBtn = document.getElementById('modal-watchlist-btn');
  wBtn.dataset.id  = movie.id;
  wBtn.textContent = isInWatchlist(movie.id) ? '❤️ In Watchlist' : '+ Add to Watchlist';

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

document.getElementById('modal-watchlist-btn').addEventListener('click', () => {
  if (!currentModalMovie) return;
  const added = toggleWatchlist(currentModalMovie);
  document.getElementById('modal-watchlist-btn').textContent =
    added ? '❤️ In Watchlist' : '+ Add to Watchlist';
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
fetchUpcoming(1, false);