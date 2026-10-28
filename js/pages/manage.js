import { db } from '../db.js'
import { esc, toast, NOT_FOUND, fmtDate, hero, statusBadge, sure } from '../ui.js'
import { KIND, itemHref } from './student.js'

const val = (form, name) => String(new FormData(form).get(name) ?? '').trim()
const MAX_MB = 50

async function busy(btn, fn) {
  if (btn) btn.disabled = true
  try { await fn() } catch (e) { console.error(e); toast('הפעולה נכשלה: ' + e.message, 'error') } finally { if (btn) btn.disabled = false }
}

// In-page "are you sure?" (some browsers block the built-in confirm box).
function confirmIn(btn, question, onYes) {
  const box = document.createElement('div')
  box.className = 'confirm'
  box.innerHTML = `<span>${esc(question)}</span><button type="button" class="btn small danger">כן, למחוק</button><button type="button" class="btn small ghost">ביטול</button>`
  btn.hidden = true
  btn.after(box)
  const [yes, no] = box.querySelectorAll('button')
  no.addEventListener('click', () => { box.remove(); btn.hidden = false })
  yes.addEventListener('click', () => busy(yes, onYes))
}

function checkFile(file, kind) {
  if (!file) return 'צריך לבחור קובץ.'
  if (kind === 'slides' && !/\.html?$/i.test(file.name)) return 'מצגת צריכה להיות קובץ HTML.'
  if (kind === 'video' && !/^video\//.test(file.type) && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) return 'סרטון צריך להיות קובץ וידאו (MP4).'
  if (file.size > MAX_MB * 1024 * 1024) return `הקובץ גדול מ-${MAX_MB}MB. אפשר לכווץ אותו (למשל ב-HandBrake) ולנסות שוב.`
  return ''
}

// ---------- all courses ----------
export async function manageHome(view) {
  const courses = await db.listCourses()
  const root = view.render(`
    ${hero({ title: 'ניהול קורסים' })}
    <section class="panel">
      <h2>קורס חדש</h2>
      <form class="form inline" id="new-course">
        <input id="new-course-title" name="title" required placeholder="שם הקורס">
        <button class="btn primary">יצירה</button>
      </form>
    </section>
    ${courses.length ? `<ol class="lecture-list">${courses.map((c) => `
      <li><a href="#/manage/course/${esc(c.id)}">
        <span class="title">${esc(c.title)}</span><span class="arrow">←</span></a></li>`).join('')}</ol>`
      : '<p class="muted">עדיין אין קורסים.</p>'}`)
  root?.querySelector('#new-course').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    if (!val(f, 'title')) return toast('צריך לכתוב שם לקורס', 'error')
    busy(f.querySelector('button'), async () => {
      const c = await db.saveCourse({ title: val(f, 'title'), position: courses.length + 1 })
      toast('הקורס נוצר', 'success')
      location.hash = `#/manage/course/${c.id}`
    })
  })
}

// ---------- one course: name + its items ----------
export async function manageCourse(view, id) {
  const c = await db.getCourse(id)
  if (!c) return view.render(NOT_FOUND)
  const items = await db.listLectures(id)
  const root = view.render(`
    ${hero({ title: c.title, crumbs: [['#/manage', 'ניהול קורסים']],
      actions: `<a class="btn small ghost" href="#/course/${esc(id)}">תצוגת תלמידה</a>` })}
    <div class="add-row">
      <a class="btn primary" href="#/manage/course/${esc(id)}/new/slides">🖥️ + מצגת</a>
      <a class="btn primary" href="#/manage/course/${esc(id)}/new/video">🎬 + סרטון</a>
      <a class="btn" href="#/manage/course/${esc(id)}/new/exercise">✏️ + תרגיל</a>
    </div>
    ${items.length ? `<ol class="lecture-list manage">${items.map((it, i) => {
      const k = KIND[it.kind] || KIND.slides
      const ex = (it.exercises || [])[0]
      return `<li data-id="${esc(it.id)}">
        <a href="#/manage/lecture/${esc(it.id)}">
          <span class="num" aria-hidden="true">${k.icon}</span>
          <span class="title">${esc(it.title)}<span class="muted small">${k.label}${it.kind !== 'exercise' && !it.slides_path ? ' · אין קובץ' : ''}</span></span>
          <span class="arrow">←</span>
        </a>
        ${ex ? `<a class="btn small views-btn" href="#/manage/exercise/${esc(ex.id)}/submissions">📥 הגשות</a>` : ''}
        <span class="order">
          <button type="button" class="btn small ghost" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="להזיז למעלה">▲</button>
          <button type="button" class="btn small ghost" data-move="1" ${i === items.length - 1 ? 'disabled' : ''} aria-label="להזיז למטה">▼</button>
        </span>
      </li>`
    }).join('')}</ol>` : '<div class="empty"><p>הקורס ריק. מוסיפים מצגת, סרטון או תרגיל בכפתורים למעלה.</p></div>'}
    <details class="panel">
      <summary>שינוי שם הקורס</summary>
      <form class="form inline details-body" id="course-form">
        <input id="course-title" name="title" required value="${esc(c.title)}">
        <button class="btn primary">שמירה</button>
      </form>
    </details>
    <details class="panel danger-zone">
      <summary>מחיקת הקורס</summary>
      <div class="details-body">
        <p class="muted">יימחקו גם כל המצגות, הסרטונים, התרגילים וההגשות של הקורס. אי אפשר לבטל.</p>
        <button class="btn danger" id="del-course">מחיקת הקורס</button>
      </div>
    </details>`)
  if (!root) return
  root.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
    const li = b.closest('li'), i = items.findIndex((x) => x.id === li.dataset.id), j = i + +b.dataset.move
    if (j < 0 || j >= items.length) return
    ;[items[i], items[j]] = [items[j], items[i]]
    busy(b, async () => { await db.reorder(items.map((x) => x.id)); manageCourse(view, id) })
  }))
  root.querySelector('#course-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    busy(f.querySelector('button'), async () => { await db.saveCourse({ id, title: val(f, 'title') }); toast('נשמר', 'success'); manageCourse(view, id) })
  })
  const del = root.querySelector('#del-course')
  del.addEventListener('click', () => confirmIn(del, `למחוק את "${c.title}"?`, async () => {
    await db.deleteCourse(id); toast('הקורס נמחק'); location.hash = '#/manage'
  }))
}

// ---------- add or edit one item ----------
export async function lectureEditor(view, id, courseId, kind) {
  const it = id ? await db.getLecture(id) : null
  if (id && !it) return view.render(NOT_FOUND)
  courseId = courseId || it.course_id
  kind = it?.kind || kind || 'slides'
  if (!KIND[kind]) return view.render(NOT_FOUND)
  const c = await db.getCourse(courseId)
  if (!c) return view.render(NOT_FOUND)
  const k = KIND[kind]
  const ex = (it?.exercises || [])[0] || null
  const isFile = kind !== 'exercise'
  const accept = kind === 'slides' ? '.html,.htm,text/html' : 'video/*,.mp4,.webm,.mov'

  const root = view.render(`
    ${hero({ title: it ? it.title : `${k.label} חדש${kind === 'slides' ? 'ה' : ''}`, crumbs: [['#/manage', 'ניהול קורסים'], [`#/manage/course/${c.id}`, c.title]],
      actions: it ? `<a class="btn small ghost" href="${itemHref(it)}">צפייה</a>` : '' })}
    <form class="panel form" id="item">
      <label>כותרת<input id="item-title" name="title" required value="${esc(it?.title || '')}" placeholder="${kind === 'video' ? 'למשל: איך נולדה הבינה המלאכותית' : kind === 'slides' ? 'למשל: מפגש 1, מבוא ל-AI' : 'למשל: תרגיל 1'}"></label>
      ${isFile ? `
      <label>${kind === 'slides' ? 'קובץ המצגת (HTML)' : 'קובץ הסרטון (MP4, עד 50MB)'}
        ${it?.slides_path ? `<span class="ok-text">✓ הועלה: <bdi dir="ltr">${esc(it.slides_name || '')}</bdi>. אפשר לבחור קובץ חדש כדי להחליף.</span>` : ''}
        <input id="item-file" type="file" name="file" accept="${accept}" ${it?.slides_path ? '' : 'required'}>
      </label>
      <p class="hint" id="upload-note" hidden>מעלה את הקובץ… סרטון יכול לקחת דקה-שתיים. לא לסגור את הדף.</p>` : `
      <label>מה צריך לעשות<textarea id="item-instructions" name="instructions" rows="6">${esc(ex?.instructions || '')}</textarea>
        <span class="hint">שורה שמתחילה ב-### היא כותרת, ושורה שמתחילה ב-- היא סעיף ברשימה.</span></label>
      <label class="narrow-field">תאריך הגשה (לא חובה)<input id="item-due" name="due_at" type="date" value="${esc(ex?.due_at || '')}"></label>`}
      <div class="actions"><button class="btn primary">${it ? 'שמירה' : 'הוספה לקורס'}</button>
        ${ex ? `<a class="btn" href="#/manage/exercise/${esc(ex.id)}/submissions">📥 הגשות</a>` : ''}</div>
    </form>
    ${it ? `<section class="panel danger-zone"><button class="btn danger ghost" id="del-item">מחיקה מהקורס</button></section>` : ''}`)
  if (!root) return

  root.querySelector('#item').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    const title = val(f, 'title')
    if (!title) return toast('צריך כותרת', 'error')
    const file = isFile ? f.file.files[0] : null
    if (isFile && (file || !it?.slides_path)) {
      const problem = checkFile(file, kind)
      if (problem) return toast(problem, 'error')
    }
    busy(f.querySelector('.btn.primary'), async () => {
      const saved = await db.saveLecture({ id: it?.id, course_id: courseId, kind, title })
      if (file) {
        root.querySelector('#upload-note').hidden = false
        await db.uploadFile(saved.id, file, kind)
      }
      if (!isFile) await db.saveExercise({ id: ex?.id, lecture_id: saved.id, title, instructions: val(f, 'instructions'), due_at: val(f, 'due_at') || null })
      toast(it ? 'נשמר' : 'נוסף לקורס', 'success')
      location.hash = `#/manage/course/${courseId}`
    })
  })
  const del = root.querySelector('#del-item')
  del?.addEventListener('click', () => confirmIn(del, `למחוק את "${it.title}"${kind === 'exercise' ? ' וכל ההגשות שלו' : ''}?`, async () => {
    await db.deleteLecture(it.id); toast('נמחק'); location.hash = `#/manage/course/${courseId}`
  }))
}

// ---------- submissions of one exercise ----------
export async function submissions(view, exerciseId) {
  const ex = await db.getExercise(exerciseId)
  if (!ex) return view.render(NOT_FOUND)
  const crs = ex.lectures.courses
  const [subs, enrolled] = await Promise.all([db.listSubmissions(exerciseId), db.listEnrollments(crs.id)])
  const missing = enrolled.map((r) => r.email).filter((e) => !subs.some((s) => s.email === e))
  const root = view.render(`
    ${hero({ title: 'הגשות: ' + ex.title, crumbs: [['#/submissions', 'הגשות'], [`#/manage/course/${crs.id}`, crs.title]] })}
    <div class="stat-row">
      <div class="stat"><b>${subs.length}</b><span>הגישו</span></div>
      <div class="stat"><b>${subs.filter((s) => s.status === 'submitted').length}</b><span>מחכות לבדיקה</span></div>
      <div class="stat"><b>${missing.length}</b><span>עוד לא הגישו</span></div>
    </div>
    <section class="panel">
      ${subs.length ? subs.map((s) => `
        <div class="submission" data-id="${esc(s.id)}">
          <div class="submission-head"><b dir="ltr">${esc(s.email)}</b><span>${statusBadge(s.status)} <span class="muted small">${fmtDate(s.updated_at, true)}</span></span></div>
          ${s.link ? `<p class="submitted-link">🔗 <a href="${esc(s.link)}" target="_blank" rel="noopener" dir="ltr">${esc(s.link)}</a></p>` : ''}
          ${s.answer ? `<div class="prose">${esc(s.answer)}</div>` : ''}
          <form class="form review">
            <label>משוב<textarea name="feedback" rows="2">${esc(s.feedback || '')}</textarea></label>
            <div class="actions">
              <button class="btn small primary" name="status" value="reviewed">נבדק ✓</button>
              <button class="btn small" name="status" value="needs_fix">צריך תיקון</button>
            </div>
          </form>
        </div>`).join('') : '<p class="muted">עדיין אין הגשות.</p>'}
    </section>
    ${missing.length ? `<details class="panel"><summary>מי עוד לא הגישה (${missing.length})</summary><ul class="plain details-body">${missing.map((e) => `<li dir="ltr">${esc(e)}</li>`).join('')}</ul></details>` : ''}`)
  root?.querySelectorAll('form.review').forEach((f) => f.addEventListener('submit', (e) => {
    e.preventDefault()
    const status = e.submitter?.value || 'reviewed'
    const id = f.closest('.submission').dataset.id
    busy(e.submitter, async () => {
      await db.reviewSubmission(id, { status, feedback: val(f, 'feedback') })
      toast('המשוב נשמר', 'success'); submissions(view, exerciseId)
    })
  }))
}

// ---------- all exercises with their submissions ----------
export async function submissionsHome(view) {
  const courses = await db.listCourses()
  const groups = []
  for (const c of courses) {
    const rows = []
    for (const it of (await db.listLectures(c.id)).filter((x) => (x.exercises || []).length)) {
      const exId = it.exercises[0].id
      const subs = await db.listSubmissions(exId)
      rows.push({ it, exId, total: subs.length, waiting: subs.filter((s) => s.status === 'submitted').length })
    }
    if (rows.length) groups.push({ c, rows })
  }
  const waitingAll = groups.reduce((n, g) => n + g.rows.reduce((m, r) => m + r.waiting, 0), 0)
  view.render(`
    ${hero({ title: 'הגשות', text: waitingAll ? `${waitingAll} הגשות מחכות לבדיקה.` : 'אין הגשות שמחכות לבדיקה.' })}
    ${groups.length ? groups.map(({ c, rows }) => `
      <section class="panel">
        <h2>${esc(c.title)}</h2>
        <ol class="lecture-list">${rows.map(({ it, exId, total, waiting }) => `
          <li><a href="#/manage/exercise/${esc(exId)}/submissions">
            <span class="num" aria-hidden="true">✏️</span>
            <span class="title">${esc(it.title)}
              <span class="lesson-badges">
                <span class="badge">${total} הגישו</span>
                ${waiting ? `<span class="badge submitted">${waiting} מחכות לבדיקה</span>` : '<span class="badge reviewed">הכול נבדק</span>'}
              </span></span>
            <span class="arrow">←</span>
          </a></li>`).join('')}</ol>
      </section>`).join('')
    : '<div class="empty"><p>עדיין אין תרגילים. מוסיפים תרגיל בדף הקורס.</p><a class="btn primary" href="#/manage">לניהול קורסים</a></div>'}`)
}
