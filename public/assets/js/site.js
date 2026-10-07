(function () {
  /* ---------- GitHub contributions (public/data/contributions.json, refreshed nightly) ---------- */
  // Window: from Jul 1, 2026 (when the site started) up to today, never more than the last 6 months.
  var FLOOR = Date.UTC(2026, 6, 1), MAX_MONTHS = 6;
  var weeks = [], total = 0, sample = true, start = null; // weeks: arrays of { n, t } per day; n is null before `start`
  function level(n) { return n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 9 ? 3 : 4; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function dayLabel(t) { return MON[t.getUTCMonth()] + ' ' + t.getUTCDate(); }
  function rangeText() { return 'since ' + dayLabel(start) + ', ' + start.getUTCFullYear() + (sample ? ' (sample data)' : ''); }
  // The data's last day is `end` (written by the nightly job), or, in older files, the latest day on or before
  // `updated` that falls on the last cell's weekday (GitHub weeks start on Sunday).
  function lastDayOf(d) {
    var w = d.weeks || [], last = w.length ? w[w.length - 1].length - 1 : 0;
    var t = new Date((d.end || d.updated || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
    if (!d.end) while (t.getUTCDay() !== last) t.setUTCDate(t.getUTCDate() - 1);
    return t;
  }
  function load(d) {
    sample = !!d.sample;
    var all = d.weeks || [], end = lastDayOf(d), n = [].concat.apply([], all).length, k = 0;
    var floor = new Date(end); floor.setUTCMonth(floor.getUTCMonth() - MAX_MONTHS); floor.setUTCDate(floor.getUTCDate() + 1);
    start = new Date(Math.max(FLOOR, floor.getTime()));
    weeks = all.map(function (wk) {
      return wk.map(function (c) { var t = new Date(end); t.setUTCDate(t.getUTCDate() - (n - 1 - k++)); return { n: t >= start ? c : null, t: t }; });
    }).filter(function (wk) { return wk.some(function (c) { return c.n !== null; }); });
    total = 0; weeks.forEach(function (wk) { wk.forEach(function (c) { total += c.n || 0; }); });
  }
  function renderCells() {
    var cells = document.getElementById('cells'), months = document.getElementById('months');
    cells.innerHTML = ''; months.innerHTML = '';
    var prevMonth = -1, labels = [], days = [];
    // about 27px per week, like the original 3-month card; the stats wrap underneath when there's no room
    document.getElementById('heat').style.setProperty('--weeks', weeks.length);
    months.style.gridTemplateColumns = 'repeat(' + weeks.length + ', minmax(0, 1fr))';
    weeks.forEach(function (wk, w) {
      wk.forEach(function (c) {
        var i = document.createElement('i');
        if (c.n === null) { i.className = 'pad'; cells.appendChild(i); return; }
        days.push(c.n);
        var l = level(c.n); if (l) i.className = 'l' + l;
        i.dataset.tip = (c.n ? c.n + ' contribution' + (c.n === 1 ? '' : 's') : 'No contributions') + ' on ' + DOW[c.t.getUTCDay()] + ', ' + dayLabel(c.t);
        cells.appendChild(i);
        // label a column with its month when the month starts inside that week (or at the first column)
        if (c.t.getUTCMonth() !== prevMonth) { labels.push({ w: w, m: MON[c.t.getUTCMonth()] }); prevMonth = c.t.getUTCMonth(); }
      });
    });
    // a partial first month only gets a label if it doesn't crowd the next one
    if (labels.length > 1 && labels[1].w - labels[0].w < 3) labels.shift();
    labels.forEach(function (lb) {
      var m = document.createElement('span'); m.textContent = lb.m;
      m.style.gridColumn = lb.w >= weeks.length - 2 ? (lb.w + 1) + ' / -1' : (lb.w + 1) + ' / span 2';
      if (lb.w >= weeks.length - 2) m.style.justifySelf = 'end';
      months.appendChild(m);
    });
    document.getElementById('heatRange').textContent = rangeText();
    var active = 0, best = 0, streak = 0;
    days.forEach(function (n) { if (n > 0) active++; if (n > best) best = n; });
    for (var i = days.length - 1; i >= 0 && days[i] > 0; i--) streak++;
    if (!streak && days.length > 1) for (var j = days.length - 2; j >= 0 && days[j] > 0; j--) streak++; // today may not have a commit yet
    document.getElementById('heatStats').innerHTML =
      '<div><dt>Contributions</dt><dd>' + total.toLocaleString() + '</dd></div>' +
      '<div><dt>Active days</dt><dd>' + active + '<small> / ' + days.length + '</small></dd></div>' +
      '<div><dt>Busiest day</dt><dd>' + best + '</dd></div>' +
      '<div><dt>Current streak</dt><dd>' + streak + '<small> days</small></dd></div>';
  }
  // hover (or tap) a day to see its date
  (function () {
    var heat = document.getElementById('heat'), tip = document.getElementById('heatTip');
    function show(e) {
      var c = e.target.closest && e.target.closest('#cells i');
      if (!c) { tip.hidden = true; return; }
      tip.textContent = c.dataset.tip; tip.hidden = false;
      var hr = heat.getBoundingClientRect(), cr = c.getBoundingClientRect();
      var x = cr.left - hr.left + cr.width / 2, half = tip.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(hr.width - half, x)) + 'px';
      tip.style.top = (cr.top - hr.top - 6) + 'px';
    }
    heat.addEventListener('pointerover', show);
    heat.addEventListener('pointerdown', show);
    heat.addEventListener('pointerleave', function () { tip.hidden = true; });
  })();
  fetch('data/contributions.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { load(d); renderCells(); })
    .catch(function () { document.getElementById('heatRange').textContent = 'Contribution data is unavailable right now.'; });

  // terminal heatmap as block characters
  function asciiHeat() {
    var rows = ['', '', '', '', '', '', ''];
    weeks.forEach(function (wk) {
      for (var d = 0; d < 7; d++) {
        var c = wk[d];
        rows[d] += c && c.n !== null ? '<span class="h' + level(c.n) + '">■</span>' : ' ';
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
    ['/work', 'What he builds at Goldman Sachs, and before'],
    ['/projects', 'AI D&D, Showdown, this site and more'],
    ['/interests', 'Football, Messi and video games'],
    ['/latest', 'Barça and Messi: last result, next match'],
    ['/penalty', 'Penalty shootout: you kick, then you save'],
    ['/contributions', 'GitHub activity since July'],
    ['/contact', 'LinkedIn, GitHub and email'],
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
      'Quantitative Analyst at Goldman Sachs since Jan 2024, building a Python optimization engine and a LangGraph agent for the weekly funding plan.\n' +
      'CS from BITS Pilani (2024). Builds <a href="https://showdown.parth.party/" target="_blank" rel="noopener">Showdown</a> and <a href="https://dnd.parth.party/" target="_blank" rel="noopener">AI D&amp;D</a> on the side.\n' +
      '<span class="d">Next: /work · /projects · /interests · or ask anything</span>',
    '/work':
      '<span class="h">Goldman Sachs</span> <span class="d">Quantitative Analyst · Jan 2024 – now</span>' +
      kv('<span class="g">✓</span> AI Planning Assistant', 'ReAct agent with a human-in-the-loop commit\n<span class="d">LangGraph · Pydantic · Python</span>') +
      kv('<span class="g">✓</span> Liability Optimizer', 'optimization engine for firm funding\n<span class="d">Python</span>') +
      kv('<span class="g">✓</span> Infra', 'microservices with CI/CD, SSO and a Redis cache\n<span class="d">Kubernetes · ArgoCD · Docker · GitLab CI · Redis</span>') + '\n' +
      '<span class="h">MapMyIndia</span> <span class="d">Developer Intern · 2022</span>' +
      kv('<span class="g">✓</span> EV routing backend', 'Dijkstra on a geospatial graph, full-stack prototype\n<span class="d">FastAPI · React · MongoDB</span>'),
    '/projects':
      kv('<span class="h">ai-dnd/</span>', 'AI storytelling with custom worlds, memory and branching\n<span class="d">Python · FastAPI · React · Postgres</span>\n<a href="https://dnd.parth.party/" target="_blank" rel="noopener">play demo</a>  <a href="https://github.com/parththakkar106/AI-DnD" target="_blank" rel="noopener">source</a>') +
      kv('<span class="h">showdown/</span>', 'real-time 1v1 trivia with friends, 120+ topics\n<span class="d">FastAPI · WebSockets · asyncio · Postgres</span>\n<a href="https://showdown.parth.party/" target="_blank" rel="noopener">showdown.parth.party</a>') +
      kv('<span class="h">portfolio-website/</span>', 'this site, parth.party: a terminal you can talk to\n<span class="d">JavaScript · Cloudflare Pages · OpenRouter</span>') +
      kv('<span class="h">fog-computing/</span>', 'volunteer nodes share the load for IoT apps <span class="d">(2022)</span>\n<span class="d">Java · Networking</span>') + '\n' +
      '<span class="d">Ask “how does the AI D&amp;D referee work?” for a deeper dive.</span>',
    '/interests':
      '<span class="h">Off the clock</span>' +
      kv('<span class="h">football</span>', 'watches a lot of it · big Messi fan · follows Barça') +
      kv('<span class="h">video games</span>', 'FIFA, Split Fiction, GTA, Watch Dogs, and more') + '\n' +
      '<span class="d">Barça\'s latest: /latest · fancy a shootout? /penalty</span>',
    '/contact':
      'linkedin  <a href="https://linkedin.com/in/parth-thakkar-10" target="_blank" rel="noopener">linkedin.com/in/parth-thakkar-10</a>\n' +
      'github    <a href="https://github.com/parththakkar106" target="_blank" rel="noopener">github.com/parththakkar106</a>\n' +
      'email     <a href="mailto:thakkarparth106@gmail.com">thakkarparth106@gmail.com</a>',
    '/help': null,
    '/contributions': null
  };

  function helpText() {
    return COMMANDS.map(function (c) { return kv('<span class="h">' + c[0] + '</span>', '<span class="d">' + c[1] + '</span>'); }).join('') +
      '\n<span class="d">Anything else you type goes to the model, which only answers from notes about Parth and his projects.</span>';
  }

  // scripted "LLM" answers for the mock
  var ASK = [
    { k: /workflow|how does he (work|build)|claude code|his process|tools does he/i,
      reads: ['about/how-i-work.md'],
      a: 'Mostly Python, mostly in <span class="h">Claude Code</span>. His loop: start with an idea, have the AI critique it and poke holes, and make sure he understands each one (that is usually where he learns something). Then the AI drafts a plan, he reviews it, the AI executes, and he reviews the merge request before shipping.' },
    { k: /terminal|theme|matrix|turbo|this site look|why.*(green|look)/i,
      reads: ['about/this-site.md'],
      a: 'Parth started coding in <span class="h">Turbo C++</span> as a kid and always loved that terminal screen. This site mixes that Matrix-style look with Claude Code\'s text-first layout, which he uses every day.' },
    { k: /grew up|hometown|where is he|where does he|where.*from|ahmedabad|bangalore|bengaluru|atlanta|pilani/i,
      reads: ['about/me.md'],
      a: 'Parth grew up in <span class="h">Ahmedabad</span>, India, studied at BITS Pilani in a small town in Rajasthan, and has worked in Bangalore and Atlanta.' },
    { k: /learning|building now|working on now|currently|next|rag|retriev/i,
      reads: ['about/now.md'],
      a: 'No brand-new project right now: Parth is still polishing <a href="https://showdown.parth.party/" target="_blank" rel="noopener">Showdown</a>. On the learning side he is going deeper on <span class="h">RAG</span>, especially better ways to retrieve the right data.' },
    { k: /goldman|gs|work|job|langgraph|agent|optimi/i,
      reads: ['about/me.md', 'work/goldman.md'],
      a: 'At Goldman Sachs Parth works on two main systems.\n\n' +
         '1. The <span class="h">Liability Optimizer</span>: a Python optimization engine that plans how the firm funds itself. Its output feeds liquidity buffer decisions, and he made repeat runs fast with warm starts and state reuse.\n\n' +
         '2. The <span class="h">AI Funding Planning Assistant</span>: a ReAct agent built with LangGraph and Pydantic. It explains what drives the weekly funding plan and edits it through a human-in-the-loop commit path.\n\n' +
         '<span class="d">Want the infra side (Kubernetes, Redis caching)? Ask away, or run /work.</span>' },
    { k: /showdown|trivia|quiz|websocket/i,
      reads: ['projects/showdown.md'],
      a: 'As a kid Parth loved QuizUp, a 1v1 quiz app, and was number one in the world in a few topics, Percy Jackson included. It shut down and nothing replaced it, so he built his own, which also lets friends in different cities play together.\n\nShowdown is a real-time 1v1 trivia game at <a href="https://showdown.parth.party/" target="_blank" rel="noopener">showdown.parth.party</a>. Both players get the same question on the same 15-second clock.\n\nOne FastAPI process owns every live room; each room runs its timers as asyncio tasks over a WebSocket. Postgres (Neon) is read once at startup and written when a match ends, so play never waits on the database.' },
    { k: /d&d|dnd|dungeon|story|referee/i,
      reads: ['projects/ai-dnd.md', 'projects/ai-dnd/GUIDE.md'],
      a: 'AI D&amp;D is an AI Dungeon-style storytelling app that runs on any OpenAI-compatible model. Parth sees an AI-driven game engine as the next step after deterministic games: an open world with guardrails so the AI doesn\'t go haywire.\n\nThe interesting part is the <span class="h">world-state referee</span>: each turn the model proposes changes to the world, and a Python engine decides which ones actually stick. Stories are a tree, so any turn can hold several takes and you can branch from any of them. Built with FastAPI and React.\n\n<a href="https://dnd.parth.party/" target="_blank" rel="noopener">Play the demo</a>' },
    { k: /fun|hobb|interest|football|soccer|messi|game|fifa|gta/i,
      reads: ['about/interests.md'],
      a: 'Outside work Parth watches a lot of football and is a big <span class="h">Messi</span> fan. He also plays video games: FIFA, Split Fiction, GTA, Watch Dogs and more.\n\n<span class="d">Run /penalty to take a few spot kicks yourself.</span>' },
    { k: /contact|reach|email|talk|chat|connect|linkedin/i,
      reads: ['about/contact.md'],
      a: 'Parth is always happy to talk about his work. Reach him on <a href="https://linkedin.com/in/parth-thakkar-10" target="_blank" rel="noopener">LinkedIn</a> or at <a href="mailto:thakkarparth106@gmail.com">thakkarparth106@gmail.com</a>; his code is on <a href="https://github.com/parththakkar106" target="_blank" rel="noopener">GitHub</a>.' }
  ];
  var OFFTOPIC = /weather|recipe|poem|joke|stock price|bitcoin|write me|code for|translate/i;

  function addUser(text) { log.appendChild(el('u', esc(text))); }

  function runSlash(cmd) {
    var b = el('block', '');
    if (cmd === '/clear') { [].slice.call(log.querySelectorAll('.u, .block')).forEach(function (n) { n.remove(); }); history = []; return; }
    if (cmd === '/plain') { setView('plain'); return; }
    if (cmd === '/penalty' || cmd === '/football') { penalty(); return; }
    // the chat model sees which commands ran (and their text) so follow-up questions make sense;
    // for /latest it fetches the live matches itself
    if (cmd === '/latest' || cmd === '/barca' || cmd === '/messi') { latest(b); log.appendChild(b); remember(cmd, 'Showed the live Barça and Messi matches (/latest).'); return; }
    if (cmd === '/help') b.appendChild(el('out', helpText()));
    else if (cmd === '/contributions') {
      b.appendChild(el('out', '<a class="h" href="https://github.com/parththakkar106" target="_blank" rel="noopener">github.com/parththakkar106</a> <span class="d">· ' + total.toLocaleString() + ' contributions ' + rangeText() + ' · includes private repos</span>'));
      var h = el('heat', '<pre>' + asciiHeat() + '</pre>'); b.appendChild(h);
      b.appendChild(el('out', '<span class="d">less </span><span class="h0">■</span><span class="h1">■</span><span class="h2">■</span><span class="h3">■</span><span class="h4">■</span><span class="d"> more</span>'));
    }
    else if (OUT.hasOwnProperty(cmd)) b.appendChild(el('out', OUT[cmd]));
    else b.appendChild(el('dot err', 'Unknown command ' + esc(cmd) + '. Try /help.'));
    log.appendChild(b);
    if (cmd === '/contributions') remember(cmd, 'Showed Parth\'s GitHub contributions heatmap.');
    else if (OUT.hasOwnProperty(cmd)) remember(cmd, b.textContent.trim());
  }

  var GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽'];
  var VERBS = ['Thinking', 'Reading notes', 'Pondering', 'Recalling'];
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- live model via /api/chat, scripted answers when it is off ---------- */
  var history = [];
  function remember(cmd, text) { history.push({ role: 'user', content: cmd }, { role: 'assistant', content: text.slice(0, 1000) }); }
  var TZ = ''; try { TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var modelTag = document.getElementById('modelTag');
  var modelLive = false;
  fetch('api/chat', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : { live: false }; })
    .catch(function () { return { live: false }; })
    .then(function (d) {
      modelLive = !!d.live;
      modelTag.innerHTML = d.live ? 'model: live via OpenRouter' : '<span class="demo-pill">DEMO</span> scripted answers<span class="soon"> · live AI coming soon</span>';
    });

  // Resolves to a streaming Response, or null when the live model is off or unreachable.
  function callModel(q) {
    var msgs = history.concat([{ role: 'user', content: q }]).slice(-12);
    return fetch('api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs, tz: TZ }) })
      .then(function (r) { return r.ok && r.body && /text\/plain/.test(r.headers.get('content-type') || '') ? r : null; })
      .catch(function () { return null; });
  }
  // The model asks to run a site command by ending its answer with [run:/projects]; hide that while it streams.
  // Only when the visitor asked to see, open or play something; the model is keen to run commands otherwise.
  var WANTS = /\b(show|see|open|view|display|play|launch|start|switch|go to|take me|bring up|pull up|let me|can i|i want|i'd like|run)\b/i;
  var RUNNABLE = ['/about', '/work', '/projects', '/interests', '/latest', '/contributions', '/contact', '/penalty', '/plain'];
  function stripRun(text) { return text.replace(/\s*\[run:[^\]\n]*\]?[^\n]*/gi, '').replace(/\s*\[(r(u(n)?)?)?$/i, ''); }
  function fmt(text) {
    return esc(stripRun(text)).replace(/\*\*([^*]+)\*\*/g, '<span class="h">$1</span>')
      .replace(/\[([^\]\n]+)\]\((https:\/\/[^)\s"]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/`([^`]+)`/g, '<span class="bl">$1</span>');
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
    var runAfter = null;
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
    var reads = hit ? hit.reads : (off ? [] : ['about/me.md']);
    reads.forEach(function (f) {
      var line;
      chain = chain.then(function () {
        line = el('dot tool reading', '<b>Read</b><span>(' + f + ')</span>');
        b.insertBefore(line, spin);
        return wait(650);
      }).then(function () {
        line.classList.remove('reading');
        b.insertBefore(el('res', 'Read ' + (20 + Math.floor(Math.random() * 60)) + ' lines'), spin);
        return wait(250);
      });
    });
    chain.then(function () { return live; }).then(function (res) {
      clearInterval(timer); spin.remove();
      // tools the server ran for this answer (functions/api/_tools.js), e.g. /latest for a question about Barça
      if (res) (res.headers.get('X-Tools') || '').split(',').forEach(function (t) {
        var repo = t.indexOf('readme:') === 0 && t.slice(7);
        var show = t === 'latest' ? ['Run', '/latest', 'Fetched Barça and Messi\'s matches from ESPN']
          : t === 'table' ? ['Fetch', 'La Liga table', 'Fetched the standings from ESPN']
          : t === 'live' ? ['Fetch', 'live match', 'Fetched the goals so far']
          : t === 'github' ? ['Fetch', 'github.com/parththakkar106', 'Fetched recent commits']
          : repo ? ['Read', repo + '/README.md', 'Read it from GitHub'] : null;
        if (!show) return;
        b.appendChild(el('dot tool', '<b>' + show[0] + '</b><span>(' + esc(show[1]) + ')</span>'));
        b.appendChild(el('res', esc(show[2])));
      });
      var d = el('dot', ''); b.appendChild(d);
      if (res) {
        return streamResponse(d, res).then(function (answer) {
          var m = answer.match(/\[run:\s*(\/[a-z]+)/i), cmd = m && m[1].toLowerCase();
          answer = stripRun(answer).trim();
          follow(function () { d.innerHTML = fmt(answer); });
          history.push({ role: 'user', content: q }, { role: 'assistant', content: answer });
          if (cmd && RUNNABLE.indexOf(cmd) !== -1 && WANTS.test(q)) runAfter = cmd;
        }, function () {
          d.className = 'dot err'; d.textContent = 'The answer got cut off. Try asking again.';
        });
      }
      var text = hit ? hit.a
        : off ? 'I only answer questions about Parth and his work. Try /projects, or ask what he built at Goldman.'
        : 'I don\'t have a note on that. Here is the short version of Parth: software engineer, Quant Analyst at Goldman Sachs building optimizers and LLM agents, and builder of AI D&amp;D and Showdown on the side. Try /projects or /work.';
      return stream(d, text).then(function () {
        b.appendChild(el('demo', '<span class="demo-pill">DEMO</span> scripted answer · ' + (modelLive ? 'the live AI is busy right now, try again in a minute' : 'the live AI model is not connected yet')));
      });
    }).then(function () {
      busy = false;
      // the model asked to run a command for the visitor: run it as if they had typed it
      if (runAfter) { b.appendChild(el('dot tool', '<b>Run</b><span>(' + runAfter + ')</span>')); runSlash(runAfter); scroll(); }
      if (!busy) focusInput();
    });
  }


  /* ---------- /latest: Barça and Messi's matches from /api/football (ESPN, cached at the edge) ---------- */
  var fbReq = null;
  function football() {
    if (!fbReq) fbReq = fetch('api/football').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    fbReq.catch(function () { fbReq = null; }); // a failed fetch can be retried by the next /latest
    return fbReq;
  }
  // Draws this visitor's last copy straight away (if any), then again once fresh data arrives.
  function fbLoad(draw, fail) {
    var old = null;
    try { old = JSON.parse(localStorage.getItem('pp-football')); } catch (e) {}
    if (old && old.barca) draw(old); else old = null;
    football().then(function (d) {
      try { localStorage.setItem('pp-football', JSON.stringify(d)); } catch (e) {}
      draw(d);
    }, function () { if (!old) fail(); });
  }
  function fbDay(iso) { return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); }
  function fbTime(iso) { return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
  function fbIn(iso) {
    var a = new Date(iso), n = new Date();
    var days = Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
    return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
  }
  // Score from our side, e.g. "3–1" or "2–2 (2–3 pens)".
  function fbScore(m) {
    var us = m.atHome ? m.home : m.away, them = m.atHome ? m.away : m.home;
    return us.score + '–' + them.score + (us.pens != null && them.pens != null ? ' (' + us.pens + '–' + them.pens + ' pens)' : '');
  }
  // "vs Getafe" for Barça; Messi's lines name the team too: "Argentina vs Bolivia", "Inter Miami at Columbus".
  function fbVs(m, named) { return (named ? esc(String(m.team)) + ' ' : '') + (m.atHome ? 'vs ' : 'at ') + esc(String(m.opponent)); }
  // [tag, headline, detail, result] for the live, last and next match of one feed
  var CREST = { 'Argentina': 'argentina', 'Inter Miami': 'inter-miami', 'Inter Miami CF': 'inter-miami' };
  function fbLines(f, named) {
    if (!f) return [];
    var out = [];
    if (f.live) out.push(['live', fbScore(f.live) + ' ' + fbVs(f.live, named), esc(f.live.detail || '') + ' · ' + esc(f.live.comp), null, f.live.link, CREST[f.live.team]]);
    if (f.last) out.push(['last', fbScore(f.last) + ' ' + fbVs(f.last, named), esc(f.last.comp) + ' · ' + fbDay(f.last.date), f.last.result, f.last.link, CREST[f.last.team]]);
    if (f.next && !f.live) out.push(['next', fbVs(f.next, named), esc(f.next.comp) + ' · ' + fbDay(f.next.date) + ', ' + fbTime(f.next.date) + ' · ' + fbIn(f.next.date), null, null, CREST[f.next.team]]);
    return out;
  }

  function latest(b) {
    var out = el('out', '<span class="d">Fetching the fixtures…</span>'); b.appendChild(out);
    fbLoad(function (d) {
      var rcls = { W: 'g', L: 'pk-miss', D: 'd' };
      function rows(lines) {
        return lines.length ? lines.map(function (l) {
          var k = l[0] === 'live' ? '<span class="pk-miss">live</span>' : '<span class="d">' + l[0] + '</span>';
          return '\n  ' + k + '  ' + (l[3] ? '<span class="' + rcls[l[3]] + '">' + l[3] + '</span> ' : '') + l[1] + ' <span class="d">· ' + l[2] + '</span>';
        }).join('') : '\n  <span class="d">Nothing scheduled right now.</span>';
      }
      var html = '<span class="h">Barça</span>' + (d.barca.standing ? ' <span class="d">· ' + esc(d.barca.standing) + '</span>' : '') + rows(fbLines(d.barca)) + '\n\n' +
        '<span class="h">Messi</span> <span class="d">· Inter Miami &amp; Argentina</span>' + (d.messi ? rows(fbLines(d.messi, true)) : '\n  <span class="d">Feed unavailable right now.</span>') + '\n\n' +
        '<span class="d">Live from ESPN · times in your timezone</span>';
      follow(function () { out.innerHTML = html; });
    }, function () {
      out.className = 'dot err'; out.textContent = 'Couldn\'t reach the match feed right now. Try /latest again in a bit.';
    });
  }

  // plain view cards
  (function () {
    var bl = document.getElementById('fbBarca'), ml = document.getElementById('fbMessi');
    if (!bl) return;
    function fill(ul, f, named) {
      var lines = fbLines(f, named);
      ul.innerHTML = !f ? '<li class="fb-msg">Feed unavailable right now.</li>' : !lines.length ? '<li class="fb-msg">Nothing scheduled right now.</li>' : lines.map(function (l) {
        var crest = named && l[5] ? '<img class="fb-crest" src="assets/img/crests/' + l[5] + '.png" alt="">' : '';
        var head = (l[3] ? '<span class="r ' + l[3] + '">' + l[3] + '</span>' : '') + crest + l[1];
        return '<li><span class="tag ' + l[0] + '">' + l[0] + '</span><span><b>' + (l[4] ? '<a href="' + esc(l[4]) + '" target="_blank" rel="noopener">' + head + '</a>' : head) + '</b><small>' + l[2] + '</small></span></li>';
      }).join('');
    }
    fbLoad(function (d) {
      if (d.barca.standing) document.getElementById('fbStand').textContent = d.barca.standing;
      fill(bl, d.barca); fill(ml, d.messi, true);
    }, function () { fill(bl, null); fill(ml, null); });
  })();

  /* ---------- /penalty: a shootout against the CPU, drawn as a small SVG pitch ---------- */
  // Each round you take a kick, then go in goal for the CPU's kick. Best of five, then sudden death.
  // Board is a 320×170 SVG. Goal mouth runs x 40–280 between the crossbar (y 30) and the goal line (y 110).
  var KICKS = 5, MAX_ROUNDS = 10, AIMX = [86, 160, 234], SIDE = ['left', 'the middle', 'right'], SHOT = ['left', 'down the middle', 'right'];
  // Your power is 0–1 along the bar: weak → always saved, good → keeper guesses, top corner → unstoppable, over → misses.
  var P_WEAK = .35, P_GOOD = .75, P_TOP = .86;
  // The CPU kicker's run-up. Dive in the last stretch of it (the green window): earlier and the kicker
  // sees you go and shoots the other way, later and you're still standing in the middle.
  var RUNUP = 2000, WINDOW = .74;
  function zoneOf(v) { return v < P_WEAK ? 0 : v < P_GOOD ? 1 : v < P_TOP ? 2 : 3; }
  var pen = null, penEndedAt = 0;

  function boardSvg() {
    var net = '';
    for (var x = 52; x < 280; x += 12) net += '<line x1="' + x + '" y1="31" x2="' + x + '" y2="110"/>';
    for (var y = 42; y < 110; y += 12) net += '<line x1="41" y1="' + y + '" x2="279" y2="' + y + '"/>';
    var fig = '<circle cx="0" cy="-50" r="5.5"/><path d="M0 -44 V-22 M-15 -56 L0 -40 L15 -56 M0 -22 L-9 0 M0 -22 L9 0"/>';
    return '<svg viewBox="0 0 320 178" role="img" aria-label="Penalty: goal, keeper and ball">' +
      '<g class="pk-net">' + net + '</g>' +
      '<path class="pk-line" d="M0 110 H320 M110 110 L96 166 M210 110 L224 166"/>' +
      '<path class="pk-frame" d="M40 110 V30 H280 V110"/>' +
      '<circle class="pk-spot" cx="160" cy="150" r="2"/>' +
      '<g class="pk-aim"><circle r="9"/><path d="M-14 0 H-5 M5 0 H14 M0 -14 V-5 M0 5 V14"/></g>' +
      '<g class="pk-kp">' + fig + '</g>' +
      '<g class="pk-kicker"><circle cx="0" cy="-42" r="4.5"/><path d="M0 -37 V-18 M0 -32 L-10 -24 M0 -32 L10 -24 M0 -18 L-7 0 M0 -18 L7 0"/></g>' +
      '<circle class="pk-ball" r="6"/>' +
      '<text class="pk-big" x="160" y="22" text-anchor="middle"></text>' +
      '</svg>';
  }

  function penalty() {
    var b = el('block pk', ''); log.appendChild(b);
    var board = el('out pk-board',
      '<div class="pk-banner"><b></b><span></span></div>' + boardSvg() +
      '<div class="pk-bar" aria-hidden="true"><i class="z0"></i><i class="z1"></i><i class="z2"></i><i class="z3"></i><b></b><em></em><u></u></div>' +
      '<div class="pk-score"></div>');
    var msg = el('out pk-msg', ''), ctl = el('pk-ctl', '');
    ctl.innerHTML = '<button type="button" data-a="0"></button><button type="button" data-a="1"></button><button type="button" data-a="2"></button><button type="button" class="shoot" data-a="s">SHOOT</button><button type="button" class="quit" data-a="q">esc</button>';
    var hint = el('out pk-hint d', '');
    [board, msg, ctl, hint].forEach(function (n) { b.appendChild(n); });
    var q = function (s) { return board.querySelector(s); };
    pen = { b: b, board: board, msg: msg, ctl: ctl, hint: hint, aimG: q('.pk-aim'), kp: q('.pk-kp'), kicker: q('.pk-kicker'), ball: q('.pk-ball'),
            net: q('.pk-net'), big: q('.pk-big'), bar: q('.pk-bar'), needle: q('.pk-bar b'), clock: q('.pk-bar em'),
            bannerB: q('.pk-banner b'), bannerS: q('.pk-banner span'), score: q('.pk-score'),
            round: 0, me: [], cpu: [], phase: '', aim: 1, dive: null, t0: 0, raf: 0 };
    busy = true; input.disabled = true; input.blur(); input.placeholder = 'playing /penalty · esc to quit';
    // pointerdown, not click: aiming, shooting and diving register the instant the finger or button goes down
    ctl.addEventListener('pointerdown', function (e) {
      var t = e.target.closest('button'); if (!t || t.dataset.a === 'q') return;
      e.preventDefault(); act(t.dataset.a);
    });
    // Quitting waits for the full click, so the tap can't land on whatever appears underneath once the game closes.
    ctl.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.a === 'q') { e.preventDefault(); endPen(true); }
      else if (e.detail === 0) act(t.dataset.a); // keyboard-activated buttons
    });
    document.body.classList.add('pk-on');
    pen.raf = requestAnimationFrame(tick);
    startShoot();
    window.scrollTo(0, document.documentElement.scrollHeight);
  }

  function act(a) {
    if (a === 's') shoot();
    else if (pen.phase === 'aim') setAim(+a);
    else if (pen.phase === 'save') dive(+a);
  }

  function place(node, x, y, extra) { node.setAttribute('transform', 'translate(' + x + ' ' + y + ')' + (extra || '')); }
  function tween(ms, step, done) {
    var s = performance.now();
    (function f(now) {
      if (!pen) return;
      var t = Math.min(1, (now - s) / ms); step(t);
      if (t < 1) requestAnimationFrame(f); else if (done) done();
    })(s);
  }
  function setButtons(labels, shootOn, hint) {
    var bs = pen.ctl.querySelectorAll('button');
    for (var i = 0; i < 3; i++) bs[i].textContent = labels[i];
    bs[3].style.visibility = shootOn ? '' : 'hidden'; // keeps its space, so the layout never shifts
    pen.ctl.classList.toggle('noshoot', !shootOn);
    pen.hint.textContent = hint;
  }
  function banner(who, what, mine) {
    pen.bannerB.textContent = who; pen.bannerS.textContent = what;
    pen.board.classList.toggle('saving', !mine);
  }
  function resetPitch() {
    pen.net.classList.remove('hit');
    pen.big.textContent = ''; pen.big.setAttribute('class', 'pk-big');
    place(pen.kp, 160, 110); place(pen.ball, 160, 150); pen.ball.setAttribute('r', 6); pen.ball.style.opacity = 1;
    pen.bar.classList.remove('locked', 'live');
    pen.msg.innerHTML = '';
    drawScore();
  }

  /* --- your kick --- */
  // One full sweep up and back takes this long; a touch quicker each round, never frantic.
  function period() { return Math.max(1800, 2600 - pen.round * 150); }
  function powerAt(t) { var x = ((t - pen.t0) % period()) / period(); return x < .5 ? x * 2 : 2 - x * 2; }

  function startShoot() {
    pen.phase = 'aim'; pen.aim = 1; pen.t0 = performance.now();
    resetPitch();
    pen.kicker.style.display = 'none'; pen.aimG.style.display = '';
    pen.bar.classList.remove('clock');
    banner(roundName() + ' · YOU SHOOT', '', true);
    setButtons(['◀ left', '▲ middle', 'right ▶'], true, '←/↑/→ or 1/2/3 to aim · space to shoot · esc to quit');
    setAim(1);
  }
  function setAim(a) { if (pen && pen.phase === 'aim') { pen.aim = a; place(pen.aimG, AIMX[a], 44); } }

  function shoot() {
    if (!pen || pen.phase !== 'aim') return;
    // lock power at the exact moment of the press, not at the last drawn frame
    var v = powerAt(performance.now());
    pen.phase = 'fly';
    pen.needle.style.left = (v * 100) + '%';
    pen.bar.classList.add('locked');
    pen.aimG.style.display = 'none';
    var z = zoneOf(v), aim = pen.aim, guess = Math.floor(Math.random() * 3), goal, line;
    if (z === 0) { goal = false; guess = aim; line = 'Too soft. The keeper just collects it.'; }
    else if (z === 3) { goal = false; line = 'Over the bar. Into row Z.'; }
    else if (z === 2) { goal = true; line = aim === 1 ? 'Smashed into the roof of the net, over the keeper.' : guess === aim ? 'Top corner! The keeper got a glove on it and it still went in.' : 'Top bins, no chance.'; }
    else if (guess === aim) { goal = false; line = 'You went ' + SHOT[aim] + ' and the keeper ' + (aim === 1 ? 'stayed put.' : 'guessed right.'); }
    else { goal = true; line = 'You went ' + SHOT[aim] + ', the keeper ' + (guess === 1 ? 'stayed in the middle.' : 'dived ' + SIDE[guess] + '.'); }
    kick(aim, z, guess, false, function () {
      pen.me.push(goal);
      verdict(goal ? 'GOAL!' : z === 3 ? 'OVER THE BAR' : 'SAVED', goal, line);
      next(startSave);
    }, goal);
  }

  /* --- the CPU's kick: you are the keeper --- */
  function startSave() {
    pen.phase = 'save'; pen.dive = null; pen.early = false; pen.t0 = performance.now();
    resetPitch();
    pen.aimG.style.display = 'none'; pen.kicker.style.display = ''; pen.kicker.style.opacity = 1;
    pen.bar.classList.add('clock');
    banner(roundName() + ' · YOU SAVE', '', false);
    setButtons(['◀ dive left', '▲ stay', 'dive right ▶'], false, '←/↑/→ or 1/2/3 to dive · esc to quit');
  }

  function dive(z) {
    if (!pen || pen.phase !== 'save' || pen.dive !== null) return;
    pen.dive = z;
    pen.early = (performance.now() - pen.t0) / RUNUP < WINDOW;
    tween(260, function (t) { keeperPose(z, 1 - Math.pow(1 - t, 2), false); });
  }

  function cpuKick() {
    pen.phase = 'fly';
    var d = pen.dive === null ? 1 : pen.dive, stayed = pen.dive === null;
    var first = pen.cpu.length === 0, aim, z, r = Math.random();
    if (first) { aim = 1; z = 1; } // the first kick always goes down the middle, so a new player sees how a save works
    else if (pen.early) { aim = d === 1 ? (r < .5 ? 0 : 2) : 2 - d; z = 1; } // they saw you commit
    else { aim = Math.floor(Math.random() * 3); z = r < .1 ? 3 : r < .2 ? 2 : 1; }
    var saved = z === 1 && d === aim, line;
    pen.kicker.style.opacity = .35;
    if (pen.early && !first) line = d === 1 ? 'You planted yourself in the middle too early, so they picked a corner.' : 'Too early! They saw you go ' + SIDE[d] + ' and put it ' + SHOT[aim] + '.';
    else if (first && saved) line = 'Down the middle, and you stayed put. From now on, dive when the bar turns green.';
    else if (z === 3) line = 'They blazed it over the bar. Lucky.';
    else if (z === 2) line = aim === 1 ? 'Chipped over your head into the roof of the net.' : 'Top corner, nothing you could do.';
    else if (saved) line = (aim === 1 ? 'You stayed in the middle and it came straight at you.' : 'You dived ' + SIDE[d] + ' and so did they.');
    else line = (stayed ? 'You didn\'t move in time, ' : d === 1 ? 'You stayed in the middle, ' : 'You dived ' + SIDE[d] + ', ') + 'they went ' + SHOT[aim] + '.';
    kick(aim, z, d, true, function () {
      var goal = !saved && z !== 3;
      pen.cpu.push(goal);
      verdict(goal ? 'CPU SCORES' : saved ? 'SAVED!' : 'OVER THE BAR', !goal, line);
      next(function () { pen.round++; startShoot(); });
    }, !saved && z !== 3);
  }

  /* --- shared animation and flow --- */
  // Keeper pose: zone 0/1/2 and progress 0–1 (0 = standing in the middle, 1 = full dive or jump).
  function keeperPose(z, p, airborne) {
    var kx = z === 1 ? 160 : AIMX[z] + (z === 0 ? 14 : -14), rot = z === 0 ? -72 : z === 2 ? 72 : 0;
    place(pen.kp, 160 + (kx - 160) * p, 110 - (z === 1 && airborne ? 10 * Math.sin(Math.PI * p) : 0) - (z !== 1 ? 6 * p : 0), ' rotate(' + (rot * p).toFixed(1) + ')');
  }

  function kick(aim, z, guess, cpuKeeperIsYou, done, goal) {
    var bx = AIMX[aim], by = z === 3 ? 8 : z === 2 ? 42 : 82;
    if (!goal && z !== 3) by = guess === 1 ? 72 : 88; // into the keeper's hands
    var dived = cpuKeeperIsYou && pen.dive !== null;
    tween(520, function (t) {
      var e = 1 - Math.pow(1 - t, 3);
      place(pen.ball, 160 + (bx - 160) * e, 150 + (by - 150) * e - Math.sin(Math.PI * e) * (z === 3 ? 30 : 14));
      pen.ball.setAttribute('r', (6 - 2 * e).toFixed(2));
      if (z === 3 && t > .85) pen.ball.style.opacity = (1 - t) / .15;
      if (!dived && !(cpuKeeperIsYou && guess === 1)) { // the CPU keeper reacts as the ball leaves; you already moved (or froze)
        var k = Math.max(0, Math.min(1, (t - .12) / .7));
        keeperPose(guess, 1 - Math.pow(1 - k, 2), true);
      }
    }, done);
  }

  function verdict(word, good, line) {
    pen.big.textContent = word;
    pen.big.setAttribute('class', 'pk-big ' + (good ? 'good' : 'bad'));
    if (word.indexOf('GOAL') === 0 || word === 'CPU SCORES') pen.net.classList.add('hit');
    pen.net.classList.toggle('bad', !good);
    follow(function () { pen.msg.innerHTML = '<span class="' + (good ? 'h' : 'pk-miss') + '">' + esc(line) + '</span>'; drawScore(); });
  }

  function next(fn) { setTimeout(function () { if (!pen) return; if (decided()) endPen(false); else fn(); }, 1700); }

  function sum(a) { return a.filter(Boolean).length; }
  function decided() {
    var m = sum(pen.me), c = sum(pen.cpu), nm = pen.me.length, nc = pen.cpu.length;
    if (nm <= KICKS && nc <= KICKS) {
      if (m > c + (KICKS - nc) || c > m + (KICKS - nm)) return true;
      return nm === KICKS && nc === KICKS && m !== c;
    }
    return nm === nc && (m !== c || nm >= MAX_ROUNDS);
  }
  function roundName() { return pen.round < KICKS ? 'ROUND ' + (pen.round + 1) : 'SUDDEN DEATH'; }

  function tick(t) {
    if (!pen) return;
    pen.raf = requestAnimationFrame(tick);
    pen.board.dataset.phase = pen.phase;
    if (pen.phase === 'aim') pen.needle.style.left = (powerAt(t) * 100) + '%';
    else if (pen.phase === 'save') {
      var k = Math.min(1, (t - pen.t0) / RUNUP);
      pen.clock.style.width = (k * 100) + '%';
      pen.bar.classList.toggle('live', k >= WINDOW);
      place(pen.kicker, 150 + 6 * k, 176 - 22 * k); // the kicker runs up to the ball
      if (k >= 1) cpuKick();
    }
  }

  function drawScore(p) {
    p = p || pen;
    // colour by what is good for you: your goals and the CPU's misses are green, the rest red
    var n = Math.max(KICKS, p.me.length, p.cpu.length), row = function (name, res, mine) {
      var out = [];
      for (var i = 0; i < n; i++) out.push(i < res.length ? (res[i] ? '<span class="' + (mine ? 'h' : 'pk-miss') + '">●</span>' : '<span class="' + (mine ? 'pk-miss' : 'h') + '">✕</span>') : '<span class="pk-dim">○</span>');
      return '<span class="d">' + name + '</span> ' + out.join(' ') + '  <b>' + sum(res) + '</b>';
    };
    p.score.innerHTML = row('you', p.me, true) + '\n' + row('cpu', p.cpu, false);
  }

  // Full-time art: a trophy with twinkling stars for a win, a sad face with falling rain for a loss.
  var PEN_ART = {
    win: [
      ['  *   .   *   .   *', '  .   *   .   *   .'],
      '    .-=========-.\n' +
      '    |  WINNER!  |\n' +
      '   (|   {{S}}   |)\n' +
      "    '.         .'\n" +
      "      '-.___.-'\n" +
      '        _|_|_\n' +
      '       [_____]'
    ],
    lose: [
      ["   '   ,   '   ,", "   ,   '   ,   '"],
      '      .-----.\n' +
      '     /  x x  \\\n' +
      '    |    ^    |\n' +
      "     \\ .---. /\n" +
      "      '-----'\n" +
      '   CPU wins {{S}}'
    ],
    draw: [['', ''], '   \\_(o_o)_/\n   level {{S}}']
  };
  function penArt(node, kind, score) {
    if (kind === 'win') while (score.length < 5) score = score.length % 2 ? ' ' + score : score + ' '; // keep the trophy's sides lined up
    var a = PEN_ART[kind], body = esc(a[1].replace('{{S}}', score)), i = 0;
    (function frame() {
      node.innerHTML = '<span class="' + (kind === 'win' ? 'h' : 'pk-miss') + '">' + esc(a[0][i % 2]) + '</span>\n' + body;
      if (++i < 12 && node.isConnected) setTimeout(frame, 280);
    })();
  }

  function endPen(quit) {
    if (!pen) return;
    var p = pen; pen = null; penEndedAt = Date.now();
    cancelAnimationFrame(p.raf);
    p.ctl.remove(); p.hint.remove();
    var m = sum(p.me), c = sum(p.cpu), wins = 0;
    drawScore(p);
    if (!quit && m > c) {
      try { wins = (+localStorage.getItem('pp-pen-wins') || 0) + 1; localStorage.setItem('pp-pen-wins', wins); } catch (e) { wins = 1; }
    }
    p.bannerB.textContent = (quit ? 'ABANDONED' : 'FULL TIME') + ' · ' + m + '–' + c;
    var text = quit ? 'Shootout abandoned at ' + m + '–' + c + '.'
      : m > c ? (p.me.every(Boolean) ? 'You win ' + m + '–' + c + ' without missing. Messi would be proud.' : 'You win ' + m + '–' + c + '.')
      : c > m ? 'The CPU wins ' + c + '–' + m + '.'
      : 'Still level at ' + m + '–' + c + ' after ' + MAX_ROUNDS + ' rounds. Call it a draw.';
    if (!quit) { var art = el('out pk-art', ''); p.b.insertBefore(art, p.msg); penArt(art, m > c ? 'win' : c > m ? 'lose' : 'draw', m > c ? m + '-' + c : c + '-' + m); }
    p.msg.innerHTML = '<span class="' + (!quit && c > m ? 'pk-miss' : 'h') + '">' + text + '</span>' + (wins ? '  <span class="d">shootouts won: ' + wins + '</span>' : '') +
      '\n<span class="d">Run /penalty for a rematch.</span>';
    busy = false; input.disabled = false; input.placeholder = 'Ask anything, or type /help';
    document.body.classList.remove('pk-on');
    focusInput(); window.scrollTo(0, document.documentElement.scrollHeight);
  }

  document.addEventListener('keydown', function (e) {
    if (!pen || term.hidden || e.repeat) return;
    var k = e.key, a = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, '1': 0, '2': 1, '3': 2 }[k];
    if (a !== undefined) act(String(a));
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
    if (Date.now() - penEndedAt < 700) return; // a tap that just closed the shootout, not a new command
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

  /* ---------- plain view: card art animates the first time it scrolls into view ---------- */
  if ('IntersectionObserver' in window && !calm) {
    var count = function (b) {
      var to = +b.dataset.to, t0 = performance.now(), ms = b.closest('.slow') ? 2000 : 900;
      b._t0 = t0;
      (function f(now) {
        if (b._t0 !== t0) return; // a newer replay took over
        var t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3);
        b.textContent = Math.round(to * e).toLocaleString('en-US');
        if (t < 1) requestAnimationFrame(f);
      })(t0);
    };
    // play when half visible; reset only once fully off the bottom of the screen, so it replays when scrolled
    // down to again but stays finished when scrolled back up to (and small scrolls never restart it)
    var artIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var n = e.target;
        if (e.intersectionRatio >= 0.5 && !n.classList.contains('play')) {
          n.classList.add('play');
          [].forEach.call(n.querySelectorAll('[data-to]'), count);
        } else if (!e.isIntersecting && e.boundingClientRect.top > 0 && n.classList.contains('play')) {
          n.classList.remove('play');
        }
      });
    }, { threshold: [0, 0.5] });
    [].forEach.call(plain.querySelectorAll('[data-anim]'), function (n) { n.classList.add('arm'); artIo.observe(n); });
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
})();
