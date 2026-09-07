// Mobile nav
const toggle = document.querySelector('.nav-toggle');
const mobile = document.querySelector('.nav-mobile');
if (toggle && mobile) {
  toggle.addEventListener('click', () => {
    const open = mobile.hasAttribute('hidden');
    if (open) {
      mobile.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      mobile.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  mobile.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      mobile.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );
}

// Scroll reveal
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce) {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
} else if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12 }
  );
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
}

// Mini Vim demo: Normal mode over a real textarea
(function demo() {
  const area = document.getElementById('demoArea');
  const modeTag = document.getElementById('demoMode');
  if (!area || !modeTag) return;

  let mode = 'insert';
  let pendingG = false;

  function setMode(m) {
    mode = m;
    pendingG = false;
    modeTag.textContent = m === 'normal' ? 'Normal' : 'Insert';
    modeTag.classList.toggle('tag-dark', m === 'normal');
  }

  function lineBounds(value, pos) {
    const start = value.lastIndexOf('\n', pos - 1) + 1;
    let end = value.indexOf('\n', pos);
    if (end === -1) end = value.length;
    return { start, end };
  }

  function moveLines(value, pos, dir) {
    const lines = value.split('\n');
    let offset = 0;
    let row = 0;
    let col = 0;
    for (let i = 0; i < lines.length; i++) {
      const len = lines[i].length + 1;
      if (pos < offset + len || i === lines.length - 1) {
        row = i;
        col = Math.min(pos - offset, lines[i].length);
        break;
      }
      offset += len;
    }
    const next = Math.max(0, Math.min(lines.length - 1, row + dir));
    return (
      lines.slice(0, next).reduce((a, l) => a + l.length + 1, 0) +
      Math.min(col, lines[next].length)
    );
  }

  function isWord(ch) {
    return /[A-Za-z0-9_]/.test(ch);
  }

  function wordForward(value, pos) {
    let i = pos;
    const n = value.length;
    if (i < n && isWord(value[i])) while (i < n && isWord(value[i])) i++;
    while (i < n && !isWord(value[i])) i++;
    return Math.min(i, n);
  }

  function wordBack(value, pos) {
    let i = Math.max(0, pos - 1);
    while (i > 0 && !isWord(value[i])) i--;
    while (i > 0 && isWord(value[i - 1])) i--;
    return i;
  }

  function wordEnd(value, pos) {
    let i = Math.min(pos + 1, value.length);
    const n = value.length;
    while (i < n && !isWord(value[i])) i++;
    while (i < n - 1 && isWord(value[i + 1])) i++;
    return Math.min(i, n - 1);
  }

  // Capture on window, before any page or extension document-level
  // capture listeners (including the real Vim-For-Textarea, which our
  // visitors are likely to have installed). stopPropagation keeps the
  // demo box owned by this handler so keys are never double-handled.
  window.addEventListener('keydown', (e) => {
    if (e.target !== area) return;
    e.stopPropagation();

    if (mode === 'insert') {
      if (e.key === 'Escape') {
        e.preventDefault();
        const p = Math.max(0, area.selectionStart - 1);
        area.setSelectionRange(p, p);
        setMode('normal');
      }
      return;
    }

    // Normal mode
    const v = area.value;
    let pos = area.selectionStart;
    const { start, end } = lineBounds(v, pos);
    let handled = true;

    if (e.key === 'Escape') {
      setMode('normal');
    } else if (e.key === 'h') {
      pos = Math.max(start, pos - 1);
    } else if (e.key === 'l' || e.key === ' ') {
      pos = Math.min(Math.max(start, end - 1), pos + 1);
    } else if (e.key === 'j') {
      pos = moveLines(v, pos, 1);
    } else if (e.key === 'k') {
      pos = moveLines(v, pos, -1);
    } else if (e.key === '0') {
      pos = start;
    } else if (e.key === '$') {
      pos = Math.max(start, end - 1);
    } else if (e.key === '^') {
      const m = /^[ \t]*/.exec(v.slice(start, end));
      pos = start + (m ? m[0].length : 0);
    } else if (e.key === 'w') {
      pos = wordForward(v, pos);
    } else if (e.key === 'b') {
      pos = wordBack(v, pos);
    } else if (e.key === 'e') {
      pos = wordEnd(v, pos);
    } else if (e.key === 'g' && !pendingG) {
      pendingG = true;
      handled = true;
      area.setSelectionRange(pos, pos);
      e.preventDefault();
      return;
    } else if (e.key === 'g' && pendingG) {
      pos = 0;
      pendingG = false;
    } else if (e.key === 'G') {
      pos = v.length;
    } else if (e.key === 'x') {
      if (pos < v.length && v[pos] !== '\n') {
        area.value = v.slice(0, pos) + v.slice(pos + 1);
      }
    } else if (e.key === 'i') {
      setMode('insert');
    } else if (e.key === 'a') {
      pos = Math.min(pos + 1, v.length);
      area.setSelectionRange(pos, pos);
      setMode('insert');
    } else if (e.key === 'o') {
      area.value = v.slice(0, end) + '\n' + v.slice(end);
      area.setSelectionRange(end + 1, end + 1);
      setMode('insert');
    } else {
      handled = false;
      pendingG = false;
    }

    if (handled) {
      e.preventDefault();
      if (['h', 'l', ' ', 'j', 'k', '0', '$', '^', 'w', 'b', 'e', 'g', 'G'].includes(e.key)) {
        area.setSelectionRange(pos, pos);
      } else if (e.key === 'x') {
        area.setSelectionRange(pos, pos);
      }
    }
  }, true);

  area.addEventListener('blur', () => setMode('insert'));
})();
