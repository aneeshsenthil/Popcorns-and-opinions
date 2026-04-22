// ============================================================
//  script.js — Popcorn & Opinions | Home Page
//  Features: Hero carousel, Trending, Top Rated, Upcoming,
//            Movie modal, Watchlist (localStorage), Toast
// ============================================================

const API_KEY     = 'db536043007cfb075f36f62e669838a2';
const BASE_URL    = 'https://api.themoviedb.org/3';
const IMAGE_BASE  = 'https://image.tmdb.org/t/p/original';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

// -----------------------------------------------------------
// WATCHLIST (localStorage)
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
  let list = getWatchlist();
  const exists = list.some(m => m.id === movie.id);
  if (exists) {
    list = list.filter(m => m.id !== movie.id);
    showToast(`❌ Removed "${movie.title}" from Watchlist`);
  } else {
    list.push({ id: movie.id, title: movie.title, poster_path: movie.poster_path });
    showToast(`✅ Added "${movie.title}" to Watchlist`);
  }
  saveWatchlist(list);
  refreshWatchlistButtons(movie.id);
  return !exists;
}

function refreshWatchlistButtons(movieId) {
  const saved = isInWatchlist(movieId);
  document.querySelectorAll(`.card-watchlist-btn[data-id="${movieId}"]`).forEach(btn => {
    btn.textContent = saved ? '❤️' : '🤍';
    btn.classList.toggle('saved', saved);
  });
  const modalBtn = document.getElementById('modal-watchlist-btn');
  if (modalBtn && Number(modalBtn.dataset.id) === movieId) {
    modalBtn.textContent = saved ? '❤️ In Watchlist' : '+ Add to Watchlist';
  }
}

// -----------------------------------------------------------
// TOAST
// -----------------------------------------------------------
let toastTimer;
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  clearTimeout(toastTimer);
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  toastTimer = setTimeout(() => toast.remove(), 3000);
}

// -----------------------------------------------------------
// SKELETON LOADERS
// -----------------------------------------------------------
function showSkeletons(containerId, count = 5) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = Array(count).fill(`<div class="skeleton skeleton-card"></div>`).join('');
}

// -----------------------------------------------------------
// MOVIE CARD BUILDER
// -----------------------------------------------------------
function buildCard(movie, type = 'rating') {
  const saved  = isInWatchlist(movie.id);
  const meta   = type === 'date'
    ? `<span class="movie-card-date">📅 ${movie.release_date || 'TBA'}</span>`
    : `<span class="movie-card-meta">⭐ ${(movie.vote_average || 0).toFixed(1)}</span>`;

  const card = document.createElement('div');
  card.className = 'movie-card';
  card.innerHTML = `
    <img
      src="${movie.poster_path ? POSTER_BASE + movie.poster_path : 'images/no-poster.png'}"
      alt="${movie.title}"
      loading="lazy"
    >
    <button
      class="card-watchlist-btn ${saved ? 'saved' : ''}"
      data-id="${movie.id}"
      title="${saved ? 'Remove from Watchlist' : 'Add to Watchlist'}"
    >${saved ? '❤️' : '🤍'}</button>
    <div class="movie-card-body">
      <div class="movie-card-title">${movie.title}</div>
      ${meta}
    </div>
  `;

  // Open modal on card click (not on watchlist button)
  card.addEventListener('click', e => {
    if (e.target.classList.contains('card-watchlist-btn')) return;
    openModal(movie);
  });

  // Watchlist toggle
  card.querySelector('.card-watchlist-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleWatchlist(movie);
  });

  return card;
}

// -----------------------------------------------------------
// MODAL
// -----------------------------------------------------------
let currentModalMovie = null;

function openModal(movie) {
  currentModalMovie = movie;
  const overlay = document.getElementById('modal-overlay');

  document.getElementById('modal-title').textContent    = movie.title;
  document.getElementById('modal-overview').textContent = movie.overview || 'No description available.';
  document.getElementById('modal-poster').src =
    movie.poster_path ? POSTER_BASE + movie.poster_path : 'images/no-poster.png';
  document.getElementById('modal-backdrop').style.backgroundImage =
    movie.backdrop_path ? `url(${IMAGE_BASE + movie.backdrop_path})` : 'none';

  // Meta pills
  const meta = document.getElementById('modal-meta');
  meta.innerHTML = '';
  if (movie.vote_average) meta.innerHTML += `<span>⭐ ${movie.vote_average.toFixed(1)}</span>`;
  if (movie.release_date) meta.innerHTML += `<span>📅 ${movie.release_date}</span>`;
  if (movie.original_language) meta.innerHTML += `<span>🌐 ${movie.original_language.toUpperCase()}</span>`;

  // Watchlist button state
  const wBtn = document.getElementById('modal-watchlist-btn');
  wBtn.dataset.id = movie.id;
  wBtn.textContent = isInWatchlist(movie.id) ? '❤️ In Watchlist' : '+ Add to Watchlist';

  overlay.classList.add('open');
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
// HERO CAROUSEL
// -----------------------------------------------------------
let heroMovies   = [];
let heroIndex    = 0;
let heroInterval = null;

function setHero(movie, animate = true) {
  const section = document.getElementById('hero-section');
  section.style.backgroundImage = `url(${IMAGE_BASE + movie.backdrop_path})`;

  if (animate) {
    const content = document.querySelector('.hero-content');
    content.style.animation = 'none';
    content.offsetHeight; // reflow
    content.style.animation = '';
  }

  document.getElementById('hero-title').textContent =
    movie.title;
  document.getElementById('hero-description').textContent =
    (movie.overview || '').substring(0, 160) + '...';

  const meta = document.getElementById('hero-meta');
  meta.innerHTML = '';
  if (movie.vote_average) meta.innerHTML += `<span>⭐ ${movie.vote_average.toFixed(1)}</span>`;
  if (movie.release_date) meta.innerHTML += `<span>📅 ${movie.release_date.slice(0,4)}</span>`;

  // Hero watchlist btn
  const btn = document.getElementById('hero-watchlist-btn');
  btn.textContent = isInWatchlist(movie.id) ? '❤️ In Watchlist' : '+ Watchlist';
  btn.onclick = () => {
    toggleWatchlist(movie);
    btn.textContent = isInWatchlist(movie.id) ? '❤️ In Watchlist' : '+ Watchlist';
  };

  // Update dots
  document.querySelectorAll('.hero-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === heroIndex);
  });
}

function buildHeroDots(count) {
  const container = document.getElementById('hero-dots');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('button');
    dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => {
      heroIndex = i;
      setHero(heroMovies[heroIndex]);
      resetHeroTimer();
    });
    container.appendChild(dot);
  }
}

function nextHero() {
  heroIndex = (heroIndex + 1) % heroMovies.length;
  setHero(heroMovies[heroIndex]);
}

function resetHeroTimer() {
  clearInterval(heroInterval);
  heroInterval = setInterval(nextHero, 6000);
}

// -----------------------------------------------------------
// FETCH FUNCTIONS
// -----------------------------------------------------------
async function fetchTrending() {
  showSkeletons('trending-container', 10);
  try {
    const res  = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`);
    const data = await res.json();
    const movies = data.results || [];

    // First 5 for hero carousel
    heroMovies = movies.slice(0, 5);
    buildHeroDots(heroMovies.length);
    setHero(heroMovies[0]);
    resetHeroTimer();

    // Show rest in trending grid
    const container = document.getElementById('trending-container');
    container.innerHTML = '';
    movies.slice(5, 15).forEach(m => container.appendChild(buildCard(m, 'rating')));

  } catch (err) {
    console.error('Trending fetch error:', err);
    document.getElementById('trending-container').innerHTML =
      '<p style="color:#64748b">Could not load movies.</p>';
  }
}

async function fetchTopRated() {
  showSkeletons('top-rated-container', 5);
  try {
    const res  = await fetch(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}`);
    const data = await res.json();
    const container = document.getElementById('top-rated-container');
    container.innerHTML = '';
    (data.results || []).slice(0, 6).forEach(m => container.appendChild(buildCard(m, 'rating')));
  } catch (err) {
    console.error('Top rated fetch error:', err);
  }
}

async function fetchUpcoming() {
  showSkeletons('upcoming-container', 5);
  try {
    const res  = await fetch(`${BASE_URL}/movie/upcoming?api_key=${API_KEY}`);
    const data = await res.json();
    const container = document.getElementById('upcoming-container');
    container.innerHTML = '';
    (data.results || []).slice(0, 6).forEach(m => container.appendChild(buildCard(m, 'date')));
  } catch (err) {
    console.error('Upcoming fetch error:', err);
  }
}

// -----------------------------------------------------------
// MOBILE NAV
// -----------------------------------------------------------
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobile-nav').classList.toggle('open');
});

// -----------------------------------------------------------
// INIT
// -----------------------------------------------------------
fetchTrending();
fetchTopRated();
fetchUpcoming();