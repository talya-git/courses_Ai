// Example data for demo mode (config.demo = true). Nothing here is saved anywhere:
// refreshing the page brings the examples back.
const uid = () => Math.random().toString(36).slice(2, 10)
const now = () => new Date().toISOString()
const clone = (x) => JSON.parse(JSON.stringify(x))

const C1 = 'course-ai-work', C2 = 'course-mcp'
const L2 = 'lec-mcp', LX = 'lec-ex'
const E1 = 'ex-mcp'

const state = {
  staff: [{ email: 'talya@demo.local', role: 'admin' }],
  courses: [
    { id: C1, title: 'קורס 1: AI בסביבת העבודה', position: 1, created_at: now() },
    { id: C2, title: 'קורס 2: MCP, Skills ו-Agent Harness', position: 2, created_at: now() },
  ],
  enrollments: [
    { course_id: C2, email: 'student1@demo.local' }, { course_id: C2, email: 'student2@demo.local' },
    { course_id: C2, email: 'student3@demo.local' }, { course_id: C1, email: 'student1@demo.local' },
  ],
  lectures: [
    { id: L2, course_id: C2, number: 1, kind: 'slides', title: 'MCP, Skills ו-Agent Harness', slides_path: 'decks/course2-mcp-skills-harness.html', slides_name: 'course2-mcp-skills-harness.html', published: true, created_at: now() },
    { id: 'lec-video', course_id: C2, number: 2, kind: 'video', title: 'סרטון: איך נולדה הבינה המלאכותית', slides_path: null, slides_name: null, published: true, created_at: now() },
    { id: LX, course_id: C2, number: 3, kind: 'exercise', title: 'תרגיל: שרת MCP לספריית המכללה', slides_path: null, slides_name: null, published: true, created_at: now() },
  ],
  exercises: [
    { id: E1, lecture_id: LX, title: 'תרגיל: שרת MCP לספריית המכללה', instructions: 'כתבי שרת MCP עם שני כלים: חיפוש ספר ובדיקת זמינות.\n\nהגישי קישור לקוד ב-GitHub או ב-Google Drive.', due_at: '2026-11-15', created_at: now() },
  ],
  submissions: [
    { id: 's1', exercise_id: E1, email: 'student1@demo.local', link: 'https://github.com/example/library-mcp', answer: 'הוספתי גם כלי שלישי להזמנת ספר.', status: 'submitted', feedback: '', created_at: now(), updated_at: now() },
    { id: 's2', exercise_id: E1, email: 'student2@demo.local', link: 'https://drive.google.com/example', answer: '', status: 'reviewed', feedback: 'מצוין. התיאורים של הכלים ברורים מאוד.', created_at: now(), updated_at: now() },
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
    if (l.id) { Object.assign(byId('lectures', l.id), { title: l.title }); return clone(byId('lectures', l.id)) }
    const nums = state.lectures.filter((x) => x.course_id === l.course_id).map((x) => x.number)
    const row = { created_at: now(), slides_path: null, slides_name: null, published: true, kind: 'slides', ...l, number: (nums.length ? Math.max(...nums) : 0) + 1, id: uid() }
    state.lectures.push(row); return clone(row)
  },
  async reorder(ids) { ids.forEach((id, i) => { byId('lectures', id).number = i + 1 }) },
  async deleteLecture(id) { state.lectures = state.lectures.filter((r) => r.id !== id) },

  async uploadFile(lectureId, file) {
    const l = byId('lectures', lectureId)
    l.slides_path = URL.createObjectURL(file); l.slides_name = file.name
  },
  async getFileUrl(lecture) { return lecture.slides_path },
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
