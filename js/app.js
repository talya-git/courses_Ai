// Router and page frame: side navigation, login and "no access" screens.
import { config } from '../config.js'
import { configured } from './supabase.js'
import { auth, initAuth, signIn, signOut } from './auth.js'
import { esc, toast, NOT_FOUND } from './ui.js'
import { enterPage } from './motion.js'
import { home, course, lecture, materials, slidesPage, exercise } from './pages/student.js'
import { manageHome, manageCourse, lectureEditor, submissions, lessonViews, submissionsHome } from './pages/manage.js'
import { admin } from './pages/admin.js'

const main = document.getElementById('main')
const nav = document.getElementById('topbar')
document.title = config.siteName

// Each entry: address pattern, page function, and who may open it.
const ROUTES = [
  { re: /^\/$/, page: home },
  { re: /^\/course\/([\w-]+)$/, page: course },
  { re: /^\/lecture\/([\w-]+)$/, page: lecture },
  { re: /^\/lecture\/([\w-]+)\/materials$/, page: materials },
  { re: /^\/lecture\/([\w-]+)\/slides$/, page: slidesPage },
  { re: /^\/exercise\/([\w-]+)$/, page: exercise },
  { re: /^\/manage$/, page: manageHome, need: 'staff' },
  { re: /^\/submissions$/, page: submissionsHome, need: 'staff' },
  { re: /^\/manage\/course\/([\w-]+)$/, page: manageCourse, need: 'staff' },
  { re: /^\/manage\/course\/([\w-]+)\/new-lecture$/, page: (v, cid) => lectureEditor(v, null, cid), need: 'staff' },
  { re: /^\/manage\/lecture\/([\w-]+)$/, page: (v, id) => lectureEditor(v, id), need: 'staff' },
  { re: /^\/manage\/exercise\/([\w-]+)\/submissions$/, page: submissions, need: 'staff' },
  { re: /^\/manage\/lecture\/([\w-]+)\/views$/, page: lessonViews, need: 'staff' },
  { re: /^\/admin(?:\/([\w-]+))?$/, page: admin, need: 'admin' },
]

let current = 0

// A page draws itself through view.render; an older, slower page can't overwrite a newer one.
function makeView(id) {
  return {
    render(html) {
      if (id !== current) return null
      main.classList.remove('wide')
      main.innerHTML = html
      enterPage(main)
      window.scrollTo(0, 0)
      return main
    },
  }
}

const allowed = (need) => !need || (need === 'staff' && auth.isStaff) || (need === 'admin' && auth.isAdmin)

async function route() {
  const id = ++current
  const view = makeView(id)
  const path = location.hash.replace(/^#/, '') || '/'

  if (!auth.session) return gate(loginScreen())
  if (!auth.isStaff && !auth.courseIds.length) return gate(noAccessScreen())
  document.body.classList.remove('gated')
  drawNav(path)

  const hit = ROUTES.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m)
  if (!hit || !allowed(hit.r.need)) return view.render(NOT_FOUND)
  view.render('<p class="muted loading">טוען…</p>')
  try {
    await hit.r.page(view, ...hit.m.slice(1))
  } catch (e) {
    console.error(e)
    view.render(`<div class="empty"><h1>משהו השתבש</h1><p class="muted">${esc(e.message)}</p><p><a class="btn" href="#/">לדף הבית</a></p></div>`)
  }
}

function drawNav(path) {
  const item = (href, label, glyph, on) =>
    `<a href="${href}" class="nav-item${on ? ' on' : ''}"><span class="glyph" aria-hidden="true">${glyph}</span><span>${label}</span></a>`
  const inSubs = path.startsWith('/submissions') || /^\/manage\/exercise\//.test(path)
  const inManage = path.startsWith('/manage') && !inSubs, inAdmin = path.startsWith('/admin')
  nav.hidden = false
  nav.innerHTML = `
    <a class="brand" href="#/"><span class="mark" aria-hidden="true"></span><span>${esc(config.siteName)}</span></a>
    <nav class="nav" aria-label="ניווט ראשי">
      ${item('#/', 'הקורסים שלי', '◆', !inManage && !inAdmin && !inSubs)}
      ${auth.isStaff ? item('#/manage', 'ניהול תוכן', '▤', inManage) : ''}
      ${auth.isStaff ? item('#/submissions', 'הגשות', '✎', inSubs) : ''}
      ${auth.isAdmin ? item('#/admin', 'הרשאות', '◎', inAdmin) : ''}
    </nav>
    <div class="who">
      <span class="who-mail" dir="ltr">${esc(auth.email)}</span>
      <button id="logout" class="btn small ghost">יציאה</button>
    </div>`
  nav.querySelector('#logout').addEventListener('click', () => signOut())
}

function gate(html) {
  current++
  nav.hidden = true
  document.body.classList.add('gated')
  main.innerHTML = html
  return main
}

const gateFrame = (inner) => `
  <section class="gate">
    <div class="gate-art" aria-hidden="true">
      <div class="grid-dots"></div>
      <div class="node n1"></div><div class="node n2"></div><div class="node n3"></div><div class="node n4"></div>
      <svg class="wires" viewBox="0 0 400 400" preserveAspectRatio="none"><path d="M70 90 L210 160 L320 110 M210 160 L150 300 L300 290"/></svg>
    </div>
    <div class="gate-card">${inner}</div>
  </section>`

function loginScreen() {
  const root = gate(gateFrame(`
    <p class="eyebrow">כניסה לאתר</p>
    <h1>${esc(config.siteName)}</h1>
    <p class="muted">האתר פתוח רק למיילים שאושרו. נכנסים עם חשבון ה-Google של המייל שמסרת.</p>
    <button id="signin" class="btn primary big">כניסה עם Google</button>`))
  root.querySelector('#signin').addEventListener('click', async () => {
    const { error } = await signIn()
    if (error) toast('הכניסה נכשלה: ' + error.message, 'error')
  })
  return root
}

function noAccessScreen() {
  const root = gate(gateFrame(`
    <p class="eyebrow">אין עדיין גישה</p>
    <h1>המייל הזה לא ברשימה</h1>
    <p class="muted">נכנסת עם <b dir="ltr">${esc(auth.email)}</b>, והוא לא נמצא ברשימת התלמידות המאושרות.</p>
    <p class="muted">אם מסרת מייל אחר, צריך להיכנס איתו. אחרת אפשר לבקש מהמרצה להוסיף אותך.</p>
    <button id="switch" class="btn primary">כניסה עם חשבון אחר</button>`))
  root.querySelector('#switch').addEventListener('click', () => signOut())
  return root
}

async function start() {
  if (!configured) {
    gate(gateFrame(`<p class="eyebrow">הגדרה</p><h1>האתר עוד לא מחובר</h1>
      <p class="muted">צריך למלא את <code>supabaseUrl</code> ואת <code>supabaseAnonKey</code> בקובץ <code>config.js</code>, לפי שלב 2 במדריך (README.md).</p>`))
    return
  }
  try {
    await initAuth(route)
  } catch (e) {
    console.error(e)
    gate(gateFrame(`<h1>האתר לא נטען</h1><p class="muted">${esc(e.message)}</p>`))
    return
  }
  window.addEventListener('hashchange', route)
  route()
}

start()
