// the ONE tab switcher. app.js used to carry a near-copy of this, with a comment admitting it was
// "the same pattern as review_ui/shell.js" - the page was a python string then, so it could not
// pull in a second script. it is a real file now, so there is one implementation again
//
// reads the nav out of the dom rather than a hardcoded name list, so a new tab is a .nav-tab plus
// a .tab-panel in index.html and nothing here changes

let activeTab = null;

// what runs when a tab is entered, set by initShell - the shell owns the mechanics, the host
// owns what a given tab has to load
let onEnterTab = () => {};

// namespaced to this package, not to any one tool that uses it
const TAB_KEY = 'ui-base:tab';

function activateTab(name) {
  activeTab = name;
  // REMEMBER WHERE HE WAS. a refresh mid-drawing used to throw him back to a fixed tab
  try { localStorage.setItem(TAB_KEY, name); } catch (err) { /* private window, no matter */ }
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    // only the active tab sits in the tab order - arrow keys move focus between tabs instead
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== name);
  });
  onEnterTab(name);
}

// fallback is the cold-start tab; a remembered name that no longer has a nav entry falls through
// to it, which is what makes deleting a tab safe for anyone who was last sitting on it
function initShell({onEnter = () => {}, fallback = ''} = {}) {
  onEnterTab = onEnter;
  const tabs = Array.from(document.querySelectorAll('.nav-tab'));
  tabs.forEach((tab, i) => {
    tab.onclick = () => activateTab(tab.dataset.tab);
    tab.onkeydown = evt => {
      // left/right wrap around the tab list, matching standard tablist keyboard behavior
      let next = null;
      if (evt.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (evt.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (evt.key === 'Enter' || evt.key === ' ') next = tab;
      if (next) { evt.preventDefault(); next.focus(); activateTab(next.dataset.tab); }
    };
  });
  let start = fallback;
  try {
    const remembered = localStorage.getItem(TAB_KEY);
    if (remembered && document.querySelector(`.nav-tab[data-tab="${remembered}"]`)) {
      start = remembered;
    }
  } catch (err) { /* private window */ }
  if (!start || !document.querySelector(`.nav-tab[data-tab="${start}"]`)) {
    const marked = tabs.find(t => t.classList.contains('active')) || tabs[0];
    start = marked ? marked.dataset.tab : '';
  }
  if (start) activateTab(start);
}
