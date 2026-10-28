// All reads and writes go through here, so the pages never talk to Supabase directly.
// In demo mode the same functions work on example data kept in memory.
import { supabase, demo } from './supabase.js'
import { demoDb } from './demo-db.js'

const SLIDES_BUCKET = 'slides'

function check({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

// One exercise per lecture: Supabase may return it as an object, null, or a list.
const asList = (x) => (Array.isArray(x) ? x : x ? [x] : [])
const withExercises = (l) => (l ? { ...l, exercises: asList(l.exercises) } : l)

const live = {
  // ---- access ----
  async myAccess(email) {
    const staff = check(await supabase.from('staff').select('role').eq('email', email).maybeSingle())
    const enr = check(await supabase.from('enrollments').select('course_id').eq('email', email))
    return { role: staff?.role || null, courseIds: enr.map((r) => r.course_id) }
  },

  // ---- courses ----
  async listCourses() {
    return check(await supabase.from('courses').select('*').order('position').order('created_at'))
  },
  async getCourse(id) {
    return check(await supabase.from('courses').select('*').eq('id', id).maybeSingle())
  },
  async saveCourse(c) {
    const row = { title: c.title, description: c.description || '', icon: c.icon || '🎓', position: +c.position || 0 }
    if (c.id) return check(await supabase.from('courses').update(row).eq('id', c.id).select().single())
    return check(await supabase.from('courses').insert(row).select().single())
  },
  async deleteCourse(id) { check(await supabase.from('courses').delete().eq('id', id)) },

  // ---- lectures ----
  async listLectures(courseId) {
    return check(await supabase.from('lectures').select('*, exercises(id)').eq('course_id', courseId).order('number').order('created_at')).map(withExercises)
  },
  async getLecture(id) {
    return withExercises(check(await supabase.from('lectures').select('*, exercises(*)').eq('id', id).maybeSingle()))
  },
  // An item of a course: a presentation, a video or an exercise. Always visible to the course's students.
  async saveLecture(l) {
    if (l.id) return check(await supabase.from('lectures').update({ title: l.title, updated_at: new Date().toISOString() }).eq('id', l.id).select().single())
    const last = check(await supabase.from('lectures').select('number').eq('course_id', l.course_id).order('number', { ascending: false }).limit(1))
    const row = { course_id: l.course_id, kind: l.kind || 'slides', title: l.title, number: (last[0]?.number || 0) + 1, published: true }
    return check(await supabase.from('lectures').insert(row).select().single())
  },
  async reorder(ids) {
    for (let i = 0; i < ids.length; i++) check(await supabase.from('lectures').update({ number: i + 1 }).eq('id', ids[i]))
  },
  async deleteLecture(id) {
    const lec = await live.getLecture(id)
    if (lec?.slides_path) await supabase.storage.from(SLIDES_BUCKET).remove([lec.slides_path])
    check(await supabase.from('lectures').delete().eq('id', id))
  },

  // ---- files (presentations and videos) ----
  async uploadFile(lectureId, file, kind) {
    const old = (await live.getLecture(lectureId))?.slides_path
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = kind === 'video' ? `${lectureId}/video.${ext}` : `${lectureId}/deck.html`
    const contentType = kind === 'video' ? (file.type || 'video/mp4') : 'text/html; charset=utf-8'
    check(await supabase.storage.from(SLIDES_BUCKET).upload(path, file, { upsert: true, contentType }))
    if (old && old !== path) await supabase.storage.from(SLIDES_BUCKET).remove([old])
    check(await supabase.from('lectures').update({ slides_path: path, slides_name: file.name }).eq('id', lectureId))
  },
  async getFileUrl(lecture) {
    const data = check(await supabase.storage.from(SLIDES_BUCKET).createSignedUrl(lecture.slides_path, 6 * 3600))
    return data.signedUrl
  },
  async getSlidesHtml(lecture) {
    const blob = check(await supabase.storage.from(SLIDES_BUCKET).download(lecture.slides_path))
    return blob.text()
  },

  // ---- exercises ----
  async getExercise(id) {
    return check(await supabase.from('exercises').select('*, lectures(id, title, course_id, courses(id, title))').eq('id', id).maybeSingle())
  },
  async saveExercise(e) {
    const row = { lecture_id: e.lecture_id, title: e.title, instructions: e.instructions || '', due_at: e.due_at || null }
    if (e.id) return check(await supabase.from('exercises').update(row).eq('id', e.id).select().single())
    return check(await supabase.from('exercises').insert(row).select().single())
  },
  async deleteExercise(id) { check(await supabase.from('exercises').delete().eq('id', id)) },

  // ---- submissions ----
  async mySubmission(exerciseId, email) {
    return check(await supabase.from('submissions').select('*').eq('exercise_id', exerciseId).eq('email', email).maybeSingle())
  },
  async submit(exerciseId, email, { link, answer }) {
    const row = { exercise_id: exerciseId, email, link: link || '', answer: answer || '', status: 'submitted', updated_at: new Date().toISOString() }
    return check(await supabase.from('submissions').upsert(row, { onConflict: 'exercise_id,email' }).select().single())
  },
  async listSubmissions(exerciseId) {
    return check(await supabase.from('submissions').select('*').eq('exercise_id', exerciseId).order('updated_at', { ascending: false }))
  },
  async reviewSubmission(id, { status, feedback }) {
    check(await supabase.from('submissions').update({ status, feedback }).eq('id', id))
  },


  // ---- people ----
  async listStaff() { return check(await supabase.from('staff').select('*').order('email')) },
  async setStaff(email, role) { check(await supabase.from('staff').upsert({ email, role })) },
  async removeStaff(email) { check(await supabase.from('staff').delete().eq('email', email)) },
  async listEnrollments(courseId) {
    return check(await supabase.from('enrollments').select('*').eq('course_id', courseId).order('email'))
  },
  async addEnrollments(courseId, emails) {
    if (!emails.length) return
    check(await supabase.from('enrollments').upsert(emails.map((email) => ({ course_id: courseId, email })), { ignoreDuplicates: true }))
  },
  async removeEnrollment(courseId, email) {
    check(await supabase.from('enrollments').delete().eq('course_id', courseId).eq('email', email))
  },
}

export const db = demo ? demoDb : live
