// הגדרות האתר. ממלאים לפי שלב 2 במדריך (README.md).
export const config = {
  // השם שמופיע בראש האתר ובמסך הכניסה
  siteName: 'הקורסים שלי',

  // מ-Supabase: Project Settings › API
  supabaseUrl: 'https://ptxoidynvchtbrlhqifk.supabase.co',
  supabaseAnonKey: 'sb_publishable_XIVjv95_RETxyNH4sb2HZA__TQiWj_a',

  // true = מצב הדגמה: האתר עובד עם נתוני דוגמה, בלי Supabase ובלי כניסה.
  // אחרי שממלאים את שני השדות למעלה, משנים ל-false.
  demo: false,
}
