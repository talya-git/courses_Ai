import { db } from '../db.js'
import { auth } from '../auth.js'
import { esc, toast, NOT_FOUND, fmtDate, rich, hero, embedUrl, statusBadge } from '../ui.js'

const canSeeCourse = (id) => auth.isStaff || auth.courseIds.includes(id)

// ---------- home: my courses ----------
export async function home(view) {
  const all = await db.listCourses()
  const courses = all.filter((c) => canSeeCourse(c.id))
  view.render(`
    ${hero({ title: 'הקורסים שלי', text: courses.length ? 'בחרי קורס כדי לראות את ההרצאות, המצגות והתרגילים.' : '' })}
    ${courses.length ? `<div class="cards">${courses.map((c) => `
      <a class="card" href="#/course/${esc(c.id)}">
        <div class="card-icon">${esc(c.icon || '🎓')}</div>
        <h2>${esc(c.title)}</h2>
        <p class="muted">${esc(c.description)}</p>
        <span class="go">כניסה לקורס ←</span>
      </a>`).join('')}</div>`
      : `<div class="empty"><p>עדיין אין קורסים.</p>${auth.isStaff ? '<a class="btn primary" href="#/manage">להוספת קורס</a>' : ''}</div>`}`)
}

// ---------- course: list of lectures ----------
export async function course(view, id) {
  if (!canSeeCourse(id)) return view.render(NOT_FOUND)
  const c = await db.getCourse(id)
  if (!c) return view.render(NOT_FOUND)
  const lectures = (await db.listLectures(id)).filter((l) => l.published || auth.isStaff)
  view.render(`
    ${hero({ title: c.title, text: c.description, crumbs: [['#/', 'הקורסים שלי']],
      actions: auth.isStaff ? `<a class="btn small ghost" href="#/manage/course/${esc(id)}">עריכת הקורס</a>` : '' })}
    ${lectures.length ? `<ol class="lecture-list">${lectures.map((l) => `
      <li><a href="#/lecture/${esc(l.id)}">
        <span class="num">${esc(l.number)}</span>
        <span class="title">${esc(l.title)}${l.published ? '' : ' <span class="badge warn">טיוטה</span>'}</span>
        <span class="arrow">←</span>
      </a></li>`).join('')}</ol>`
      : '<div class="empty"><p>עדיין לא פורסמו הרצאות בקורס הזה.</p></div>'}`)
}

async function loadLecture(id) {
  const l = await db.getLecture(id)
  if (!l || !canSeeCourse(l.course_id) || (!l.published && !auth.isStaff)) return null
  const c = await db.getCourse(l.course_id)
  return { l, c, ex: (l.exercises || [])[0] || null }
}

// ---------- lecture: the four big buttons ----------
export async function lecture(view, id) {
  const data = await loadLecture(id)
  if (!data) return view.render(NOT_FOUND)
  const { l, c, ex } = data
  if (!auth.isStaff) db.recordView(id).catch(() => {})
  const mats = l.materials || []
  const video = embedUrl(l.video_url)
  const action = (href, icon, title, text, enabled) => enabled
    ? `<a class="action-card" href="${href}"><span class="action-icon">${icon}</span><span class="action-title">${title}</span><span class="action-text">${text}</span></a>`
    : `<div class="action-card disabled" aria-disabled="true"><span class="action-icon">${icon}</span><span class="action-title">${title}</span><span class="action-text">עדיין לא הועלה</span></div>`
  view.render(`
    ${hero({ title: l.title, badge: `הרצאה ${l.number}`, crumbs: [['#/', 'הקורסים שלי'], [`#/course/${c.id}`, c.title]],
      actions: auth.isStaff ? `<a class="btn small ghost" href="#/manage/lecture/${esc(id)}">עריכה</a>` : '' })}
    <div class="action-grid">
      ${action(`#/lecture/${id}/slides`, '🖥️', 'מצגת', 'צפייה במצגת השיעור', !!l.slides_path)}
      ${action(`#/lecture/${id}/materials`, '📚', 'חומרי לימוד', `${mats.length} קישורים`, mats.length > 0)}
      ${action(ex ? `#/exercise/${ex.id}` : '', '✏️', 'תרגיל', ex ? 'הגשה ומשוב' : '', !!ex)}
      ${action('#video', '🎬', 'הקלטה', 'צפייה בהקלטת השיעור', !!video)}
    </div>
    ${l.summary ? `<section class="panel"><h2>על השיעור</h2>${rich(l.summary)}</section>` : ''}
    ${video ? `<section class="panel" id="video"><h2>הקלטת השיעור</h2><div class="video"><iframe src="${esc(video)}" title="הקלטת השיעור" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div></section>` : ''}
    ${ex ? `<section class="panel exercise-cta"><div><h2>${esc(ex.title)}</h2><p class="muted">${ex.due_at ? 'להגשה עד ' + fmtDate(ex.due_at) : 'אפשר להגיש בכל זמן'}</p></div><div class="actions">${auth.isStaff ? `<a class="btn" href="#/manage/exercise/${esc(ex.id)}/submissions">📥 הגשות</a>` : ''}<a class="btn primary" href="#/exercise/${esc(ex.id)}">לתרגיל ←</a></div></section>` : ''}`)
  const vlink = document.querySelector('a.action-card[href="#video"]')
  vlink?.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('video')?.scrollIntoView({ behavior: 'smooth' }) })
}

// ---------- materials ----------
export async function materials(view, id) {
  const data = await loadLecture(id)
  if (!data) return view.render(NOT_FOUND)
  const { l, c } = data
  const mats = l.materials || []
  const icon = (url) => /\.pdf($|\?)/i.test(url) ? '📄' : /youtu|vimeo/.test(url) ? '🎬' : /github/.test(url) ? '💻' : /docs\.google|drive\.google/.test(url) ? '📝' : '🔗'
  view.render(`
    ${hero({ title: 'חומרי לימוד', text: l.title, crumbs: [['#/', 'הקורסים שלי'], [`#/course/${c.id}`, c.title], [`#/lecture/${l.id}`, l.title]] })}
    <section class="panel">
      ${mats.length ? `<ul class="link-list">${mats.map((m) => `
        <li><a href="${esc(m.url)}" target="_blank" rel="noopener">
          <span class="link-icon">${icon(m.url)}</span>
          <span><b>${esc(m.title || m.url)}</b><span class="muted small" dir="ltr">${esc(m.url)}</span></span>
        </a></li>`).join('')}</ul>` : '<p class="muted">עדיין אין חומרים להרצאה הזו.</p>'}
    </section>`)
}

// ---------- slides ----------
const HIDE_NOTES = '<style>#notes,#notesBtn,.notes,aside.n{display:none!important}</style>'

export async function slidesPage(view, id) {
  const data = await loadLecture(id)
  if (!data || !data.l.slides_path) return view.render(NOT_FOUND)
  const { l } = data
  const html = await db.getSlidesHtml(l)
  const root = view.render(`
    <div class="deck-bar">
      <a class="btn small ghost" href="#/lecture/${esc(l.id)}">→ חזרה להרצאה</a>
      <span class="deck-title">${esc(l.title)}</span>
      <button class="btn small" id="fs">מסך מלא</button>
    </div>
    <iframe class="deck" title="מצגת: ${esc(l.title)}" sandbox="allow-scripts allow-popups" allow="fullscreen"></iframe>
    ${auth.isStaff ? '<p class="hint center">את רואה את הערות הדובר כי את מנהלת. תלמידות לא רואות אותן.</p>' : '<p class="hint center">מעבר בין שקפים: חצים במקלדת או לחיצה על הכפתורים במצגת.</p>'}`)
  if (!root) return
  root.classList.add('wide')
  const frame = root.querySelector('iframe.deck')
  // Students never see the speaker notes.
  frame.srcdoc = auth.isStaff ? html : html.replace(/<head([^>]*)>/i, `<head$1>${HIDE_NOTES}`) + (/<head/i.test(html) ? '' : HIDE_NOTES)
  root.querySelector('#fs').addEventListener('click', () => frame.requestFullscreen?.())
  frame.addEventListener('load', () => frame.focus())
}

// ---------- exercise + submission ----------
export async function exercise(view, id) {
  const ex = await db.getExercise(id)
  if (!ex) return view.render(NOT_FOUND)
  const lec = ex.lectures, crs = lec.courses
  if (!canSeeCourse(crs.id)) return view.render(NOT_FOUND)
  const mine = auth.isStaff ? null : await db.mySubmission(id, auth.email)
  const locked = mine?.status === 'reviewed'
  const root = view.render(`
    ${hero({ title: ex.title, text: ex.due_at ? 'להגשה עד ' + fmtDate(ex.due_at) : '', crumbs: [['#/', 'הקורסים שלי'], [`#/course/${crs.id}`, crs.title], [`#/lecture/${lec.id}`, lec.title]],
      actions: auth.isStaff ? `<a class="btn small ghost" href="#/manage/exercise/${esc(id)}/submissions">הגשות</a>` : '' })}
    <section class="panel"><h2>מה צריך לעשות</h2>${ex.instructions ? rich(ex.instructions) : '<p class="muted">אין הוראות.</p>'}</section>
    ${auth.isStaff ? '<section class="panel muted-panel"><p class="muted">כמנהלת את לא מגישה. אפשר לראות את ההגשות של התלמידות בכפתור "הגשות".</p></section>' : `
    <section class="panel">
      <div class="page-head"><h2>ההגשה שלי</h2>${mine ? statusBadge(mine.status) : ''}</div>
      ${mine?.feedback ? `<div class="feedback"><b>משוב:</b><div class="prose">${esc(mine.feedback)}</div></div>` : ''}
      ${locked ? `<p class="muted">התרגיל נבדק, ולכן אי אפשר לשנות את ההגשה.</p>
        ${mine.link ? `<p class="submitted-link">🔗 <a href="${esc(mine.link)}" target="_blank" rel="noopener" dir="ltr">${esc(mine.link)}</a></p>` : ''}
        ${mine.answer ? `<div class="prose">${esc(mine.answer)}</div>` : ''}` : `
      <form class="form" id="sub">
        <label>קישור לעבודה (Google Drive, GitHub וכדומה)
          <input name="link" type="url" dir="ltr" placeholder="https://" value="${esc(mine?.link || '')}">
        </label>
        <label>תשובה או הערה למרצה
          <textarea name="answer" rows="5">${esc(mine?.answer || '')}</textarea>
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
