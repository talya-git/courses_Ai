import { db } from '../db.js'
import { auth } from '../auth.js'
import { esc, toast, hero, sure } from '../ui.js'

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/
const parseEmails = (text) => [...new Set(String(text).toLowerCase().split(/[\s,;]+/).map((x) => x.trim()).filter((x) => EMAIL.test(x)))]

export async function admin(view, tab = 'students') {
  const tabs = `<nav class="tabs">
    <a href="#/admin/students" class="${tab === 'students' ? 'active' : ''}">תלמידות לפי קורס</a>
    <a href="#/admin/staff" class="${tab === 'staff' ? 'active' : ''}">צוות</a></nav>`
  if (tab === 'staff') return staffTab(view, tabs)
  return studentsTab(view, tabs)
}

async function studentsTab(view, tabs) {
  const courses = await db.listCourses()
  if (!courses.length) {
    return view.render(`${hero({ title: 'הרשאות תלמידות' })}${tabs}<div class="empty"><p>קודם צריך ליצור קורס.</p><a class="btn primary" href="#/manage">לניהול תוכן</a></div>`)
  }
  const pick = sessionStorage.getItem('admin-course')
  let courseId = courses.some((c) => c.id === pick) ? pick : courses[0].id
  const root = view.render(`
    ${hero({ title: 'הרשאות תלמידות', text: 'רק מיילים שמופיעים כאן יכולים להיכנס לקורס. התלמידה נרשמת עם אותו מייל ובוחרת סיסמה.' })}
    ${tabs}
    <section class="panel">
      <label class="form"><b>קורס</b>
        <select id="course">${courses.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select>
      </label>
      <form class="form" id="add" style="margin-top:16px">
        <label>הוספת מיילים
          <textarea name="emails" rows="4" dir="ltr" placeholder="student1@gmail.com&#10;student2@gmail.com"></textarea>
          <span class="hint">אפשר להדביק רשימה שלמה מאקסל: מייל בכל שורה, או מופרדים בפסיק.</span>
        </label>
        <div class="actions"><button class="btn primary">הוספה לקורס</button></div>
      </form>
    </section>
    <section class="panel"><div class="page-head"><h2>התלמידות בקורס</h2><span class="badge" id="count"></span></div>
      <table class="table"><thead><tr><th>מייל</th><th></th></tr></thead><tbody id="list"></tbody></table></section>`)
  if (!root) return
  const sel = root.querySelector('#course')
  sel.value = courseId
  async function load() {
    const rows = await db.listEnrollments(courseId)
    root.querySelector('#count').textContent = rows.length + ' תלמידות'
    root.querySelector('#list').innerHTML = rows.map((r) => `<tr><td dir="ltr">${esc(r.email)}</td><td style="text-align:end"><button class="link danger" data-email="${esc(r.email)}">הסרה</button></td></tr>`).join('')
      || '<tr><td colspan="2" class="muted">עדיין אין תלמידות בקורס הזה.</td></tr>'
  }
  sel.addEventListener('change', () => { courseId = sel.value; try { sessionStorage.setItem('admin-course', courseId) } catch (e) {} load() })
  root.querySelector('#list').addEventListener('click', async (e) => {
    const email = e.target.dataset?.email
    if (!email || !sure(`להסיר את ${email} מהקורס?`)) return
    try { await db.removeEnrollment(courseId, email); toast('הוסרה'); load() } catch (err) { toast(err.message, 'error') }
  })
  root.querySelector('#add').addEventListener('submit', async (e) => {
    e.preventDefault()
    const emails = parseEmails(e.target.emails.value)
    if (!emails.length) return toast('לא נמצאו מיילים תקינים', 'error')
    try {
      await db.addEnrollments(courseId, emails)
      toast(`נוספו ${emails.length} מיילים`, 'success'); e.target.reset(); load()
    } catch (err) { toast('ההוספה נכשלה: ' + err.message, 'error') }
  })
  load()
}

async function staffTab(view, tabs) {
  const staff = await db.listStaff()
  const role = (r) => (r === 'admin' ? 'מנהלת ראשית' : 'צוות')
  const root = view.render(`
    ${hero({ title: 'צוות', text: 'צוות יכול לערוך קורסים ולבדוק הגשות. מנהלת ראשית יכולה גם לתת הרשאות.' })}
    ${tabs}
    <section class="panel">
      <table class="table"><thead><tr><th>מייל</th><th>תפקיד</th><th></th></tr></thead><tbody>
      ${staff.map((s) => `<tr><td dir="ltr">${esc(s.email)}</td><td>${role(s.role)}</td><td style="text-align:end">${s.email === auth.email ? '<span class="muted small">זו את</span>' : `<button class="link danger" data-email="${esc(s.email)}">הסרה</button>`}</td></tr>`).join('')}
      </tbody></table>
      <form class="form inline" id="add">
        <input name="email" type="email" dir="ltr" placeholder="email@gmail.com" required>
        <select name="role"><option value="staff">צוות</option><option value="admin">מנהלת ראשית</option></select>
        <button class="btn primary">הוספה</button>
      </form>
    </section>`)
  if (!root) return
  root.querySelector('tbody').addEventListener('click', async (e) => {
    const email = e.target.dataset?.email
    if (!email || !sure(`להסיר את ${email} מהצוות?`)) return
    try { await db.removeStaff(email); toast('הוסרה'); staffTab(view, tabs) } catch (err) { toast(err.message, 'error') }
  })
  root.querySelector('#add').addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = e.target.email.value.trim().toLowerCase()
    if (!EMAIL.test(email)) return toast('מייל לא תקין', 'error')
    try { await db.setStaff(email, e.target.role.value); toast('נוספה לצוות', 'success'); staffTab(view, tabs) } catch (err) { toast(err.message, 'error') }
  })
}
