// Example data for demo mode (config.demo = true). Nothing here is saved anywhere:
// refreshing the page brings the examples back.
const uid = () => Math.random().toString(36).slice(2, 10)
const now = () => new Date().toISOString()
const clone = (x) => JSON.parse(JSON.stringify(x))

const C1 = 'course-ai-work', C2 = 'course-mcp'
const L1 = 'lec-intro', L2 = 'lec-mcp'
const E1 = 'ex-mcp'

const state = {
  staff: [{ email: 'talya@demo.local', role: 'admin' }],
  courses: [
    { id: C1, title: 'קורס 1: AI בסביבת העבודה', description: 'איך מודלים עובדים, הנדסת פרומפטים למפתחות, ותכנון תהליכי עבודה.', icon: '💡', position: 1, created_at: now() },
    { id: C2, title: 'קורס 2: MCP, Skills ו-Agent Harness', description: 'שכבת ההרצה של הסוכן: מה היא עושה, איך היא בנויה, ואיך בוחרים בין SDK ל-API.', icon: '🤖', position: 2, created_at: now() },
  ],
  enrollments: [
    { course_id: C2, email: 'student1@demo.local' }, { course_id: C2, email: 'student2@demo.local' },
    { course_id: C2, email: 'student3@demo.local' }, { course_id: C1, email: 'student1@demo.local' },
  ],
  lectures: [
    { id: L1, course_id: C1, number: 1, title: 'מבוא ל-AI ומיפוי תהליכי פיתוח', summary: 'מה קורה מאחורי הקלעים של מודל שפה, ואיך מדברים איתו מקוד.', video_url: '', materials: [], slides_path: null, slides_name: null, published: true, created_at: now() },
    { id: L2, course_id: C2, number: 1, title: 'MCP, Skills ו-Agent Harness', summary: '### מה נלמד\n- מה זה סוכן, ואיך עובדת לולאת הכלים\n- MCP: חיבור אחיד בין מודלים למערכות\n- Skills: ידע שנטען רק כשצריך\n- Hooks, הרשאות ואחריות המפתחות\n\n| מושג | במשפט אחד |\n|---|---|\n| MCP | חיבור USB-C לבינה מלאכותית |\n| Skill | מדריך חפיפה לסוכן |\n| Hook | השומר שבודק כל פעולה |', video_url: '', materials: [{ title: 'Building effective agents', url: 'https://www.anthropic.com/research/building-effective-agents' }, { title: 'Model Context Protocol', url: 'https://modelcontextprotocol.io' }], slides_path: 'decks/course2-mcp-skills-harness.html', slides_name: 'course2-mcp-skills-harness.html', published: true, created_at: now() },
    { id: 'lec-draft', course_id: C2, number: 2, title: 'בונות שרת MCP משלנו (טיוטה)', summary: '', video_url: '', materials: [], slides_path: null, slides_name: null, published: false, created_at: now() },
  ],
  exercises: [
    { id: E1, lecture_id: L2, title: 'תרגיל: שרת MCP לספריית המכללה', instructions: 'כתבי שרת MCP עם שני כלים: חיפוש ספר ובדיקת זמינות.\n\n```\nfrom mcp.server import MCPServer\nmcp = MCPServer("college-library")\n```\n\nהגישי קישור לקוד ב-GitHub או ב-Google Drive.', due_at: '2026-11-15', created_at: now() },
  ],
  submissions: [
    { id: 's1', exercise_id: E1, email: 'student1@demo.local', link: 'https://github.com/example/library-mcp', answer: 'הוספתי גם כלי שלישי להזמנת ספר.', status: 'submitted', feedback: '', created_at: now(), updated_at: now() },
    { id: 's2', exercise_id: E1, email: 'student2@demo.local', link: 'https://drive.google.com/example', answer: '', status: 'reviewed', feedback: 'מצוין. התיאורים של הכלים ברורים מאוד.', created_at: now(), updated_at: now() },
  ],
  lesson_views: [
    { lecture_id: L2, email: 'student1@demo.local', first_seen: '2026-10-20T09:12:00Z', last_seen: '2026-10-27T18:40:00Z', views: 4 },
    { lecture_id: L2, email: 'student2@demo.local', first_seen: '2026-10-21T11:02:00Z', last_seen: '2026-10-21T11:02:00Z', views: 1 },
  ],
}

const byId = (table, id) => state[table].find((r) => r.id === id)

export const demoDb = {
  async myAccess(email) {
    const s = state.staff.find((r) => r.email === email)
    return { role: s?.role || null, courseIds: state.enrollments.filter((r) => r.email === email).map((r) => r.course_id) }
  },

  async listCourses() { return clone([...state.courses].sort((a, b) => a.position - b.position)) },
  async getCourse(id) { return clone(byId('courses', id) || null) },
  async saveCourse(c) {
    if (c.id) { Object.assign(byId('courses', c.id), c); return clone(byId('courses', c.id)) }
    const row = { created_at: now(), icon: '🎓', position: state.courses.length + 1, ...c, id: uid() }
    state.courses.push(row); return clone(row)
  },
  async deleteCourse(id) {
    state.courses = state.courses.filter((r) => r.id !== id)
    state.lectures = state.lectures.filter((r) => r.course_id !== id)
  },

  async listLectures(courseId) {
    return clone(state.lectures.filter((l) => l.course_id === courseId).sort((a, b) => a.number - b.number)
      .map((l) => ({ ...l, exercises: state.exercises.filter((e) => e.lecture_id === l.id).map((e) => ({ id: e.id })) })))
  },
  async getLecture(id) {
    const l = byId('lectures', id)
    return l ? clone({ ...l, exercises: state.exercises.filter((e) => e.lecture_id === id) }) : null
  },
  async saveLecture(l) {
    if (l.id) { Object.assign(byId('lectures', l.id), l); return clone(byId('lectures', l.id)) }
    const row = { created_at: now(), materials: [], slides_path: null, slides_name: null, ...l, id: uid() }
    state.lectures.push(row); return clone(row)
  },
  async deleteLecture(id) { state.lectures = state.lectures.filter((r) => r.id !== id) },

  async uploadSlides(lectureId, file) {
    const l = byId('lectures', lectureId)
    l.slides_path = URL.createObjectURL(file); l.slides_name = file.name
  },
  async removeSlides(lectureId) { Object.assign(byId('lectures', lectureId), { slides_path: null, slides_name: null }) },
  async getSlidesHtml(lecture) { return (await fetch(lecture.slides_path)).text() },

  async getExercise(id) {
    const e = byId('exercises', id)
    if (!e) return null
    const l = byId('lectures', e.lecture_id), c = byId('courses', l.course_id)
    return clone({ ...e, lectures: { id: l.id, title: l.title, course_id: l.course_id, courses: { id: c.id, title: c.title } } })
  },
  async saveExercise(e) {
    if (e.id) { Object.assign(byId('exercises', e.id), e); return clone(byId('exercises', e.id)) }
    const row = { created_at: now(), ...e, id: uid() }
    state.exercises.push(row); return clone(row)
  },
  async deleteExercise(id) { state.exercises = state.exercises.filter((r) => r.id !== id) },

  async mySubmission(exerciseId, email) {
    return clone(state.submissions.find((s) => s.exercise_id === exerciseId && s.email === email) || null)
  },
  async submit(exerciseId, email, { link, answer }) {
    let s = state.submissions.find((r) => r.exercise_id === exerciseId && r.email === email)
    if (!s) { s = { id: uid(), exercise_id: exerciseId, email, created_at: now(), feedback: '' }; state.submissions.push(s) }
    Object.assign(s, { link, answer, status: 'submitted', updated_at: now() })
    return clone(s)
  },
  async listSubmissions(exerciseId) { return clone(state.submissions.filter((s) => s.exercise_id === exerciseId)) },
  async reviewSubmission(id, patch) { Object.assign(byId('submissions', id), patch) },

  async recordView() {},
  async listViews(lectureId) { return clone(state.lesson_views.filter((v) => v.lecture_id === lectureId)) },

  async listStaff() { return clone(state.staff) },
  async setStaff(email, role) {
    const s = state.staff.find((r) => r.email === email)
    if (s) s.role = role; else state.staff.push({ email, role })
  },
  async removeStaff(email) { state.staff = state.staff.filter((r) => r.email !== email) },
  async listEnrollments(courseId) { return clone(state.enrollments.filter((r) => r.course_id === courseId)) },
  async addEnrollments(courseId, emails) {
    for (const email of emails) if (!state.enrollments.some((r) => r.course_id === courseId && r.email === email)) state.enrollments.push({ course_id: courseId, email })
  },
  async removeEnrollment(courseId, email) {
    state.enrollments = state.enrollments.filter((r) => !(r.course_id === courseId && r.email === email))
  },
}
