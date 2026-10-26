/** Map native scroll distance to equal chapters, including both end holds. */
export function storyPosition(distance, travel, count) {
  const progress = travel > 0 ? Math.min(1, Math.max(0, distance / travel)) : 0;
  return { progress, index: Math.min(count - 1, Math.floor(progress * count)) };
}

export function initStory() {
  const story = document.querySelector('.story');
  const stage = story.querySelector('.story-stage');
  const scenes = [...story.querySelectorAll('.story-scene')];
  const bars = [...story.querySelectorAll('.story-progress i')];
  const count = story.querySelector('#story-count');
  const mode = story.querySelector('#story-mode');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let enhanced = false;
  let frame = 0;
  let top = 0;
  let travel = 0;
  let active = -1;
  let needsMeasure = true;

  function render() {
    frame = 0;
    if (!enhanced) return;
    if (needsMeasure) {
      top = story.getBoundingClientRect().top + window.scrollY;
      travel = story.offsetHeight - stage.offsetHeight;
      needsMeasure = false;
    }
    const { index, progress } = storyPosition(window.scrollY - top, travel, scenes.length);
    if (index !== active) {
      active = index;
      story.dataset.activeScene = scenes[index].dataset.scene;
      scenes.forEach((scene, i) => {
        scene.classList.toggle('is-active', i === index);
        scene.inert = i !== index;
        scene.setAttribute('aria-hidden', String(i !== index));
      });
      count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
    }
    bars.forEach((bar, i) => {
      bar.style.transform = `scaleX(${Math.max(0, Math.min(1, progress * scenes.length - i))})`;
    });
  }
  function schedule(measure = false) {
    needsMeasure ||= measure;
    if (!frame) frame = requestAnimationFrame(render);
  }
  function setMode(value) {
    enhanced = value;
    active = -1;
    story.classList.toggle('story-ready', value);
    mode.setAttribute('aria-pressed', String(!value));
    if (!value) {
      scenes.forEach(scene => {
        scene.inert = false;
        scene.removeAttribute('aria-hidden');
        scene.classList.remove('is-active');
      });
    }
    schedule(true);
  }
  mode.hidden = false;
  mode.addEventListener('click', () => {
    const previous = Math.max(active, 0);
    setMode(!enhanced);
    // Preserve the current chapter when switching between presentation and reading.
    // This is an explicit button action; ordinary scroll input is never intercepted.
    const start = story.getBoundingClientRect().top + window.scrollY;
    const y = enhanced
      ? start + (previous + 0.2) / scenes.length * (story.offsetHeight - stage.offsetHeight)
      : scenes[previous].getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y, behavior: 'instant' });
  });
  window.addEventListener('scroll', () => schedule(), { passive: true });
  window.addEventListener('resize', () => schedule(true), { passive: true });
  window.addEventListener('pageshow', () => schedule(true));
  new ResizeObserver(() => schedule(true)).observe(document.body);
  reduced.addEventListener('change', () => setMode(!reduced.matches));

  // Decode all small screen captures as the section approaches. Each stays mounted,
  // so reversing direction doesn't replace an image source or flash an empty frame.
  const preload = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    scenes.forEach(scene => {
      const image = scene.querySelector('img');
      image.loading = 'eager';
      image.decode().catch(() => {}); // A failed request retains the meaningful alt text.
    });
    preload.disconnect();
  }, { rootMargin: '100% 0px' });
  preload.observe(story);
  setMode(!reduced.matches);
}
