import { db } from '../db.js'
import { auth } from '../auth.js'
import { esc, toast, NOT_FOUND, fmtDate, rich, hero, statusBadge } from '../ui.js'

const canSeeCourse = (id) => auth.isStaff || auth.courseIds.includes(id)

// What each kind of course item looks like and where it opens.
export const KIND = {
  slides: { icon: '🖥️', label: 'מצגת' },
  video: { icon: '🎬', label: 'סרטון' },
  exercise: { icon: '✏️', label: 'תרגיל' },
}
export const itemHref = (it) => (it.kind === 'exercise' && (it.exercises || [])[0]
  ? `#/exercise/${it.exercises[0].id}`
  : `#/lecture/${it.id}`)

// ---------- home: my courses ----------
export async function home(view) {
  const courses = (await db.listCourses()).filter((c) => canSeeCourse(c.id))
  view.render(`
    ${hero({ title: 'הקורסים שלי' })}
    ${courses.length ? `<div class="cards">${courses.map((c) => `
      <a class="card" href="#/course/${esc(c.id)}">
        <h2>${esc(c.title)}</h2>
        <span class="go">כניסה לקורס ←</span>
      </a>`).join('')}</div>`
      : `<div class="empty"><p>עדיין אין קורסים.</p>${auth.isStaff ? '<a class="btn primary" href="#/manage">להוספת קורס</a>' : ''}</div>`}`)
}

// ---------- course: its presentations, videos and exercises ----------
export async function course(view, id) {
  if (!canSeeCourse(id)) return view.render(NOT_FOUND)
  const c = await db.getCourse(id)
  if (!c) return view.render(NOT_FOUND)
  const items = await db.listLectures(id)
  view.render(`
    ${hero({ title: c.title, crumbs: [['#/', 'הקורסים שלי']],
      actions: auth.isStaff ? `<a class="btn small ghost" href="#/manage/course/${esc(id)}">עריכת הקורס</a>` : '' })}
    ${items.length ? `<ol class="lecture-list">${items.map((it) => {
      const k = KIND[it.kind] || KIND.slides
      return `<li><a href="${itemHref(it)}">
        <span class="num" aria-hidden="true">${k.icon}</span>
        <span class="title">${esc(it.title)}<span class="muted small">${k.label}</span></span>
        <span class="arrow">←</span>
      </a></li>`
    }).join('')}</ol>`
      : '<div class="empty"><p>עדיין לא הועלו מצגות או סרטונים לקורס הזה.</p></div>'}`)
}

async function loadItem(id) {
  const it = await db.getLecture(id)
  if (!it || !canSeeCourse(it.course_id)) return null
  const c = await db.getCourse(it.course_id)
  return { it, c }
}

// ---------- one item: a presentation or a video ----------
export async function lecture(view, id) {
  const data = await loadItem(id)
  if (!data) return view.render(NOT_FOUND)
  const { it, c } = data
  if (it.kind === 'exercise' && (it.exercises || [])[0]) { location.replace(`#/exercise/${it.exercises[0].id}`); return }
  if (it.kind !== 'video') return slidesPage(view, id, data)
  if (!it.slides_path) return view.render(`${hero({ title: it.title, crumbs: [['#/', 'הקורסים שלי'], [`#/course/${c.id}`, c.title]] })}<div class="empty"><p>הסרטון עוד לא הועלה.</p></div>`)
  const url = await db.getFileUrl(it)
  view.render(`
    ${hero({ title: it.title, crumbs: [['#/', 'הקורסים שלי'], [`#/course/${c.id}`, c.title]],
      actions: auth.isStaff ? `<a class="btn small ghost" href="#/manage/lecture/${esc(id)}">עריכה</a>` : '' })}
    <div class="player"><video src="${esc(url)}" controls playsinline preload="metadata"></video></div>`)
}

// ---------- presentation ----------
const HIDE_NOTES = '<style>#notes,#notesBtn,.notes,aside.n{display:none!important}</style>'

export async function slidesPage(view, id, loaded) {
  const data = loaded || await loadItem(id)
  if (!data) return view.render(NOT_FOUND)
  const { it, c } = data
  if (!it.slides_path) return view.render(`${hero({ title: it.title, crumbs: [['#/', 'הקורסים שלי'], [`#/course/${c.id}`, c.title]] })}<div class="empty"><p>המצגת עוד לא הועלתה.</p></div>`)
  const html = await db.getSlidesHtml(it)
  const root = view.render(`
    <div class="deck-bar">
      <a class="btn small ghost" href="#/course/${esc(c.id)}">→ חזרה לקורס</a>
      <span class="deck-title">${esc(it.title)}</span>
      ${auth.isStaff ? `<a class="btn small ghost" href="#/manage/lecture/${esc(id)}">עריכה</a>` : ''}
      <button class="btn small" id="fs">מסך מלא</button>
    </div>
    <iframe class="deck" title="מצגת: ${esc(it.title)}" sandbox="allow-scripts allow-popups" allow="fullscreen"></iframe>
    ${auth.isStaff ? '<p class="hint center">את רואה את הערות הדובר כי את מנהלת. תלמידות לא רואות אותן.</p>' : '<p class="hint center">מעבר בין שקפים: חצים במקלדת או הכפתורים במצגת.</p>'}`)
  if (!root) return
  root.classList.add('wide')
  const frame = root.querySelector('iframe.deck')
  // Students never see the speaker notes.
  frame.srcdoc = auth.isStaff ? html : (/<head/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${HIDE_NOTES}`) : HIDE_NOTES + html)
  root.querySelector('#fs').addEventListener('click', () => frame.requestFullscreen?.())
  frame.addEventListener('load', () => frame.focus())
}

// ---------- exercise + submission ----------
export async function exercise(view, id) {
  const ex = await db.getExercise(id)
  if (!ex) return view.render(NOT_FOUND)
  const crs = ex.lectures.courses
  if (!canSeeCourse(crs.id)) return view.render(NOT_FOUND)
  const mine = auth.isStaff ? null : await db.mySubmission(id, auth.email)
  const locked = mine?.status === 'reviewed'
  const root = view.render(`
    ${hero({ title: ex.title, text: ex.due_at ? 'להגשה עד ' + fmtDate(ex.due_at) : '', crumbs: [['#/', 'הקורסים שלי'], [`#/course/${crs.id}`, crs.title]],
      actions: auth.isStaff ? `<a class="btn small" href="#/manage/exercise/${esc(id)}/submissions">📥 הגשות</a><a class="btn small ghost" href="#/manage/lecture/${esc(ex.lectures.id)}">עריכה</a>` : '' })}
    <section class="panel"><h2>מה צריך לעשות</h2>${ex.instructions ? rich(ex.instructions) : '<p class="muted">אין הוראות.</p>'}</section>
    ${auth.isStaff ? '<section class="panel muted-panel"><p class="muted">כמנהלת את לא מגישה. ההגשות של התלמידות נמצאות בכפתור "הגשות".</p></section>' : `
    <section class="panel">
      <div class="page-head"><h2>ההגשה שלי</h2>${mine ? statusBadge(mine.status) : ''}</div>
      ${mine?.feedback ? `<div class="feedback"><b>משוב:</b><div class="prose">${esc(mine.feedback)}</div></div>` : ''}
      ${locked ? `<p class="muted">התרגיל נבדק, ולכן אי אפשר לשנות את ההגשה.</p>
        ${mine.link ? `<p class="submitted-link">🔗 <a href="${esc(mine.link)}" target="_blank" rel="noopener" dir="ltr">${esc(mine.link)}</a></p>` : ''}
        ${mine.answer ? `<div class="prose">${esc(mine.answer)}</div>` : ''}` : `
      <form class="form" id="sub">
        <label>קישור לעבודה (Google Drive, GitHub וכדומה)
          <input id="sub-link" name="link" type="url" dir="ltr" placeholder="https://" value="${esc(mine?.link || '')}">
        </label>
        <label>תשובה או הערה למרצה
          <textarea id="sub-answer" name="answer" rows="5">${esc(mine?.answer || '')}</textarea>
        </label>
        <div class="actions"><button class="btn primary">${mine ? 'עדכון ההגשה' : 'הגשה'}</button></div>
        ${mine ? `<p class="hint">הוגש לאחרונה ב-${fmtDate(mine.updated_at, true)}. עדכון יחזיר את הסטטוס ל"ממתין לבדיקה".</p>` : ''}
      </form>`}
    </section>`}`)
  root?.querySelector('#sub')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = new FormData(e.target)
    const link = String(f.get('link') || '').trim(), answer = String(f.get('answer') || '').trim()
    if (!link && !answer) return toast('צריך למלא קישור או תשובה', 'error')
    const btn = e.target.querySelector('button'); btn.disabled = true
    try {
      await db.submit(id, auth.email, { link, answer })
      toast('ההגשה נשמרה', 'success')
      exercise(view, id)
    } catch (err) { toast('השמירה נכשלה: ' + err.message, 'error'); btn.disabled = false }
  })
}
