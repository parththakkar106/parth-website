(function () {
  /* ---------- GitHub contributions (public/data/contributions.json, refreshed nightly) ---------- */
  var WEEKS_SHOWN = 13; // rolling ~3 months
  var weeks = [], total = 0, sample = true, updated = '';
  function level(n) { return n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 9 ? 3 : 4; }
  function heatCaption() {
    return total.toLocaleString() + ' contributions in the last 3 months' + (sample ? ' (sample data)' : '');
  }
  function renderCells() {
    var cells = document.getElementById('cells');
    cells.innerHTML = '';
    weeks.forEach(function (wk) {
      wk.forEach(function (n) { var i = document.createElement('i'); var l = level(n); if (l) i.className = 'l' + l; i.title = n + ' contributions'; cells.appendChild(i); });
    });
    document.getElementById('pTotal').textContent = heatCaption();
    var flat = [].concat.apply([], weeks), active = 0, best = 0, streak = 0;
    flat.forEach(function (n) { if (n > 0) active++; if (n > best) best = n; });
    for (var i = flat.length - 1; i >= 0 && flat[i] > 0; i--) streak++;
    if (!streak && flat.length > 1) for (var j = flat.length - 2; j >= 0 && flat[j] > 0; j--) streak++; // today may not have a commit yet
    document.getElementById('heatStats').innerHTML =
      '<div><dt>Active days</dt><dd>' + active + '<small> / ' + flat.length + '</small></dd></div>' +
      '<div><dt>Busiest day</dt><dd>' + best + '</dd></div>' +
      '<div><dt>Current streak</dt><dd>' + streak + '<small> days</small></dd></div>';
  }
  fetch('data/contributions.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { weeks = (d.weeks || []).slice(-WEEKS_SHOWN); total = weeks.reduce(function (a, wk) { return a + wk.reduce(function (x, y) { return x + y; }, 0); }, 0); sample = !!d.sample; updated = d.updated || ''; renderCells(); })
    .catch(function () { document.getElementById('pTotal').textContent = 'Contribution data is unavailable right now.'; });

  // terminal heatmap as block characters
  function asciiHeat() {
    var rows = ['', '', '', '', '', '', ''];
    weeks.forEach(function (wk) {
      for (var d = 0; d < 7; d++) {
        var l = d < wk.length ? level(wk[d]) : 0;
        rows[d] += d < wk.length ? '<span class="h' + l + '">■</span>' : ' ';
      }
    });
    var lbl = ['   ', 'Mon', '   ', 'Wed', '   ', 'Fri', '   '];
    return rows.map(function (r, i) { return '<span class="d">' + lbl[i] + '</span> ' + r; }).join('\n');
  }

  /* ---------- terminal ---------- */
  var log = document.getElementById('log');
  var input = document.getElementById('cmd');
  var menu = document.getElementById('menu');
  var busy = false;

  var COMMANDS = [
    ['/about', 'Who Parth is, in four lines'],
    ['/work', 'Experience at Goldman Sachs and MapMyIndia'],
    ['/projects', 'AI D&D, Showdown, Job Copilot and more'],
    ['/contributions', 'GitHub activity, last 3 months'],
    ['/resume', 'Download the resume PDF'],
    ['/contact', 'Email, GitHub, LinkedIn'],
    ['/plain', 'Switch to the plain page'],
    ['/clear', 'Clear the screen'],
    ['/help', 'List commands']
  ];

  function el(cls, html) { var e = document.createElement('div'); e.className = cls; e.innerHTML = html; return e; }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Touch devices get no auto-focus, so the keyboard only opens when the visitor taps the prompt.
  var FINE = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  function focusInput() { if (FINE) input.focus({ preventScroll: true }); }
  function atBottom() { return innerHeight + scrollY >= document.documentElement.scrollHeight - 160; }
  function scroll() { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }); }
  // While text streams in, jump (not smooth-scroll) so repeated calls never fight each other.
  function follow(fn) { var b = atBottom(); fn(); if (b) window.scrollTo(0, document.documentElement.scrollHeight); }
  // A label/value row that sits side by side on wide screens and stacks on phones.
  function kv(k, v) { return '<span class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></span>'; }

  var OUT = {
    '/about':
      '<span class="h">Parth Thakkar</span> <span class="d">· software engineer</span>\n' +
      'Quantitative Analyst at Goldman Sachs since Jan 2024. Builds the Python optimizer behind $600B+ of firm funding and a LangGraph agent for the weekly funding plan.\n' +
      'CS from <a href="https://www.bits-pilani.ac.in/" target="_blank" rel="noopener">BITS Pilani</a> (2024). Builds <a href="https://showdown.parth.party/" target="_blank" rel="noopener">Showdown</a> and <a href="https://parththakkar106.github.io/AI-DnD/" target="_blank" rel="noopener">AI D&amp;D</a> on the side.\n' +
      '<span class="d">Next: /work · /projects · or ask anything</span>',
    '/work':
      '<span class="h">Goldman Sachs</span> <span class="d">Quantitative Analyst · Jan 2024 – now</span>' +
      kv('<span class="g">✓</span> Liability Optimizer', '$600B+ funding · solver runs 90% faster') +
      kv('<span class="g">✓</span> AI Planning Assistant', 'ReAct agent, 20+ tools · ~60% less planning time') +
      kv('<span class="g">✓</span> Infra', '4+ k8s microservices · Redis cache −74% latency') + '\n' +
      '<span class="h">MapMyIndia</span> <span class="d">Developer Intern · 2022</span>' +
      kv('<span class="g">✓</span> EV routing backend', 'FastAPI, Dijkstra on a geospatial graph'),
    '/projects':
      kv('<span class="h">ai-dnd/</span>', 'LLM storytelling engine · branching story tree · 549 tests\n<a href="https://parththakkar106.github.io/AI-DnD/" target="_blank" rel="noopener">play demo</a>  <a href="https://github.com/parththakkar106/AI-DnD" target="_blank" rel="noopener">source</a>') +
      kv('<span class="h">showdown/</span>', 'real-time 1v1 trivia · WebSockets · 31,777 questions\n<a href="https://showdown.parth.party/" target="_blank" rel="noopener">showdown.parth.party</a>') +
      kv('<span class="h">job-copilot/</span>', 'finds jobs daily, autofills applications, never auto-submits\n<span class="d">private repo</span>') +
      kv('<span class="h">fog-computing/</span>', 'Java fog system, ~20 nodes · −31% delay, −79% energy <span class="d">(2022)</span>') + '\n' +
      '<span class="d">Ask “how does the AI D&amp;D referee work?” for a deeper dive.</span>',
    '/contact':
      'email     <a href="mailto:thakkarparth106@gmail.com">thakkarparth106@gmail.com</a>\n' +
      'github    <a href="https://github.com/parththakkar106" target="_blank" rel="noopener">github.com/parththakkar106</a>\n' +
      'linkedin  <a href="https://linkedin.com/in/parth-thakkar-10" target="_blank" rel="noopener">linkedin.com/in/parth-thakkar-10</a>',
    '/resume':
      '<span class="g">✓</span> <a href="assets/Parth_Thakkar_Resume.pdf" download>Parth_Thakkar_Resume.pdf</a> <span class="d">(PDF, 1 page)</span>',
    '/help': null,
    '/contributions': null
  };

  function helpText() {
    return COMMANDS.map(function (c) { return kv('<span class="h">' + c[0] + '</span>', '<span class="d">' + c[1] + '</span>'); }).join('') +
      '\n<span class="d">Anything else you type goes to the model, which only answers from Parth\'s resume and project notes.</span>';
  }

  // scripted "LLM" answers for the mock
  var ASK = [
    { k: /goldman|gs|work|job|langgraph|agent|optimi/i,
      reads: ['about/resume.md', 'work/goldman.md'],
      a: 'At Goldman Sachs Parth works on two main systems.\n\n' +
         '1. The <span class="h">Liability Optimizer</span>: a Python optimization engine behind $600B+ of firm funding. Its output drives multi-year liquidity buffer decisions. He cut solver runtime 90% for similar runs with warm starts, state reuse and selective recomputation.\n\n' +
         '2. The <span class="h">AI Funding Planning Assistant</span>: a ReAct agent built with LangGraph and Pydantic, with 20+ tools and a human-in-the-loop commit path. It cut the time to build a weekly plan by about 60%.\n\n' +
         '<span class="d">Want the infra side (Kubernetes, Redis caching)? Ask away, or run /work.</span>' },
    { k: /showdown|trivia|quiz|websocket/i,
      reads: ['projects/showdown.md'],
      a: 'Showdown is a real-time 1v1 trivia game at <a href="https://showdown.parth.party/" target="_blank" rel="noopener">showdown.parth.party</a>. Both players get the same question on the same 15-second clock.\n\nOne FastAPI process owns every live room; each room runs its timers as asyncio tasks over a WebSocket. Postgres (Neon) is read once at startup and written when a match ends, so play never waits on the database.' },
    { k: /d&d|dnd|dungeon|story|referee/i,
      reads: ['projects/ai-dnd.md', 'projects/ai-dnd/GUIDE.md'],
      a: 'AI D&amp;D is an AI Dungeon-style storytelling app that runs on any OpenAI-compatible model.\n\nThe interesting part is the <span class="h">world-state referee</span>: each turn the model proposes changes to the world, and a Python engine decides which ones actually stick. Stories are a tree, so any turn can hold several takes and you can branch from any of them. 549 backend tests.\n\n<a href="https://parththakkar106.github.io/AI-DnD/" target="_blank" rel="noopener">Play the demo</a>' },
    { k: /contact|reach|email|talk|chat|connect|linkedin/i,
      reads: ['about/contact.md'],
      a: 'Parth is always happy to talk about his work. Email <a href="mailto:thakkarparth106@gmail.com">thakkarparth106@gmail.com</a>, or find him on <a href="https://github.com/parththakkar106" target="_blank" rel="noopener">GitHub</a> and <a href="https://linkedin.com/in/parth-thakkar-10" target="_blank" rel="noopener">LinkedIn</a>.' }
  ];
  var OFFTOPIC = /weather|recipe|poem|joke|stock price|bitcoin|write me|code for|translate/i;

  function addUser(text) { log.appendChild(el('u', esc(text))); }

  function runSlash(cmd) {
    var b = el('block', '');
    if (cmd === '/clear') { [].slice.call(log.querySelectorAll('.u, .block')).forEach(function (n) { n.remove(); }); return; }
    if (cmd === '/plain') { setView('plain'); return; }
    if (cmd === '/help') b.appendChild(el('out', helpText()));
    else if (cmd === '/contributions') {
      b.appendChild(el('out', '<a class="h" href="https://github.com/parththakkar106" target="_blank" rel="noopener">github.com/parththakkar106</a> <span class="d">· ' + total.toLocaleString() + ' contributions in the last 3 months' + (sample ? ' (sample data)' : '') + ' · includes private repos</span>'));
      var h = el('heat', '<pre>' + asciiHeat() + '</pre>'); b.appendChild(h);
      b.appendChild(el('out', '<span class="d">less </span><span class="h0">■</span><span class="h1">■</span><span class="h2">■</span><span class="h3">■</span><span class="h4">■</span><span class="d"> more</span>'));
    }
    else if (OUT.hasOwnProperty(cmd)) b.appendChild(el('out', OUT[cmd]));
    else b.appendChild(el('dot err', 'Unknown command ' + esc(cmd) + '. Try /help.'));
    log.appendChild(b);
  }

  var GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽'];
  var VERBS = ['Thinking', 'Reading notes', 'Pondering', 'Recalling'];
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- live model via /api/chat, scripted answers when it is off ---------- */
  var history = [];
  var modelTag = document.getElementById('modelTag');
  fetch('api/chat', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : { live: false }; })
    .catch(function () { return { live: false }; })
    .then(function (d) {
      modelTag.innerHTML = d.live ? 'model: live via OpenRouter' : '<span class="demo-pill">DEMO</span> scripted answers<span class="soon"> · live AI coming soon</span>';
    });

  // Resolves to a streaming Response, or null when the live model is off or unreachable.
  function callModel(q) {
    var msgs = history.concat([{ role: 'user', content: q }]).slice(-8);
    return fetch('api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs }) })
      .then(function (r) { return r.ok && r.body && /text\/plain/.test(r.headers.get('content-type') || '') ? r : null; })
      .catch(function () { return null; });
  }
  function fmt(text) {
    return esc(text).replace(/\*\*([^*]+)\*\*/g, '<span class="h">$1</span>').replace(/`([^`]+)`/g, '<span class="bl">$1</span>');
  }
  function streamResponse(node, res) {
    var reader = res.body.getReader(), dec = new TextDecoder(), acc = '';
    return (function pump() {
      return reader.read().then(function (r) {
        if (r.done) return acc;
        acc += dec.decode(r.value, { stream: true });
        follow(function () { node.innerHTML = fmt(acc); });
        return pump();
      });
    })();
  }

  function ask(q) {
    busy = true;
    var b = el('block', ''); log.appendChild(b);
    var spin = el('spin', ''); b.appendChild(spin);
    var gi = 0, vi = Math.floor(Math.random() * VERBS.length), t0 = Date.now();
    var timer = setInterval(function () {
      gi = (gi + 1) % GLYPHS.length;
      spin.innerHTML = GLYPHS[gi] + ' ' + VERBS[vi] + '…<span class="d">(' + ((Date.now() - t0) / 1000).toFixed(0) + 's)</span>';
    }, 120);

    var live = callModel(q);
    var hit = null;
    for (var i = 0; i < ASK.length; i++) if (ASK[i].k.test(q)) { hit = ASK[i]; break; }
    var off = !hit && OFFTOPIC.test(q);

    var chain = wait(500);
    var reads = hit ? hit.reads : (off ? [] : ['about/resume.md']);
    reads.forEach(function (f) {
      chain = chain.then(function () {
        b.insertBefore(el('dot tool', '<b>Read</b><span>(' + f + ')</span>'), spin);
        return wait(380);
      }).then(function () {
        b.insertBefore(el('res', 'Read ' + (20 + Math.floor(Math.random() * 60)) + ' lines'), spin);
        return wait(250);
      });
    });
    chain.then(function () { return live; }).then(function (res) {
      clearInterval(timer); spin.remove();
      var d = el('dot', ''); b.appendChild(d);
      if (res) {
        return streamResponse(d, res).then(function (answer) {
          history.push({ role: 'user', content: q }, { role: 'assistant', content: answer });
        }, function () {
          d.className = 'dot err'; d.textContent = 'The answer got cut off. Try asking again.';
        });
      }
      var text = hit ? hit.a
        : off ? 'I only answer questions about Parth and his work. Try /projects, or ask what he built at Goldman.'
        : 'I don\'t have a note on that. Here is the short version of Parth: software engineer, Quant Analyst at Goldman Sachs building optimizers and LLM agents, and builder of AI D&amp;D and Showdown on the side. Try /projects or /work.';
      return stream(d, text).then(function () {
        b.appendChild(el('demo', '<span class="demo-pill">DEMO</span> scripted answer · the live AI model is not connected yet'));
      });
    }).then(function () { busy = false; focusInput(); });
  }

  // stream text token by token without breaking HTML tags
  function stream(node, html) {
    var parts = html.match(/<[^>]+>|&[a-z#0-9]+;|[^<&\s]+|\s+/g) || [];
    var i = 0, buf = '';
    return new Promise(function (done) {
      (function step() {
        for (var k = 0; k < 3 && i < parts.length; k++) {
          buf += parts[i++];
          while (i < parts.length && parts[i].charAt(0) === '<') buf += parts[i++];
        }
        follow(function () { node.innerHTML = buf; });
        if (i < parts.length) setTimeout(step, 22); else done();
      })();
    });
  }

  function run(text) {
    text = text.trim();
    if (!text || busy) return;
    addUser(text);
    if (text.charAt(0) === '/') { runSlash(text.split(/\s+/)[0].toLowerCase()); scroll(); }
    else { ask(text); scroll(); }
  }

  // slash autocomplete menu
  var sel = 0, matches = [];
  function renderMenu() {
    var v = input.value;
    if (v.charAt(0) !== '/' || v.indexOf(' ') !== -1) { menu.hidden = true; matches = []; return; }
    matches = COMMANDS.filter(function (c) { return c[0].indexOf(v.toLowerCase()) === 0; });
    if (!matches.length) { menu.hidden = true; return; }
    sel = Math.min(sel, matches.length - 1);
    menu.innerHTML = matches.map(function (c, i) {
      return '<button type="button" role="option" data-cmd="' + c[0] + '" class="' + (i === sel ? 'on' : '') + '" aria-selected="' + (i === sel) + '"><span>' + c[0] + '</span><span>' + c[1] + '</span></button>';
    }).join('');
    menu.hidden = false;
  }
  input.addEventListener('input', function () { sel = 0; renderMenu(); });
  input.addEventListener('keydown', function (e) {
    if (menu.hidden) return;
    if (e.key === 'ArrowDown') { sel = (sel + 1) % matches.length; renderMenu(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = (sel - 1 + matches.length) % matches.length; renderMenu(); e.preventDefault(); }
    else if (e.key === 'Tab') { input.value = matches[sel][0]; renderMenu(); e.preventDefault(); }
    else if (e.key === 'Escape') { menu.hidden = true; }
    else if (e.key === 'Enter' && matches.length && input.value !== matches[sel][0]) { input.value = matches[sel][0]; }
  });
  menu.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    input.value = ''; menu.hidden = true; run(b.dataset.cmd);
  });
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault(); var v = input.value; input.value = ''; menu.hidden = true; run(v);
  });
  document.getElementById('chips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (b) run(b.dataset.run);
  });

  // start in a filled state: show /about already run
  addUser('/about'); runSlash('/about');

  /* ---------- view switch ---------- */
  var term = document.getElementById('term'), plain = document.getElementById('plain');
  var vt = document.getElementById('vt'), vp = document.getElementById('vp');
  function setView(v) {
    var p = v === 'plain';
    term.hidden = p; plain.hidden = !p;
    document.body.classList.toggle('plain', p);
    document.title = p ? 'Parth Thakkar · Software Engineer' : 'Parth Thakkar · parth.party';
    vt.setAttribute('aria-pressed', String(!p)); vp.setAttribute('aria-pressed', String(p));
    try { localStorage.setItem('pp-view', v); } catch (e) {}
    window.scrollTo(0, 0);
    if (!p) focusInput();
    var shown = p ? plain : term;
    shown.classList.remove('enter'); void shown.offsetWidth; shown.classList.add('enter');
  }
  vt.addEventListener('click', function () { setView('term'); });
  vp.addEventListener('click', function () { setView('plain'); });
  if (document.documentElement.classList.contains('start-plain')) setView('plain');
  document.documentElement.classList.remove('start-plain');

  /* ---------- plain view: cards ease in as they scroll into view ---------- */
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !calm) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    [].slice.call(plain.querySelectorAll('section .sec-title, .about p, .fact, .stats > div, .co header, .wcard, .sk, .edu, .pj, .aw, .contact .in > *')).forEach(function (n) {
      // siblings in the same row get a small stagger
      var k = [].indexOf.call(n.parentNode.children, n) % 4;
      n.style.transitionDelay = (k * 60) + 'ms';
      n.classList.add('reveal'); io.observe(n);
      // once settled, drop the reveal styles so hover transitions keep their own timing
      n.addEventListener('transitionend', function done(e) {
        if (e.target !== n || e.propertyName !== 'transform') return;
        n.removeEventListener('transitionend', done); n.classList.remove('reveal', 'seen'); n.style.transitionDelay = '';
      });
    });
  }

  document.getElementById('openTerm').addEventListener('click', function () { setView('term'); });
  document.getElementById('copyMail').addEventListener('click', function () {
    var b = this, t = b.textContent;
    try {
      navigator.clipboard.writeText('thakkarparth106@gmail.com').then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = t; }, 1400); }, function () {});
    } catch (e) {}
  });
})();
