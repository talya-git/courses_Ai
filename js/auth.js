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
  // remove ?code= left by the Google redirect
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash)
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'TOKEN_REFRESHED') { auth.session = session; return }
    if (event === 'INITIAL_SESSION') return
    await loadAccess(session)
    onChange()
  })
}

export async function signIn() {
  if (demo) return { error: null }
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
  })
}

export async function signOut() {
  if (demo) { alertDemo(); return }
  await supabase.auth.signOut()
}

function alertDemo() {
  import('./ui.js').then(({ toast }) => toast('במצב הדגמה אין יציאה. בהקמה האמיתית הכפתור מנתק מהחשבון.'))
}
