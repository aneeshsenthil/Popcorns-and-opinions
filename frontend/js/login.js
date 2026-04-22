// ============================================================
//  login.js — Popcorn & Opinions
//  2-step signup (no OTP) + signin with email only
//  Requires: supabase CDN + js/supabase.js before this file
// ============================================================

const TMDB_KEY = 'db536043007cfb075f36f62e669838a2';

// -----------------------------------------------------------
// STATE
// -----------------------------------------------------------
let currentStep = 1;
const TOTAL_STEPS = 2;
let signupData = {}; // Store signup data across steps

// -----------------------------------------------------------
// 1. TMDB BACKGROUND
// -----------------------------------------------------------
async function loadBackground() {
  try {
    const res  = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}`);
    const data = await res.json();
    const imgs = (data.results || []).filter(m => m.poster_path || m.backdrop_path);

    const grid   = document.getElementById('bg-posters');
    const needed = 18;
    const pool   = [];
    while (pool.length < needed) pool.push(...imgs);

    for (let i = 0; i < needed; i++) {
      const path = pool[i].poster_path || pool[i].backdrop_path;
      const el   = document.createElement('img');
      el.className = 'bg-poster-img';
      el.src       = `https://image.tmdb.org/t/p/w342${path}`;
      el.alt       = '';
      el.loading   = 'lazy';
      grid.appendChild(el);
    }
  } catch (e) {
    console.warn('TMDB background skipped:', e.message);
  }
}

// -----------------------------------------------------------
// 2. TABS
// -----------------------------------------------------------
function switchTab(tab) {
  document.getElementById('panel-login').classList.toggle('active', tab === 'login');
  document.getElementById('panel-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  
  // Reset signup if switching to signup tab
  if (tab === 'signup') {
    currentStep = 1;
    signupData = {};
    updateDots(1);
    goStep(1);
  }
}

// -----------------------------------------------------------
// 3. PASSWORD TOGGLE
// -----------------------------------------------------------
function togglePw(id, el) {
  const input    = document.getElementById(id);
  const isText   = input.type === 'text';
  input.type     = isText ? 'password' : 'text';
  el.textContent = isText ? '👁️' : '🙈';
}

// -----------------------------------------------------------
// 4. HELPERS
// -----------------------------------------------------------
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent   = msg;
  el.style.display = msg ? 'block' : 'none';
}

function showSuccess(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent   = msg;
  el.style.display = msg ? 'block' : 'none';
}

function setLoading(btnId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading ? 'Please wait...' : defaultText;
}

// -----------------------------------------------------------
// 5. STEP INDICATOR
// -----------------------------------------------------------
function updateDots(step) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    dot.className = 'step-dot ' + (i < step ? 'done' : i === step ? 'active' : '');
  }
  document.getElementById('step-label').textContent = `Step ${step} / ${TOTAL_STEPS}`;
}

function goStep(next) {
  if (next > currentStep && !validateStep(currentStep)) return;

  document.getElementById(`signup-step-${currentStep}`).style.display = 'none';
  currentStep = next;
  document.getElementById(`signup-step-${currentStep}`).style.display = 'block';
  updateDots(currentStep);
}

// -----------------------------------------------------------
// 6. VALIDATION
// -----------------------------------------------------------
function validateStep(step) {
  if (step === 1) {
    const name     = document.getElementById('su-name').value.trim();
    const username = document.getElementById('su-username').value.trim();
    const dob      = document.getElementById('su-dob').value;

    if (!name) {
      showError('step1-error', 'Please enter your full name.');
      return false;
    }
    if (!username) {
      showError('step1-error', 'Please choose a username.');
      return false;
    }
    if (username.length < 3) {
      showError('step1-error', 'Username must be at least 3 characters.');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showError('step1-error', 'Username: letters, numbers and underscores only.');
      return false;
    }
    if (!dob) {
      showError('step1-error', 'Please enter your date of birth.');
      return false;
    }

    // Store step 1 data
    signupData.full_name = name;
    signupData.username = username;
    signupData.dob = dob;

    showError('step1-error', '');
    return true;
  }

  if (step === 2) {
    const email   = document.getElementById('su-email').value.trim();
    const lang    = document.getElementById('su-language').value;
    const pw      = document.getElementById('su-password').value;
    const confirm = document.getElementById('su-confirm').value;
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRx.test(email)) {
      showError('step2-error', 'Please enter a valid email address.');
      return false;
    }
    if (!lang) {
      showError('step2-error', 'Please select your preferred language.');
      return false;
    }
    if (pw.length < 8) {
      showError('step2-error', 'Password must be at least 8 characters.');
      return false;
    }
    if (pw !== confirm) {
      showError('step2-error', 'Passwords do not match.');
      return false;
    }

    // Store step 2 data
    signupData.email = email;
    signupData.language = lang;
    signupData.password = pw;

    showError('step2-error', '');
    return true;
  }

  return true;
}

// -----------------------------------------------------------
// 7. HANDLE SIGNUP - FIXED VERSION
// -----------------------------------------------------------
async function handleSignup() {
  // VALIDATE STEP 2 FIRST before doing anything
  if (!validateStep(2)) {
    console.log('Step 2 validation failed');
    return;
  }

  showError('step2-error', '');
  setLoading('submit-signup-btn', true, 'Creating Account...');

  try {
    console.log('Signup data:', {
      email: signupData.email,
      full_name: signupData.full_name,
      username: signupData.username,
      dob: signupData.dob,
      language: signupData.language
    });

    // Check if all required data exists
    if (!signupData.email || !signupData.password) {
      showError('step2-error', 'Email and password are required.');
      setLoading('submit-signup-btn', false, 'Create Account');
      return;
    }

    console.log('Starting signup with email:', signupData.email);

    // Step 1: Create auth user with email + password ONLY
    const { data, error } = await db.auth.signUp({
      email: signupData.email,
      password: signupData.password
    });

    console.log('Auth signup response:', { data, error });

    if (error) {
      console.error('Signup error details:', error);
      
      if (error.message.includes('already registered')) {
        showError('step2-error', 'This email is already registered. Please sign in.');
      } else if (error.message.includes('User already exists')) {
        showError('step2-error', 'This email is already registered. Please sign in.');
      } else if (error.message.includes('Invalid')) {
        showError('step2-error', 'Invalid email or password format.');
      } else if (error.message.includes('Anonymous')) {
        showError('step2-error', 'Anonymous sign-ins setting issue. Please refresh and try again.');
      } else {
        showError('step2-error', 'Signup failed: ' + error.message);
      }
      
      setLoading('submit-signup-btn', false, 'Create Account');
      return;
    }

    // Check if user was created
    if (!data || !data.user) {
      showError('step2-error', 'Signup failed: No user data returned.');
      setLoading('submit-signup-btn', false, 'Create Account');
      return;
    }

    console.log('User created with ID:', data.user.id);

    // Step 2: Insert user profile into users table
    const userId = data.user.id;
    
    const { error: insertError } = await db.from('users').insert({
      id: userId,
      username: signupData.username,
      full_name: signupData.full_name,
      dob: signupData.dob,
      language: signupData.language,
      email: signupData.email
    });

    if (insertError) {
      console.error('User table insert error:', insertError);
      
      // If it's a duplicate key error, try updating instead
      if (insertError.code === '23505' || insertError.message.includes('duplicate key')) {
        console.log('User already exists in table, updating instead...');
        
        const { error: updateError } = await db.from('users')
          .update({
            username: signupData.username,
            full_name: signupData.full_name,
            dob: signupData.dob,
            language: signupData.language,
            email: signupData.email
          })
          .eq('id', userId);
        
        if (updateError) {
          console.error('Update error:', updateError);
          showError('step2-error', 'Profile update failed: ' + updateError.message);
          setLoading('submit-signup-btn', false, 'Create Account');
          return;
        }
        
        console.log('User profile updated successfully');
      } else {
        showError('step2-error', 'Account created but profile setup failed. Error: ' + insertError.message);
        setLoading('submit-signup-btn', false, 'Create Account');
        return;
      }
    }

    console.log('User profile inserted successfully');

    showSuccess('step2-success', '✅ Account created! Redirecting...');
    
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);

  } catch (err) {
    console.error('Signup exception:', err);
    showError('step2-error', 'Something went wrong: ' + err.message);
    setLoading('submit-signup-btn', false, 'Create Account');
  }
}

// -----------------------------------------------------------
// 8. HANDLE LOGIN (Email Only)
// -----------------------------------------------------------
async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showError('login-error', 'Please fill in all fields.');
    return;
  }

  showError('login-error', '');
  setLoading('submit-login-btn', true, 'Signing In...');

  try {
    console.log('Attempting login with email:', email);

    // Login with email + password
    const { data, error } = await db.auth.signInWithPassword({ 
      email: email, 
      password: password 
    });

    console.log('Login response:', { data, error });

    if (error) {
      console.error('Login error:', error);
      
      if (error.message.includes('Invalid login')) {
        showError('login-error', 'Wrong email or password.');
      } else if (error.message.includes('Email not confirmed')) {
        showError('login-error', 'Please verify your email first.');
      } else {
        showError('login-error', error.message);
      }
      
      setLoading('submit-login-btn', false, 'Sign In');
      return;
    }

    console.log('Login successful');

    // Logged in successfully
    window.location.href = 'index.html';

  } catch (err) {
    console.error('Login exception:', err);
    showError('login-error', 'Something went wrong: ' + err.message);
    setLoading('submit-login-btn', false, 'Sign In');
  }
}

// -----------------------------------------------------------
// 9. AUTO REDIRECT IF ALREADY LOGGED IN
// -----------------------------------------------------------
async function checkAuth() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      console.log('User already logged in, redirecting...');
      window.location.href = 'index.html';
    }
  } catch (e) {
    console.warn('Auth check error:', e);
    // Not logged in — stay here
  }
}

// -----------------------------------------------------------
// INIT
// -----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  console.log('Login page loaded');
  checkAuth();
  loadBackground();
});
