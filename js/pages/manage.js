import { db } from '../db.js'
import { esc, toast, NOT_FOUND, fmtDate, hero, statusBadge, sure } from '../ui.js'

const val = (form, name) => String(new FormData(form).get(name) ?? '').trim()

async function busy(btn, fn) {
  btn.disabled = true
  try { await fn() } catch (e) { console.error(e); toast('הפעולה נכשלה: ' + e.message, 'error') } finally { btn.disabled = false }
}

// ---------- all courses ----------
export async function manageHome(view) {
  const courses = await db.listCourses()
  const root = view.render(`
    ${hero({ title: 'ניהול תוכן', text: 'כאן יוצרים קורסים, מוסיפים הרצאות, מעלים מצגות ובודקים הגשות.' })}
    <section class="panel">
      <h2>הקורסים</h2>
      ${courses.length ? `<ol class="lecture-list manage">${courses.map((c) => `
        <li><a href="#/manage/course/${esc(c.id)}">
          <span class="num">${esc(c.icon || '🎓')}</span>
          <span class="title">${esc(c.title)}<span class="muted small">${esc(c.description)}</span></span>
          <span class="arrow">←</span></a></li>`).join('')}</ol>` : '<p class="muted">עדיין אין קורסים. אפשר להוסיף את הראשון כאן למטה.</p>'}
    </section>
    <details class="panel" ${courses.length ? '' : 'open'}>
      <summary>+ קורס חדש</summary>
      <form class="form details-body" id="new-course">
        <div class="row">
          <label>שם הקורס<input name="title" required placeholder="קורס 2: MCP, Skills ו-Agent Harness"></label>
          <label class="narrow">אייקון<input name="icon" value="🎓" maxlength="4"></label>
        </div>
        <label>תיאור קצר<textarea name="description" rows="2"></textarea></label>
        <div class="actions"><button class="btn primary">יצירת הקורס</button></div>
      </form>
    </details>`)
  root?.querySelector('#new-course').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    busy(f.querySelector('button'), async () => {
      const c = await db.saveCourse({ title: val(f, 'title'), icon: val(f, 'icon'), description: val(f, 'description'), position: courses.length + 1 })
      toast('הקורס נוצר', 'success')
      location.hash = `#/manage/course/${c.id}`
    })
  })
}

// ---------- one course ----------
export async function manageCourse(view, id) {
  const c = await db.getCourse(id)
  if (!c) return view.render(NOT_FOUND)
  const lectures = await db.listLectures(id)
  const root = view.render(`
    ${hero({ title: c.title, text: c.description, crumbs: [['#/manage', 'ניהול תוכן']],
      actions: `<a class="btn small ghost" href="#/course/${esc(id)}">תצוגת תלמידה</a>` })}
    <section class="panel">
      <div class="page-head"><h2>הרצאות</h2><a class="btn primary small" href="#/manage/course/${esc(id)}/new-lecture">+ הרצאה חדשה</a></div>
      ${lectures.length ? `<ol class="lecture-list manage">${lectures.map((l) => `
        <li>
          <a href="#/manage/lecture/${esc(l.id)}">
            <span class="num">${esc(l.number)}</span>
            <span class="title">${esc(l.title)}
              <span class="lesson-badges">
                ${l.published ? '<span class="badge reviewed">פורסם</span>' : '<span class="badge warn">טיוטה</span>'}
                <span class="badge ${l.slides_path ? '' : 'muted-badge'}">${l.slides_path ? 'יש מצגת' : 'אין מצגת'}</span>
                <span class="badge ${(l.materials || []).length ? '' : 'muted-badge'}">${(l.materials || []).length} חומרים</span>
                <span class="badge ${(l.exercises || []).length ? '' : 'muted-badge'}">${(l.exercises || []).length ? 'יש תרגיל' : 'אין תרגיל'}</span>
              </span>
            </span>
            <span class="arrow">←</span>
          </a>
          ${(l.exercises || []).length ? `<a class="btn small views-btn" href="#/manage/exercise/${esc(l.exercises[0].id)}/submissions">📥 הגשות</a>` : ''}
          <a class="btn small ghost views-btn" href="#/manage/lecture/${esc(l.id)}/views" title="מי צפתה">👁 צפיות</a>
        </li>`).join('')}</ol>` : '<p class="muted">עדיין אין הרצאות.</p>'}
    </section>
    <details class="panel">
      <summary>פרטי הקורס</summary>
      <form class="form details-body" id="course-form">
        <div class="row">
          <label>שם הקורס<input name="title" required value="${esc(c.title)}"></label>
          <label class="narrow">אייקון<input name="icon" value="${esc(c.icon || '🎓')}" maxlength="4"></label>
          <label class="narrow">מיקום ברשימה<input name="position" type="number" value="${esc(c.position || 0)}"></label>
        </div>
        <label>תיאור קצר<textarea name="description" rows="2">${esc(c.description)}</textarea></label>
        <div class="actions"><button class="btn primary">שמירה</button></div>
      </form>
    </details>
    <details class="panel danger-zone">
      <summary>מחיקת הקורס</summary>
      <div class="details-body">
        <p class="muted">מחיקה תמחק גם את כל ההרצאות, התרגילים וההגשות של הקורס. אי אפשר לבטל.</p>
        <button class="btn danger" id="del-course">מחיקת הקורס לצמיתות</button>
      </div>
    </details>`)
  if (!root) return
  root.querySelector('#course-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    busy(f.querySelector('button'), async () => {
      await db.saveCourse({ id, title: val(f, 'title'), icon: val(f, 'icon'), description: val(f, 'description'), position: +val(f, 'position') })
      toast('נשמר', 'success'); manageCourse(view, id)
    })
  })
  root.querySelector('#del-course').addEventListener('click', (e) => {
    if (!sure(`למחוק את "${c.title}" עם כל ההרצאות וההגשות?`)) return
    busy(e.target, async () => { await db.deleteCourse(id); toast('הקורס נמחק'); location.hash = '#/manage' })
  })
}

// ---------- lecture editor (new or existing) ----------
export async function lectureEditor(view, id, courseId) {
  let l = id ? await db.getLecture(id) : null
  if (id && !l) return view.render(NOT_FOUND)
  courseId = courseId || l.course_id
  const c = await db.getCourse(courseId)
  if (!c) return view.render(NOT_FOUND)
  const existing = l ? null : await db.listLectures(courseId)
  const lec = l || { number: (existing.length ? Math.max(...existing.map((x) => x.number)) + 1 : 1), title: '', summary: '', video_url: '', materials: [], published: false }
  const ex = (l?.exercises || [])[0] || null
  const matRow = (m = {}) => `
    <div class="row mat">
      <label>שם<input name="mtitle" value="${esc(m.title || '')}" placeholder="מאמר: Building effective agents"></label>
      <label>קישור<input name="murl" type="url" dir="ltr" value="${esc(m.url || '')}" placeholder="https://"></label>
      <button type="button" class="link danger rm" title="הסרה">הסרה</button>
    </div>`

  const root = view.render(`
    ${hero({ title: l ? l.title : 'הרצאה חדשה', crumbs: [['#/manage', 'ניהול תוכן'], [`#/manage/course/${c.id}`, c.title]],
      actions: l ? `<a class="btn small ghost" href="#/lecture/${esc(l.id)}">תצוגת תלמידה</a>` : '' })}
    <form class="panel form" id="lec">
      <h2>פרטי ההרצאה</h2>
      <div class="row">
        <label class="narrow">מספר<input name="number" type="number" min="1" value="${esc(lec.number)}"></label>
        <label>כותרת<input name="title" required value="${esc(lec.title)}"></label>
      </div>
      <label>על השיעור
        <textarea name="summary" rows="7" placeholder="מה לומדים בשיעור.">${esc(lec.summary)}</textarea>
        <span class="hint">אפשר: שורה שמתחילה ב-### לכותרת, ‏- לרשימה, טבלה עם |, וקוד בין שתי שורות של \`\`\`.</span>
      </label>
      <label>קישור להקלטה (YouTube, Vimeo או Google Drive)
        <input name="video_url" type="url" dir="ltr" value="${esc(lec.video_url)}" placeholder="https://">
      </label>
      <div><b>חומרי לימוד</b><div id="mats">${(lec.materials || []).map(matRow).join('')}</div>
        <button type="button" class="btn small" id="add-mat">+ קישור</button></div>
      <label class="check"><input type="checkbox" name="published" ${lec.published ? 'checked' : ''}> ההרצאה גלויה לתלמידות</label>
      <div class="actions"><button class="btn primary">${l ? 'שמירה' : 'יצירת ההרצאה'}</button></div>
    </form>
    ${l ? `
    <section class="panel">
      <h2>מצגת</h2>
      <div class="slides-upload">
        ${l.slides_path ? `<p class="ok-text">✓ הועלתה מצגת: <b dir="ltr">${esc(l.slides_name || 'deck.html')}</b></p>` : '<p class="muted">עדיין אין מצגת. מעלים קובץ HTML של המצגת.</p>'}
        <input type="file" id="deck" accept=".html,.htm,text/html">
      </div>
      <div class="actions">
        ${l.slides_path ? `<a class="btn small" href="#/lecture/${esc(l.id)}/slides">צפייה</a><button class="btn small danger ghost" id="rm-deck">הסרת המצגת</button>` : ''}
      </div>
    </section>
    <form class="panel form" id="ex">
      <div class="page-head"><h2>תרגיל</h2>${ex ? `<a class="btn small" href="#/manage/exercise/${esc(ex.id)}/submissions">הגשות</a>` : ''}</div>
      <div class="row">
        <label>כותרת התרגיל<input name="title" value="${esc(ex?.title || '')}" placeholder="תרגיל: שרת MCP משלכן"></label>
        <label class="narrow">תאריך הגשה<input name="due_at" type="date" value="${esc(ex?.due_at || '')}"></label>
      </div>
      <label>הוראות<textarea name="instructions" rows="6">${esc(ex?.instructions || '')}</textarea></label>
      <div class="actions"><button class="btn primary">${ex ? 'שמירת התרגיל' : 'הוספת תרגיל'}</button>
        ${ex ? '<button type="button" class="btn danger ghost" id="rm-ex">מחיקת התרגיל</button>' : ''}</div>
    </form>
    <details class="panel danger-zone">
      <summary>מחיקת ההרצאה</summary>
      <div class="details-body"><p class="muted">תימחק גם המצגת, התרגיל וכל ההגשות.</p>
      <button class="btn danger" id="del-lec">מחיקת ההרצאה</button></div>
    </details>` : '<p class="muted">אחרי יצירת ההרצאה אפשר להעלות מצגת ולהוסיף תרגיל.</p>'}`)
  if (!root) return

  const mats = root.querySelector('#mats')
  mats.addEventListener('click', (e) => { if (e.target.classList.contains('rm')) e.target.closest('.mat').remove() })
  root.querySelector('#add-mat').addEventListener('click', () => mats.insertAdjacentHTML('beforeend', matRow()))

  root.querySelector('#lec').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    const materials = [...mats.querySelectorAll('.mat')].map((r) => ({ title: r.querySelector('[name=mtitle]').value.trim(), url: r.querySelector('[name=murl]').value.trim() })).filter((m) => m.url)
    busy(f.querySelector('.actions .btn'), async () => {
      const saved = await db.saveLecture({ id: l?.id, course_id: courseId, number: +val(f, 'number'), title: val(f, 'title'), summary: val(f, 'summary'),
        video_url: val(f, 'video_url'), materials, published: f.published.checked })
      toast('נשמר', 'success')
      if (!l) location.hash = `#/manage/lecture/${saved.id}`; else lectureEditor(view, l.id)
    })
  })
  if (!l) return

  root.querySelector('#deck').addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!/\.html?$/i.test(file.name)) return toast('צריך קובץ HTML', 'error')
    busy(e.target, async () => { await db.uploadSlides(l.id, file); toast('המצגת הועלתה', 'success'); lectureEditor(view, l.id) })
  })
  root.querySelector('#rm-deck')?.addEventListener('click', (e) => {
    if (!sure('להסיר את המצגת מההרצאה?')) return
    busy(e.target, async () => { await db.removeSlides(l.id, l.slides_path); toast('המצגת הוסרה'); lectureEditor(view, l.id) })
  })
  root.querySelector('#ex').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = e.target
    if (!val(f, 'title')) return toast('צריך כותרת לתרגיל', 'error')
    busy(f.querySelector('.btn.primary'), async () => {
      await db.saveExercise({ id: ex?.id, lecture_id: l.id, title: val(f, 'title'), instructions: val(f, 'instructions'), due_at: val(f, 'due_at') || null })
      toast('התרגיל נשמר', 'success'); lectureEditor(view, l.id)
    })
  })
  root.querySelector('#rm-ex')?.addEventListener('click', (e) => {
    if (!sure('למחוק את התרגיל וכל ההגשות שלו?')) return
    busy(e.target, async () => { await db.deleteExercise(ex.id); toast('התרגיל נמחק'); lectureEditor(view, l.id) })
  })
  root.querySelector('#del-lec').addEventListener('click', (e) => {
    if (!sure(`למחוק את "${l.title}"?`)) return
    busy(e.target, async () => { await db.deleteLecture(l.id); toast('ההרצאה נמחקה'); location.hash = `#/manage/course/${courseId}` })
  })
}

// ---------- submissions of one exercise ----------
export async function submissions(view, exerciseId) {
  const ex = await db.getExercise(exerciseId)
  if (!ex) return view.render(NOT_FOUND)
  const lec = ex.lectures, crs = lec.courses
  const [subs, enrolled] = await Promise.all([db.listSubmissions(exerciseId), db.listEnrollments(crs.id)])
  const missing = enrolled.map((r) => r.email).filter((e) => !subs.some((s) => s.email === e))
  const root = view.render(`
    ${hero({ title: 'הגשות: ' + ex.title, crumbs: [['#/manage', 'ניהול תוכן'], [`#/manage/course/${crs.id}`, crs.title], [`#/manage/lecture/${lec.id}`, lec.title]] })}
    <div class="stat-row">
      <div class="stat"><b>${subs.length}</b><span>הגישו</span></div>
      <div class="stat"><b>${subs.filter((s) => s.status === 'submitted').length}</b><span>ממתינות לבדיקה</span></div>
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

// ---------- who viewed a lecture ----------
export async function lessonViews(view, lectureId) {
  const l = await db.getLecture(lectureId)
  if (!l) return view.render(NOT_FOUND)
  const c = await db.getCourse(l.course_id)
  const [enrolled, views] = await Promise.all([db.listEnrollments(c.id), db.listViews(lectureId)])
  const rows = enrolled.map((r) => ({ email: r.email, v: views.find((x) => x.email === r.email) }))
  const seen = rows.filter((r) => r.v).length
  const root = view.render(`
    ${hero({ title: 'צפיות: ' + l.title, crumbs: [['#/manage', 'ניהול תוכן'], [`#/manage/course/${c.id}`, c.title]] })}
    <div class="stat-row">
      <div class="stat"><b>${enrolled.length}</b><span>תלמידות בקורס</span></div>
      <div class="stat"><b>${seen}</b><span>נכנסו להרצאה</span></div>
      <div class="stat"><b>${enrolled.length - seen}</b><span>עוד לא נכנסו</span></div>
    </div>
    <section class="panel">
      <div class="form inline views-tools">
        <input id="q" type="search" placeholder="חיפוש לפי מייל" dir="ltr">
        <select id="filter"><option value="all">כולן</option><option value="seen">נכנסו</option><option value="unseen">לא נכנסו</option></select>
      </div>
      <div style="overflow-x:auto"><table class="table"><thead><tr><th>מייל</th><th>כניסה ראשונה</th><th>כניסה אחרונה</th><th>מספר כניסות</th></tr></thead><tbody id="rows"></tbody></table></div>
      <p class="hint">נספרת כל פתיחה של דף ההרצאה על ידי תלמידה.</p>
    </section>`)
  if (!root) return
  const draw = () => {
    const q = root.querySelector('#q').value.trim().toLowerCase(), f = root.querySelector('#filter').value
    const list = rows.filter((r) => r.email.includes(q) && (f === 'all' || (f === 'seen') === !!r.v))
    root.querySelector('#rows').innerHTML = list.map((r) => `<tr><td dir="ltr">${esc(r.email)}</td><td>${r.v ? fmtDate(r.v.first_seen, true) : '<span class="muted">—</span>'}</td><td>${r.v ? fmtDate(r.v.last_seen, true) : '<span class="muted">—</span>'}</td><td>${r.v ? r.v.views : 0}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">אין תוצאות</td></tr>'
  }
  root.querySelector('#q').addEventListener('input', draw)
  root.querySelector('#filter').addEventListener('change', draw)
  draw()
}

// ---------- all submissions, across every course ----------
export async function submissionsHome(view) {
  const courses = await db.listCourses()
  const groups = []
  for (const c of courses) {
    const lectures = (await db.listLectures(c.id)).filter((l) => (l.exercises || []).length)
    const rows = []
    for (const l of lectures) {
      const ex = (await db.getExercise(l.exercises[0].id)) || l.exercises[0]
      const subs = await db.listSubmissions(ex.id)
      rows.push({ l, ex, total: subs.length, waiting: subs.filter((s) => s.status === 'submitted').length })
    }
    if (rows.length) groups.push({ c, rows })
  }
  const waitingAll = groups.reduce((n, g) => n + g.rows.reduce((m, r) => m + r.waiting, 0), 0)
  view.render(`
    ${hero({ title: 'הגשות', text: waitingAll ? `${waitingAll} הגשות מחכות לבדיקה.` : 'אין הגשות שמחכות לבדיקה.' })}
    ${groups.length ? groups.map(({ c, rows }) => `
      <section class="panel">
        <h2>${esc(c.title)}</h2>
        <ol class="lecture-list manage">${rows.map(({ l, ex, total, waiting }) => `
          <li><a href="#/manage/exercise/${esc(ex.id)}/submissions">
            <span class="num">${esc(l.number)}</span>
            <span class="title">${esc(ex.title || l.title)}<span class="muted small">${esc(l.title)}</span>
              <span class="lesson-badges">
                <span class="badge">${total} הגישו</span>
                ${waiting ? `<span class="badge submitted">${waiting} מחכות לבדיקה</span>` : '<span class="badge reviewed">הכול נבדק</span>'}
              </span></span>
            <span class="arrow">←</span>
          </a></li>`).join('')}</ol>
      </section>`).join('')
    : '<div class="empty"><p>עדיין אין תרגילים. מוסיפים תרגיל בעריכת הרצאה.</p><a class="btn primary" href="#/manage">לניהול תוכן</a></div>'}`)
}
