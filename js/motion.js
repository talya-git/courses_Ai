// A short fade-in for the parts of a page when it opens.
export function enterPage(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !root.animate) return
  root.querySelectorAll('.hero, .panel, .card, .action-card, .stat, .lecture-list').forEach((el, i) => {
    el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 260, delay: Math.min(i, 8) * 35, easing: 'ease-out', fill: 'backwards' })
  })
}
