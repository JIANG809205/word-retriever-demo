/* ===========================================================
   拾字狗 — 五幕调度
   一幕一屏，幕间靠「幕布落下再升起」切换；狗每幕换一个姿态。
   =========================================================== */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────── 每一幕的配置 ───────── */
  const ACTS = [
    { label: '序幕',    dog: 'beagle', cx: 0,    cy: 0,   r: 0,  s: 1.00, warm: 0.00, top: false },
    { label: 'Act I',  dog: 'corgi',  cx: 26,  cy: 34,  r: -2, s: 0.48, warm: 0.15, top: true  },
    { label: 'Act II', dog: 'fluff',  cx: 0,   cy: 118, r: 3,  s: 0.52, warm: 0.45, top: true  },
    { label: 'Act III',dog: 'wink',   cx: 0,   cy: 112, r: -3, s: 0.52, warm: 0.70, top: true  },
    { label: '尾声',    dog: 'puppy',  cx: 10,  cy: 56,  r: 1,  s: 0.66, warm: 1.00, top: false }
  ];

  const FALLBACK_DIALOG = [
    { m: '今天又叼回来三片碎纸。', s: '你管那叫捡？那是从人家书里撕的。' },
    { m: '这一片，是从你的划线里来的。', s: '同一件事，你在电影里也听过一遍。' },
    { m: '这些点，都是你自己点上去的。', s: '把鼠标放上去，看它跟谁是一伙的。' },
    { m: '我给你做了一期。', s: '脚本是模型写的，声音是机器合成的。' },
    { m: '所以我不是在翻你的书。', s: '我们是在读你。' }
  ];
  const DIALOG = window.WR_DIALOG || FALLBACK_DIALOG;

  /* ───────── DOM ───────── */
  const acts = $$('.act');
  const body = document.body;
  const curtain = $('.curtain');
  const prog = $('.progress');
  const actLabel = $('#actLabel');
  const programme = $('#programme');
  const cast = $('.cast');
  const castMain = $('#castMain');
  const castImg = $('#castImg');
  const castSide = $('#castSide');
  const bubbleEl = $('#bubble');
  const bMain = $('#bubbleMain');
  const bSide = $('#bubbleSide');

  let cur = -1;
  let busy = false;
  let wheelLock = 0;

  /* ───────── 切幕 ───────── */
  function layoutBubble(act) {
    const cfg = ACTS[act];
    const st = getComputedStyle(castMain);
    const base = parseFloat(st.bottom) || 90;
    const w = castMain.offsetWidth || 300;
    if (cfg.top) {
      bubbleEl.classList.add('top');
      bubbleEl.style.top = 'clamp(88px,12vh,128px)';
      bubbleEl.style.bottom = 'auto';
    } else {
      bubbleEl.classList.remove('top');
      bubbleEl.style.top = 'auto';
      bubbleEl.style.bottom = (base + w * cfg.s + 16) + 'px';
    }
    bubbleEl.style.right = st.right;
  }

  function applyPose(act) {
    const c = ACTS[act];
    cast.style.setProperty('--cx', c.cx + 'px');
    cast.style.setProperty('--cy', c.cy + 'px');
    cast.style.setProperty('--cr', c.r + 'deg');
    cast.style.setProperty('--cs', c.s);
    document.documentElement.style.setProperty('--warm', c.warm);
    prog.style.width = (act / (ACTS.length - 1) * 100) + '%';
    body.dataset.act = String(act);
  }

  function showBubble(act) {
    const d = DIALOG[act];
    if (!d) return;
    bMain.textContent = d.m;
    bSide.textContent = d.s;
    bubbleEl.classList.remove('is-in');
    setTimeout(() => bubbleEl.classList.add('is-in'), 60);
    castSide.classList.toggle('is-in', act === 3);
  }

  function go(n, opts = {}) {
    const target = clamp(Number(n) || 0, 0, acts.length - 1);
    if (busy || target === cur) return;
    busy = true;

    const first = cur < 0;
    const prev = cur;

    if (prev >= 0) {
      acts[prev].classList.remove('is-active');
      acts[prev].classList.toggle('is-before', target < prev);
      acts[prev].classList.toggle('is-after', target > prev);
    }

    const swap = () => {
      acts.forEach((el, i) => {
        el.classList.toggle('is-active', i === target);
        el.classList.toggle('is-before', i < target);
        el.classList.toggle('is-after', i > target);
        if (i === target) el.querySelector('.act__inner').scrollTop = 0;
      });
      cur = target;
      actLabel.textContent = ACTS[target].label;
      applyPose(target);
      layoutBubble(target);
      showBubble(target);

      // 狗只在序幕/尾声可以点
      castMain.classList.toggle('is-live', target === 0 || target === 4);
      const cloudEl = document.getElementById('castCloud');
      if (cloudEl) cloudEl.classList.toggle('is-in', target === 0 || target === 4);
      if (target === 1) setTimeout(unfoldCards, 140);

      // 换一只狗当"换姿态"
      const src = `assets/dogs/${ACTS[target].dog}.png`;
      if (castImg.getAttribute('src') !== src) {
        castImg.setAttribute('src', src);
        castMain.classList.remove('is-swap');
        void castMain.offsetWidth;
        castMain.classList.add('is-swap');
      }
    };

    positionDummy();

    if (reduce || first) {
      swap();
      busy = false;
      return;
    }

    // 幕布落下 → 换幕 → 升起
    curtain.classList.remove('is-up');
    curtain.classList.add('is-down');
    setTimeout(() => {
      swap();
      curtain.classList.remove('is-down');
      curtain.classList.add('is-up');
      setTimeout(() => { busy = false; }, 560);
    }, 480);
  }

  function positionDummy() {}

  /* ───────── 导航 ───────── */
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-go]');
    if (nav) {
      e.preventDefault();
      closeProgramme();
      const v = nav.dataset.go;
      go(v === '-1' ? cur - 1 : v === '1' ? cur + 1 : Number(v));
      return;
    }
  });

  $('#programmeBtn').addEventListener('click', openProgramme);
  $('#programmeClose').addEventListener('click', closeProgramme);
  programme.addEventListener('click', (e) => {
    if (e.target === programme || e.target.classList.contains('programme__paper')) closeProgramme();
  });

  function openProgramme() {
    programme.classList.add('is-open');
    programme.setAttribute('aria-hidden', 'false');
  }
  function closeProgramme() {
    programme.classList.remove('is-open');
    programme.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeProgramme(); }
    if (programme.classList.contains('is-open')) return;
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
    if (e.key === 'Home') go(0);
    if (e.key === 'End') go(acts.length - 1);
    if (e.key === 'p' || e.key === 'P') openProgramme();
  });

  // 滚轮：只在当前幕滚到底/顶时翻幕
  window.addEventListener('wheel', (e) => {
    const now = Date.now();
    if (now < wheelLock || busy) return;
    const inner = $('.act.is-active .act__inner');
    if (!inner) return;
    const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 4;
    const atTop = inner.scrollTop <= 4;
    if (e.deltaY > 12 && atBottom) { wheelLock = now + 900; go(cur + 1); }
    else if (e.deltaY < -12 && atTop) { wheelLock = now + 900; go(cur - 1); }
  }, { passive: true });

  /* ───────── 光标 ───────── */
  if (fine) {
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    let tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty;
    addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      cursor.classList.add('is-live');
    });
    (function follow() {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      dot.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(follow);
    })();
    document.addEventListener('mouseover', (e) => {
      cursor.classList.toggle('is-big',
        !!e.target.closest('a, button, .scrap, .episode, .programme__list button'));
    });
    addEventListener('resize', () => layoutBubble(cur));
  }

  /* ───────── 声音 ───────── */
  let ctx = null, master = null, on = false;

  function ensureAudio() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.16;
    src.connect(lp).connect(g).connect(master);
    src.start();
  }

  function bark(vol = 1) {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const k = 1 - i / n; d[i] = (Math.random() * 2 - 1) * k * k; }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.17);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.34 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
  }
  window.__bark = bark;

  const soundBtn = $('#sound');
  soundBtn.addEventListener('click', async () => {
    ensureAudio();
    if (ctx.state === 'suspended') await ctx.resume();
    on = !on;
    soundBtn.setAttribute('aria-pressed', String(on));
    $('.sound__txt', soundBtn).textContent = on ? '有声' : '静音';
    master.gain.setTargetAtTime(on ? 0.5 : 0.0, ctx.currentTime, 0.25);
    if (on) bark(0.7);
  });

  /* ───────── 卡片倾斜 ───────── */
  if (fine) {
    document.addEventListener('mousemove', (e) => {
      const el = e.target.closest('[data-tilt]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${(px * 5).toFixed(2)}deg) rotateX(${(-py * 5).toFixed(2)}deg)`;
    });
    document.addEventListener('mouseout', (e) => {
      const el = e.target.closest('[data-tilt]');
      if (el && !el.contains(e.relatedTarget)) el.style.transform = '';
    });
  }

  /* ───────── 启动 ───────── */
  acts.forEach((el) => el.classList.add('is-after'));

  /* ───────── 纸团展开 ───────── */
  const DMS = [0, 1, 2].map((i) => {
    const f = document.getElementById('crumple' + i);
    return f ? f.querySelector('.dm') : null;
  });

  function unfoldCards() {
    const cards = $$('.scrap');
    if (!cards.length) return;
    cards.forEach((el, i) => {
      if (el.dataset.unfolded) return;
      el.dataset.unfolded = '1';
      el.classList.add('is-crumpled');
      const dm = DMS[i % DMS.length];
      setTimeout(() => {
        el.classList.remove('is-crumpled');
        el.style.filter = `url(#crumple${i % 3})`;
        const t0 = performance.now();
        const dur = 1050;
        (function step() {
          const p = Math.min(1, (performance.now() - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          if (dm) dm.setAttribute('scale', (30 * (1 - e)).toFixed(2));
          if (p < 1) requestAnimationFrame(step);
          else el.style.filter = '';
        })();
      }, 110 + i * 190);
    });
  }

  const paperball = $('#paperball');
  if (paperball) {
    paperball.addEventListener('click', (e) => {
      e.stopPropagation();
      bark(0.8);
      go(1);
      setTimeout(unfoldCards, 700);
    });
  }

  /* ───────── 狗：可点、会跳、跟着光标转头 ───────── */
  const cloud = $('#castCloud');
  const DOGLINES = [
    '汪。（它似乎对这个结论很满意）',
    '别问了，你自己心里有数。',
    '我叼回来的，可不是这些字。',
    '再点我，我就咬你鞋。',
    '你今天问了三遍同一个问题。'
  ];
  let dogSay = 0;

  const dogline = document.createElement('div');
  dogline.className = 'dogline';
  document.body.appendChild(dogline);

  castMain.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!castMain.classList.contains('is-live')) return;
    castMain.classList.remove('is-hop');
    void castMain.offsetWidth;
    castMain.classList.add('is-hop');
    bark(1);
    dogline.textContent = DOGLINES[dogSay++ % DOGLINES.length];
    const r = castMain.getBoundingClientRect();
    dogline.style.left = Math.max(12, r.left - 40) + 'px';
    dogline.style.top = (r.top - 34) + 'px';
    dogline.classList.add('is-in');
    clearTimeout(dogline._t);
    dogline._t = setTimeout(() => dogline.classList.remove('is-in'), 2600);
  });

  if (fine) {
    addEventListener('mousemove', (e) => {
      if (!castMain.classList.contains('is-live')) return;
      const r = castMain.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      castImg.style.transform =
        `translate(${(dx * 16).toFixed(1)}px, ${(dy * 8).toFixed(1)}px) rotate(${(dx * 5).toFixed(1)}deg)`;
    });
  }

  go(0);

  // 深链：#act=2
  const m = (location.hash || '').match(/^#act=(\d+)$/);
  if (m) setTimeout(() => go(Number(m[1])), 60);
})();
