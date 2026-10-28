import { supabase, demo } from './supabase.js'
import { db } from './db.js'

// Who is signed in and what they may open. Read by app.js and the pages.
export const auth = {
  session: null,
  email: '',
  role: null,        // 'admin' | 'staff' | null
  isStaff: false,
  isAdmin: false,
  courseIds: [],     // courses this student is enrolled in
}

async function loadAccess(session) {
  auth.session = session
  auth.email = (session?.user?.email || '').toLowerCase()
  auth.role = null
  auth.courseIds = []
  if (session) {
    const access = await db.myAccess(auth.email)
    auth.role = access.role
    auth.courseIds = access.courseIds
  }
  auth.isAdmin = auth.role === 'admin'
  auth.isStaff = auth.role === 'admin' || auth.role === 'staff'
}

export async function initAuth(onChange) {
  if (demo) {
    let asStudent = false
    try { asStudent = sessionStorage.getItem('demo-as') === 'student' } catch (e) {}
    await loadAccess({ user: { email: asStudent ? 'student1@demo.local' : 'talya@demo.local' } })
    const b = document.createElement('div')
    b.className = 'demo-banner'
    b.innerHTML = `מצב הדגמה: נתוני דוגמה בלבד, ושום דבר לא נשמר. את רואה את האתר ${asStudent ? 'כמו תלמידה' : 'כמנהלת'}. <button class="btn small" id="demo-switch">${asStudent ? 'לראות כמנהלת' : 'לראות כמו תלמידה'}</button>`
    document.body.prepend(b)
    b.querySelector('#demo-switch').addEventListener('click', () => {
      try { sessionStorage.setItem('demo-as', asStudent ? 'staff' : 'student') } catch (e) {}
      location.hash = '#/'; location.reload()
    })
    return
  }
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  await loadAccess(data.session)
  // Run the reload outside the auth callback: calling Supabase inside it can stall the library.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') { auth.session = session; return }
    if (event === 'INITIAL_SESSION') return
    setTimeout(async () => { await loadAccess(session); onChange() }, 0)
  })
}

const HEBREW_ERRORS = [
  [/invalid login credentials/i, 'המייל או הסיסמה לא נכונים.'],
  [/already registered|already exists/i, 'המייל הזה כבר רשום. אפשר להיכנס איתו בלשונית "כניסה".'],
  [/password should be at least|weak password/i, 'הסיסמה קצרה מדי. צריך לפחות 6 תווים.'],
  [/email not confirmed/i, 'המייל עוד לא אושר. צריך לבקש מהמרצה לכבות את אישור המייל ב-Supabase.'],
  [/invalid email|unable to validate email/i, 'כתובת המייל לא תקינה.'],
  [/rate limit|too many/i, 'יותר מדי ניסיונות. כדאי לחכות כמה דקות ולנסות שוב.'],
]
const hebrew = (error) => {
  if (!error) return null
  const hit = HEBREW_ERRORS.find(([re]) => re.test(error.message || ''))
  return { message: hit ? hit[1] : error.message }
}

export async function signIn(email, password) {
  if (demo) return { error: null }
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  return { error: hebrew(error) }
}

export async function signUp(email, password) {
  if (demo) return { error: null }
  const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password })
  if (error) return { error: hebrew(error) }
  // Supabase answers without a session when the address is already taken or email confirmation is on.
  if (!data.session) return { error: { message: 'ההרשמה לא הושלמה. אם כבר נרשמת עם המייל הזה, היכנסי בלשונית "כניסה".' } }
  return { error: null }
}

export async function signOut() {
  if (demo) { alertDemo(); return }
  await supabase.auth.signOut()
}

function alertDemo() {
  import('./ui.js').then(({ toast }) => toast('במצב הדגמה אין יציאה. בהקמה האמיתית הכפתור מנתק מהחשבון.'))
}
