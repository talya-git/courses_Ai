// Small shared helpers: escaping, toast, dates, and a tiny text formatter.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

let toastTimer = null
export function toast(msg, type = '') {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.className = 'show' + (type ? ' ' + type : '')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.className = '' }, 3200)
}

export const NOT_FOUND = `
  <div class="empty">
    <h1>הדף לא נמצא</h1>
    <p class="muted">ייתכן שהקישור שגוי, או שאין לך הרשאה לדף הזה.</p>
    <p><a class="btn" href="#/">חזרה לקורסים</a></p>
  </div>`

export function fmtDate(v, withTime = false) {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d)) return ''
  const opts = withTime
    ? { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'numeric', year: 'numeric' }
  return d.toLocaleString('he-IL', opts)
}

export const STATUS = {
  submitted: 'הוגש, ממתין לבדיקה',
  reviewed: 'נבדק',
  needs_fix: 'צריך תיקון',
}
export const statusBadge = (s) => `<span class="badge ${esc(s)}">${esc(STATUS[s] || s)}</span>`

// Turn a YouTube / Vimeo / Drive link into an embeddable address (or '' if unknown).
export function embedUrl(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return 'https://www.youtube-nocookie.com/embed/' + u.pathname.slice(1)
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop()
      return 'https://www.youtube-nocookie.com/embed/' + id
    }
    if (u.hostname.includes('vimeo.com')) return 'https://player.vimeo.com/video/' + u.pathname.split('/').filter(Boolean).pop()
    if (u.hostname.includes('drive.google.com')) return url.replace(/\/view.*$/, '/preview')
  } catch (e) { /* not a URL */ }
  return ''
}

// Plain text with a few simple marks:
//   ### כותרת      | א | ב |  (table)      ``` code ```      - bullet
export function rich(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const out = []
  let i = 0
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      out.push(`<pre class="rich-code">${esc(code.join('\n'))}</pre>`)
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++])
      const cells = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map((r) => r.trim().slice(1, -1).split('|').map((c) => c.trim()))
      const [head, ...body] = cells
      out.push(`<div class="rich-table"><table class="table"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)
      continue
    }
    if (/^\s*[-•]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-•]\s+/, ''))
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`)
      continue
    }
    if (line.startsWith('### ')) { out.push(`<h3>${inline(line.slice(4))}</h3>`); i++; continue }
    if (line.trim() === '') { i++; continue }
    out.push(`<p>${inline(line)}</p>`)
    i++
  }
  return `<div class="rich">${out.join('')}</div>`
}

export function hero({ title, text = '', crumbs = [], badge = '', actions = '' }) {
  const c = crumbs.length
    ? `<div class="crumbs">${crumbs.map(([href, t]) => (href ? `<a href="${href}"><bdi>${esc(t)}</bdi></a>` : `<bdi>${esc(t)}</bdi>`)).join(' ‹ ')}</div>`
    : ''
  return `
    <section class="hero">
      ${c}
      ${badge ? `<span class="hero-badge">${esc(badge)}</span>` : ''}
      <div class="page-head"><h1>${esc(title)}</h1>${actions}</div>
      ${text ? `<p>${esc(text)}</p>` : ''}
    </section>`
}

// Simple "are you sure" that also works on phones.
export const sure = (msg) => window.confirm(msg)
