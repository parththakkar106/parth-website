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
    ['/interests', 'Football, Messi and video games'],
    ['/penalty', 'Take five penalties against the keeper'],
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
      'CS from BITS Pilani (2024). Builds <a href="https://showdown.parth.party/" target="_blank" rel="noopener">Showdown</a> and <a href="https://dnd.parth.party/" target="_blank" rel="noopener">AI D&amp;D</a> on the side.\n' +
      '<span class="d">Next: /work · /projects · /interests · or ask anything</span>',
    '/work':
      '<span class="h">Goldman Sachs</span> <span class="d">Quantitative Analyst · Jan 2024 – now</span>' +
      kv('<span class="g">✓</span> Liability Optimizer', '$600B+ funding · solver runs 90% faster') +
      kv('<span class="g">✓</span> AI Planning Assistant', 'ReAct agent, 20+ tools · ~60% less planning time') +
      kv('<span class="g">✓</span> Infra', '4+ k8s microservices · Redis cache −74% latency') + '\n' +
      '<span class="h">MapMyIndia</span> <span class="d">Developer Intern · 2022</span>' +
      kv('<span class="g">✓</span> EV routing backend', 'FastAPI, Dijkstra on a geospatial graph'),
    '/projects':
      kv('<span class="h">ai-dnd/</span>', 'LLM storytelling engine · branching story tree · 549 tests\n<a href="https://dnd.parth.party/" target="_blank" rel="noopener">play demo</a>  <a href="https://github.com/parththakkar106/AI-DnD" target="_blank" rel="noopener">source</a>') +
      kv('<span class="h">showdown/</span>', 'real-time 1v1 trivia · WebSockets · 31,777 questions\n<a href="https://showdown.parth.party/" target="_blank" rel="noopener">showdown.parth.party</a>') +
      kv('<span class="h">job-copilot/</span>', 'finds jobs daily, autofills applications, never auto-submits\n<span class="d">private repo</span>') +
      kv('<span class="h">fog-computing/</span>', 'Java fog system, ~20 nodes · −31% delay, −79% energy <span class="d">(2022)</span>') + '\n' +
      '<span class="d">Ask “how does the AI D&amp;D referee work?” for a deeper dive.</span>',
    '/interests':
      '<span class="h">Off the clock</span>' +
      kv('<span class="h">football</span>', 'watches a lot of it · big Messi fan') +
      kv('<span class="h">video games</span>', 'FIFA, Split Fiction, GTA, Watch Dogs, and more') + '\n' +
      '<span class="d">Fancy a shootout? Run /penalty.</span>',
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
      a: 'AI D&amp;D is an AI Dungeon-style storytelling app that runs on any OpenAI-compatible model.\n\nThe interesting part is the <span class="h">world-state referee</span>: each turn the model proposes changes to the world, and a Python engine decides which ones actually stick. Stories are a tree, so any turn can hold several takes and you can branch from any of them. 549 backend tests.\n\n<a href="https://dnd.parth.party/" target="_blank" rel="noopener">Play the demo</a>' },
    { k: /fun|hobb|interest|football|soccer|messi|game|fifa|gta/i,
      reads: ['about/interests.md'],
      a: 'Outside work Parth watches a lot of football and is a big <span class="h">Messi</span> fan. He also plays video games: FIFA, Split Fiction, GTA, Watch Dogs and more.\n\n<span class="d">Run /penalty to take a few spot kicks yourself.</span>' },
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
    if (cmd === '/penalty' || cmd === '/football') { penalty(); return; }
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

  /* ---------- /penalty: a five-kick shootout, drawn as a small SVG pitch ---------- */
  // Board is a 320×170 SVG. Goal mouth runs x 40–280 between the crossbar (y 30) and the goal line (y 110).
  var KICKS = 5, AIMX = [86, 160, 234];
  // Power is 0–1 along the bar: weak → always saved, good → keeper guesses, top corner → unstoppable, over → misses.
  var P_WEAK = .35, P_GOOD = .75, P_TOP = .86;
  function zoneOf(v) { return v < P_WEAK ? 0 : v < P_GOOD ? 1 : v < P_TOP ? 2 : 3; }
  var pen = null;

  function boardSvg() {
    var net = '';
    for (var x = 52; x < 280; x += 12) net += '<line x1="' + x + '" y1="31" x2="' + x + '" y2="110"/>';
    for (var y = 42; y < 110; y += 12) net += '<line x1="41" y1="' + y + '" x2="279" y2="' + y + '"/>';
    return '<svg viewBox="0 0 320 170" role="img" aria-label="Penalty: goal, keeper and ball">' +
      '<g class="pk-net">' + net + '</g>' +
      '<path class="pk-line" d="M0 110 H320 M110 110 L96 166 M210 110 L224 166"/>' +
      '<path class="pk-frame" d="M40 110 V30 H280 V110"/>' +
      '<circle class="pk-spot" cx="160" cy="150" r="2"/>' +
      '<g class="pk-aim"><circle r="9"/><path d="M-14 0 H-5 M5 0 H14 M0 -14 V-5 M0 5 V14"/></g>' +
      '<g class="pk-kp"><circle cx="0" cy="-50" r="5.5"/><path d="M0 -44 V-22 M-15 -56 L0 -40 L15 -56 M0 -22 L-9 0 M0 -22 L9 0"/></g>' +
      '<circle class="pk-ball" r="6"/>' +
      '</svg>';
  }

  function penalty() {
    var b = el('block pk', ''); log.appendChild(b);
    var head = el('out', '<span class="h">Penalty shootout</span> <span class="d">· ' + KICKS + ' kicks · stop the bar in the green · the bright strip is the top corner</span>');
    var board = el('out pk-board', boardSvg() +
      '<div class="pk-bar" aria-hidden="true"><i class="z0"></i><i class="z1"></i><i class="z2"></i><i class="z3"></i><b></b></div>' +
      '<div class="pk-score"></div>');
    var msg = el('out pk-msg', ''), ctl = el('pk-ctl', '');
    ctl.innerHTML = '<button type="button" data-a="0">◀ left</button><button type="button" data-a="1">▲ middle</button><button type="button" data-a="2">right ▶</button><button type="button" class="shoot" data-a="s">SHOOT</button><button type="button" class="quit" data-a="q">esc</button>';
    var hint = el('out pk-hint d', '←/↑/→ or 1/2/3 to aim · space to shoot · esc to quit');
    [head, board, msg, ctl, hint].forEach(function (n) { b.appendChild(n); });
    var q = function (s) { return board.querySelector(s); };
    pen = { b: b, msg: msg, ctl: ctl, hint: hint, svg: q('svg'), aimG: q('.pk-aim'), kp: q('.pk-kp'), ball: q('.pk-ball'), net: q('.pk-net'),
            bar: q('.pk-bar'), needle: q('.pk-bar b'), score: q('.pk-score'),
            aim: 1, kick: 0, res: [], phase: 'aim', t0: performance.now(), raf: 0 };
    busy = true; input.disabled = true; input.blur(); input.placeholder = 'playing /penalty · esc to quit';
    // pointerdown, not click: the shot registers the instant the finger or button goes down
    ctl.addEventListener('pointerdown', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      e.preventDefault();
      var a = t.dataset.a;
      if (a === 's') shoot(); else if (a === 'q') endPen(true); else setAim(+a);
    });
    ctl.addEventListener('click', function (e) { if (e.detail === 0) { var t = e.target.closest('button'); if (t && t.dataset.a === 's') shoot(); } }); // keyboard-activated buttons
    document.body.classList.add('pk-on');
    resetKick();
    pen.raf = requestAnimationFrame(tick);
    window.scrollTo(0, document.documentElement.scrollHeight);
  }

  // One full sweep up and back takes this long; a touch quicker each kick, never frantic.
  function period() { return 2600 - pen.kick * 150; }
  function powerAt(t) { var x = ((t - pen.t0) % period()) / period(); return x < .5 ? x * 2 : 2 - x * 2; }

  function place(node, x, y, extra) { node.setAttribute('transform', 'translate(' + x + ' ' + y + ')' + (extra || '')); }

  function resetKick() {
    pen.phase = 'aim'; pen.aim = 1; pen.t0 = performance.now();
    pen.bar.classList.remove('locked'); pen.net.classList.remove('hit');
    pen.aimG.style.display = '';
    place(pen.kp, 160, 110); place(pen.ball, 160, 150); pen.ball.setAttribute('r', 6); pen.ball.style.opacity = 1;
    setAim(1); drawScore();
  }

  function setAim(a) { if (pen && pen.phase === 'aim') { pen.aim = a; place(pen.aimG, AIMX[a], 44); } }

  function tick(t) {
    if (!pen) return;
    pen.raf = requestAnimationFrame(tick);
    if (pen.phase === 'aim') pen.needle.style.left = (powerAt(t) * 100) + '%';
  }

  function drawScore() {
    pen.score.innerHTML = '<span class="d">kick ' + Math.min(pen.kick + 1, KICKS) + '/' + KICKS + '</span>  ' + dots(pen.res);
  }

  function shoot() {
    if (!pen || pen.phase !== 'aim') return;
    // lock power at the exact moment of the press, not at the last drawn frame
    var v = powerAt(performance.now());
    pen.phase = 'fly';
    pen.needle.style.left = (v * 100) + '%';
    pen.bar.classList.add('locked');
    pen.aimG.style.display = 'none';
    var z = zoneOf(v), aim = pen.aim, guess = Math.floor(Math.random() * 3), goal, line;
    if (z === 0) { goal = false; guess = aim; line = 'Saved. Too soft, the keeper just collects it.'; }
    else if (z === 3) { goal = false; line = 'Over the bar. Into row Z.'; }
    else if (z === 2) { goal = true; line = guess === aim ? 'GOAL! Top corner. The keeper got a glove on it and it still went in.' : 'GOAL! Top bins, no chance.'; }
    else if (guess === aim) { goal = false; line = 'Saved! The keeper guessed right.'; }
    else { goal = true; line = ['GOAL! Sent the keeper the wrong way.', 'GOAL! Cool as you like.', 'GOAL! Bottom of the net.'][Math.floor(Math.random() * 3)]; }

    // where the ball ends up, and how the keeper moves
    var bx = AIMX[aim], by = z === 3 ? 8 : z === 2 ? 42 : 82;
    if (!goal && z !== 3) { by = guess === 1 ? 72 : 88; } // into the keeper's hands
    var kx = guess === 1 ? 160 : AIMX[guess] + (guess === 0 ? 14 : -14);
    var rot = guess === 0 ? -72 : guess === 2 ? 72 : 0, ky = guess === 1 ? 104 : 104;
    var T = 520, start = performance.now();
    (function fly(now) {
      if (!pen) return;
      var t = Math.min(1, (now - start) / T), e = 1 - Math.pow(1 - t, 3);
      place(pen.ball, 160 + (bx - 160) * e, 150 + (by - 150) * e - Math.sin(Math.PI * e) * (z === 3 ? 30 : 14));
      pen.ball.setAttribute('r', (6 - 2 * e).toFixed(2));
      if (z === 3 && t > .85) pen.ball.style.opacity = (1 - t) / .15;
      var k = Math.max(0, Math.min(1, (t - .12) / .7)), ke = 1 - Math.pow(1 - k, 2);
      place(pen.kp, 160 + (kx - 160) * ke, 110 + (ky - 110) * ke - (guess === 1 ? 10 * Math.sin(Math.PI * k) : 0), ' rotate(' + (rot * ke).toFixed(1) + ')');
      if (t < 1) return requestAnimationFrame(fly);
      pen.res.push(goal);
      if (goal) pen.net.classList.add('hit');
      follow(function () { pen.msg.innerHTML = (goal ? '<span class="h">' : '<span class="pk-miss">') + esc(line) + '</span>'; drawScore(); });
      setTimeout(function () {
        if (!pen) return;
        pen.kick++;
        if (pen.kick >= KICKS) return endPen(false);
        pen.msg.innerHTML = '';
        resetKick();
      }, 1400);
    })(start);
  }

  function dots(res) {
    var out = [];
    for (var i = 0; i < KICKS; i++) out.push(i < res.length ? (res[i] ? '<span class="h">●</span>' : '<span class="pk-miss">✕</span>') : '<span class="pk-dim">○</span>');
    return out.join(' ');
  }

  function endPen(quit) {
    if (!pen) return;
    var p = pen; pen = null;
    cancelAnimationFrame(p.raf);
    if (!quit) p.score.innerHTML = '<span class="d">final</span>  ' + dots(p.res);
    p.ctl.remove(); p.hint.remove();
    var n = p.res.filter(Boolean).length, best = 0;
    if (!quit) {
      try { best = Math.max(+localStorage.getItem('pp-pen-best') || 0, n); localStorage.setItem('pp-pen-best', best); } catch (e) { best = n; }
    }
    var verdict = quit ? 'Shootout abandoned after ' + p.res.length + (p.res.length === 1 ? ' kick.' : ' kicks.')
      : n === 5 ? '5 from 5. Messi would be proud.'
      : n === 4 ? '4 from 5. Clinical.'
      : n === 3 ? '3 from 5. The keeper read a couple.'
      : n + ' from 5. The keeper had your number.';
    p.msg.innerHTML = '<span class="h">' + verdict + '</span>' + (quit || !best ? '' : '  <span class="d">best: ' + best + '/5</span>') +
      '\n<span class="d">Run /penalty to go again.</span>';
    busy = false; input.disabled = false; input.placeholder = 'Ask anything, or type /help';
    document.body.classList.remove('pk-on');
    focusInput(); window.scrollTo(0, document.documentElement.scrollHeight);
  }

  document.addEventListener('keydown', function (e) {
    if (!pen || term.hidden || e.repeat) return;
    var k = e.key, a = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, '1': 0, '2': 1, '3': 2 }[k];
    if (a !== undefined) setAim(a);
    else if (k === ' ' || k === 'Enter') shoot();
    else if (k === 'Escape') endPen(true);
    else return;
    e.preventDefault();
  });

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
    [].slice.call(plain.querySelectorAll('section .sec-title, .about p, .fact, .co header, .wcard, .sk, .edu, .pj, .aw, .lk, .contact .in > *')).forEach(function (n) {
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

  /* ---------- plain view: faint code rain in the background ---------- */
  (function () {
    var c = document.getElementById('rain'), ctx = c.getContext && c.getContext('2d');
    if (!ctx) return;
    var glyphs = '01<>/{}[]=+*$#λ∑ｱｲｳｴｵｶｷｸｹｺ', TRAIL = 14;
    var small, fs, cols, ys, sp, w = 0, h = 0, raf = 0, last = 0;
    function reset(i) { sp[i] = .3 + Math.random() * .7; }
    function size() {
      var nw = innerWidth, nh = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, nw <= 640 ? 1.5 : 2);
      c.width = nw * dpr; c.height = nh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // phone address bars change only the height; keep the columns where they are
      if (nw !== w) {
        small = nw <= 640; fs = small ? 14 : 16; cols = Math.ceil(nw / fs); ys = []; sp = [];
        for (var i = 0; i < cols; i++) { ys[i] = Math.random() * nh / fs; reset(i); }
      }
      w = nw; h = nh; draw(false);
    }
    function draw(move) {
      var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#18b548';
      ctx.clearRect(0, 0, w, h); ctx.font = fs + 'px "JetBrains Mono", ui-monospace, monospace'; ctx.fillStyle = accent;
      for (var i = 0; i < cols; i += small ? 2 : 1) {
        for (var j = 0; j < TRAIL; j++) {
          var y = (ys[i] - j) * fs; if (y < -fs || y > h) continue;
          ctx.globalAlpha = j === 0 ? .24 : .11 * (1 - j / TRAIL);
          ctx.fillText(glyphs[(i * 7 + Math.floor(ys[i]) - j + glyphs.length * 99) % glyphs.length], i * fs, y);
        }
        if (move) { ys[i] += sp[i] * .5; if ((ys[i] - TRAIL) * fs > h) { ys[i] = 0; reset(i); } }
      }
      ctx.globalAlpha = 1;
    }
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (t - last < 1000 / 24) return;
      last = t; draw(true);
    }
    function run() {
      var on = !plain.hidden && !document.hidden && !calm;
      if (on && !raf) raf = requestAnimationFrame(loop);
      if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    size();
    addEventListener('resize', size);
    document.addEventListener('visibilitychange', run);
    new MutationObserver(function () { if (!plain.hidden) size(); run(); }).observe(plain, { attributes: true, attributeFilter: ['hidden'] });
    // redraw in the new colour when the system theme flips
    if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener('change', size) : mq.addListener(size)); }
    run();
  })();

  document.getElementById('openTerm').addEventListener('click', function () { setView('term'); });
  document.getElementById('playPen').addEventListener('click', function () { setView('term'); if (!busy) { addUser('/penalty'); penalty(); } });
  document.getElementById('copyMail').addEventListener('click', function () {
    var b = this, t = b.textContent;
    try {
      navigator.clipboard.writeText('thakkarparth106@gmail.com').then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = t; }, 1400); }, function () {});
    } catch (e) {}
  });
})();
