// ============================================================
//  profile.js — Popcorn & Opinions
//  Fully wired to Supabase
//  Requires: supabase CDN + js/supabase.js before this file
// ============================================================

const POSTER_BASE = 'https://image.tmdb.org/t/p/w200';

// -----------------------------------------------------------
// DOM REFS
// -----------------------------------------------------------
const profileLoading  = document.getElementById('profile-loading');
const profileContent  = document.getElementById('profile-content');
const avatarImg       = document.getElementById('avatar-img');
const avatarUpload    = document.getElementById('avatar-upload');
const displayUsername = document.getElementById('display-username');
const displayEmail    = document.getElementById('display-email');
const infoUsername    = document.getElementById('info-username');
const infoEmail       = document.getElementById('info-email');
const infoDob         = document.getElementById('info-dob');
const infoJoined      = document.getElementById('info-joined');
const reviewCount     = document.getElementById('review-count');
const watchlistCount  = document.getElementById('watchlist-count');
const avgRating       = document.getElementById('avg-rating');
const recentList      = document.getElementById('recent-reviews-list');
const logoutBtn       = document.getElementById('logout-btn');
const themeToggle     = document.getElementById('theme-toggle');

// -----------------------------------------------------------
// HELPERS
// -----------------------------------------------------------
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

function setLoading(show) {
  profileLoading.classList.toggle('hidden', !show);
  profileContent.classList.toggle('hidden', show);
}

// -----------------------------------------------------------
// THEME TOGGLE
// -----------------------------------------------------------
function applyTheme(dark) {
  document.body.classList.toggle('light-mode', !dark);
  themeToggle.checked = dark;
  localStorage.setItem('po-theme', dark ? 'dark' : 'light');
}

themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked));

// Apply saved theme immediately on load
applyTheme(localStorage.getItem('po-theme') !== 'light');

// -----------------------------------------------------------
// FETCH USER PROFILE from users table
// -----------------------------------------------------------
async function fetchUserProfile(userId) {
  const { data, error } = await db
    .from('users')
    .select('username, full_name, dob, avatar_url, created_at')
    .eq('id', userId)
    .single();

  if (error) console.warn('Profile fetch warning:', error.message);
  return data || {};
}

// -----------------------------------------------------------
// FETCH STATS: review count, watchlist count, avg rating
// -----------------------------------------------------------
async function fetchStats(userId) {
  // All reviews for this user
  const { data: reviews, error: rErr } = await db
    .from('reviews')
    .select('id, rating, movie_title, poster_path, review_text, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (rErr) console.warn('Reviews fetch warning:', rErr.message);

  // Watchlist count only (no need to fetch full rows)
  const { count: wCount, error: wErr } = await db
    .from('watchlist')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (wErr) console.warn('Watchlist count warning:', wErr.message);

  const rList        = reviews || [];
  const totalReviews = rList.length;
  const totalWL      = wCount ?? 0;
  const avg          = totalReviews
    ? (rList.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1)
    : '—';

  return {
    totalReviews,
    totalWL,
    avg,
    recentReviews: rList.slice(0, 5),
  };
}

// -----------------------------------------------------------
// RENDER RECENT REVIEWS
// Uses movie_title + poster_path already stored in reviews table
// No need to hit TMDB again
// -----------------------------------------------------------
function renderRecentReviews(reviews) {
  if (!reviews.length) {
    recentList.innerHTML = `
      <p class="no-data-msg">
        No reviews yet. <a href="review.html">Write one!</a>
      </p>`;
    return;
  }

  recentList.innerHTML = reviews.map(r => {
    const title   = r.movie_title || 'Untitled';
    const text    = r.review_text || '';
    const rating  = r.rating ? `⭐ ${r.rating}/10` : '—';
    const date    = r.created_at
      ? new Date(r.created_at).toLocaleDateString('en-GB')
      : '';
    const poster  = r.poster_path
      ? `<img src="${POSTER_BASE + r.poster_path}" alt="${title}" style="width:36px;height:54px;object-fit:cover;border-radius:6px;flex-shrink:0;">`
      : `<div style="width:36px;height:54px;background:#1e293b;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">🎬</div>`;

    return `
      <div class="review-card-profile">
        ${poster}
        <div class="review-card-left">
          <div class="review-movie-title">${title}</div>
          ${text ? `<p class="review-text-preview">${text}</p>` : ''}
        </div>
        <div class="review-meta">
          <span class="review-rating-badge">${rating}</span>
          <span class="review-date">${date}</span>
        </div>
      </div>
    `;
  }).join('');
}

// -----------------------------------------------------------
// AVATAR UPLOAD to Supabase Storage
// -----------------------------------------------------------
async function handleAvatarUpload(userId, file) {
  // Validate file type + size
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file.');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    alert('Image must be under 2MB.');
    return;
  }

  const ext      = file.name.split('.').pop();
  const filePath = `avatars/${userId}.${ext}`;

  avatarImg.style.opacity = '0.5';

  const { error: upErr } = await db.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (upErr) {
    console.error('Avatar upload error:', upErr.message);
    avatarImg.style.opacity = '1';
    alert('Upload failed: ' + upErr.message);
    return;
  }

  const { data: urlData } = db.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = urlData?.publicUrl;

  if (publicUrl) {
    avatarImg.src          = publicUrl + '?t=' + Date.now(); // bust cache
    avatarImg.style.opacity = '1';

    await db.from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);
  }
}

// -----------------------------------------------------------
// LOGOUT
// -----------------------------------------------------------
logoutBtn.addEventListener('click', async () => {
  logoutBtn.textContent = 'Signing out...';
  logoutBtn.disabled    = true;
  await db.auth.signOut();
  window.location.href = 'login.html';
});

// -----------------------------------------------------------
// MAIN INIT
// -----------------------------------------------------------
async function init() {
  // Auth check
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const user = session.user;
  
  // Fetch everything in parallel
  const [profile, stats] = await Promise.all([
    fetchUserProfile(user.id),
    fetchStats(user.id),
  ]);

  const { totalReviews, totalWL, avg, recentReviews } = stats;

  // --- Names / Info (DEFINE username FIRST) ---
  const username   = profile.username || user.email?.split('@')[0] || 'Guest';
  const email      = user.email || '—';
  const dob        = formatDate(profile.dob);
  const joinedDate = formatDate(profile.created_at || user.created_at);

  // --- Avatar (NOW you can use username) ---
  avatarImg.src = profile.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username) + '&background=E11D48&color=fff&size=200';

  displayUsername.textContent  = username;
  displayEmail.textContent     = email;
  infoUsername.textContent     = username;
  infoEmail.textContent        = email;
  infoDob.textContent          = dob;
  infoJoined.textContent       = joinedDate;

  // --- Stats ---
  reviewCount.textContent    = totalReviews;
  watchlistCount.textContent = totalWL;
  avgRating.textContent      = avg;

  // --- Recent Reviews ---
  renderRecentReviews(recentReviews);

  // --- Avatar Upload ---
  avatarUpload.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (file) await handleAvatarUpload(user.id, file);
  });

  // --- Show page ---
  setLoading(false);
}

init();