(() => {
  const states = ['state--calm', 'state--strain', 'state--collapse', 'state--restore'];
  const body = document.body;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clearStates() {
    states.forEach((c) => body.classList.remove(c));
  }

  function setState(state = 'calm') {
    clearStates();
    const cls = `state--${state}`;
    if (states.includes(cls)) body.classList.add(cls);
  }

  function triggerCollapse() {
    if (prefersReduced) {
      setState('collapse');
      setTimeout(() => setState('restore'), 400);
      setTimeout(() => setState('calm'), 900);
      return;
    }
    setState('collapse');
    setTimeout(() => setState('restore'), 1800);
    setTimeout(() => setState('calm'), 3200);
  }

  window.StonedokuFX = {
    setState,
    triggerCollapse,
  };

  // Optional: listeners can call window.StonedokuFX.triggerCollapse()
  // from puzzle completion handlers (e.g., GameUI.checkSinglePlayerComplete / endVersusGame).
})();
