// Fixed scenes for screenshots: ?shot=cover shows the finished cover alone, edge to edge;
// ?shot=editor shows the studio with a scene loaded. The scene comes from the query —
// `layout`, `grade`, `title` and `subtitle` — and main.js applies it with the bundled
// samples. window.__shotReady is set once the scene is painted.
export async function runShot(shot, query, applyScene) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await applyScene({
    layout: query.get('layout') ?? 'hero',
    grade: query.get('grade') ?? 'sunset',
    title: query.get('title') ?? 'VICE HEAT',
    subtitle: query.get('subtitle') ?? 'WELCOME BACK TO VICE CITY',
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
