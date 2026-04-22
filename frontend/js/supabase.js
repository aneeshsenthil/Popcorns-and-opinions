// ============================================================
//  js/supabase.js — Popcorn & Opinions
//  Shared Supabase client — load this before any script
//  that needs DB access. No bundler / import.meta needed.
// ============================================================
 
const SUPABASE_URL = "https://wpykvwosrbhydpatexfx.supabase.co";
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndweWt2d29zcmJoeWRwYXRleGZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDI5MzUsImV4cCI6MjA5MTIxODkzNX0.f_8Cv-z6kXfNH6b7SnxcvEvcxaqgayNSWdpQOiTXA90';
 
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
 
