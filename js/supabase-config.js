// TODO: GANTI KONFIGURASI INI DENGAN SUPABASE CONFIG ANDA SENDIRI
// Dapatkan config ini dari menu Project Settings > API di dashboard Supabase
const supabaseUrl = 'https://xxudgwzihmqnojnkqnvk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4dWRnd3ppaG1xbm9qbmtxbnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMDA1NDIsImV4cCI6MjA5OTU3NjU0Mn0.Tz0rBZy8cXsr4uOwRGWYfNKETTxeJYT_wYJqhufXr1I';

// Inisialisasi Supabase
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("[Supabase] Inisialisasi selesai.");
