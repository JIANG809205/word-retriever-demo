/* ===========================================================
   把 pipeline 产出的 data.js 渲染进页面。
   加载顺序：data.js → data.local.js → render.js → detail.js → player.js → main.js
   =========================================================== */
(() => {
  const D = window.WR_DATA;
  if (!D || !D.cards || !D.cards.length) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;z-index:99;'
      + 'font-family:var(--mono);font-size:13px;line-height:2;color:#8a7f70;text-align:center';
    box.innerHTML = '没有数据。<br>先跑一次 <b>python run.py</b>，再刷新。';
    document.body.appendChild(box);
    return;
  }

  // 数据来源角标（演示 / 真实）
  try {
    const badge = document.createElement('div');
    badge.className = 'srcbadge';
    badge.textContent = (D.meta && D.meta.demo ? '演示语料 · ' : '你的数据 · ')
      + D.stats.n_traces + ' 条';
    document.body.appendChild(badge);
  } catch (_) {}

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const DOGS = ['corgi', 'puppy', 'wink', 'fluff', 'beagle', 'sleepy'];
  const dogAt = (i) => `assets/dogs/${DOGS[i % DOGS.length]}.png`;

  // LLM 生成的是「问句」，统一包装成「……？」
  D.cards.forEach((c) => {
    if (!c.question) return;
    if (c.title_source === 'llm' || c.title_source === 'seed') {
      let q = c.question.replace(/[「」]/g, '').trim();
      if (!/[？?]$/.test(q)) q += '？';
      c.question = '「' + q + '」';
    }
  });

  /* ───────── 1. 碎片带 ───────── */
  const track = $('#driftTrack');
  if (track) {
    track.innerHTML = '';
    // 从每个主题里取一条，凑成一条长长的带子
    const picks = [];
    D.cards.slice(0, 3).forEach((c) => {
      picks.push({ card: c, trace: c.traces[0] });
    });
    // 再把全量痕迹按主题轮流铺开，让带子够长
    const pool = (D.traces || []).slice();
    let guard = 0;
    while (picks.length < 22 && pool.length && guard++ < 200) {
      const t = pool.shift();
      if (!t) break;
      let owner = D.cards.find((c) => (c.all_ids || []).includes(t.id));
      if (!owner) owner = D.cards.find((c) => (c.traces || []).some((x) => x.id === t.id));
      if (!owner) continue;
      if (picks.some((p) => p.trace.id === t.id)) continue;
      picks.push({ card: owner, trace: t });
    }

    picks.forEach((p, i) => {
      const t = p.trace;
      const el = document.createElement('article');
      el.className = 'scrap scrap--lane' + (i % 4 === 1 ? ' scrap--low' : i % 4 === 3 ? ' scrap--high' : '');
      el.dataset.id = t.id;
      el.dataset.card = String(D.cards.indexOf(p.card));
      el.innerHTML = `
        <div class="scrap__paper"></div>
        <img class="scrap__dog" src="${dogAt(i)}" alt="" draggable="false">
        <p class="scrap__no">${t.medium} · ${String(i + 1).padStart(2, '0')}</p>
        <blockquote>${t.text}</blockquote>
        <p class="scrap__cite">${[t.source, t.locator].filter(Boolean).join(' · ')}</p>
        <div class="scrap__foot">
          <span class="tag">${p.card.question.replace(/[「」]/g, '').slice(0, 12)}</span>
          <button class="play" data-play>
            <span class="play__bars"><i></i><i></i><i></i></span>${p.card.episode.duration}
          </button>
        </div>`;
      track.appendChild(el);
    });
  }

  /* ───────── 2. 星图 ───────── */
  const canvas = $('#mapCanvas');
  const svg = canvas && $('svg', canvas);
  if (svg && D.graph && D.graph.nodes.length) {
    const NS = 'http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox', `0 0 ${D.graph.width} ${D.graph.height}`);
    const linksG = $('.links', svg);
    const nodesG = $('.nodes', svg);
    linksG.innerHTML = '';
    nodesG.innerHTML = '';
    const pos = {};
    D.graph.nodes.forEach((n) => { pos[n.id] = n; });

    D.graph.links.forEach((l) => {
      const a = pos[l.s], b = pos[l.t];
      if (!a || !b) return;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${a.x} ${a.y} L${b.x} ${b.y}`);
      p.setAttribute('stroke-opacity', (0.25 + l.w * 0.6).toFixed(2));
      if (a.cluster != null) p.dataset.cluster = a.cluster;
      linksG.appendChild(p);
    });

    D.graph.nodes.forEach((n) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', n.x);
      c.setAttribute('cy', n.y);
      c.setAttribute('r', n.medium === '书摘' ? 7 : n.medium === '播客' ? 9 : 6);
      if (n.medium === '播客') c.setAttribute('class', 'big');
      const t = document.createElementNS(NS, 'title');
      t.textContent = `[${n.medium}] ${n.label}`;
      c.appendChild(t);
      c.setAttribute('data-id', n.id);
      if (n.cluster != null) c.setAttribute('data-cluster', n.cluster);
      if (n.medium) c.setAttribute('data-med', n.medium);
      nodesG.appendChild(c);
    });
  }

  /* ───────── 3. 电台（幕内列表） ───────── */
  const eps = $('#episodes');
  if (eps) {
    eps.innerHTML = '';
    D.cards.slice(0, 3).forEach((c, i) => {
      const el = document.createElement('article');
      el.className = 'episode';
      el.setAttribute('data-episode', String(i));
      el.innerHTML = `
        <p class="episode__no">第 ${i + 1} 期</p>
        <h3 class="episode__q">${c.question}</h3>
        <p class="episode__meta">${c.size} 条痕迹 · ${c.media.join(' / ')} · ${c.episode.duration}</p>
        <span class="episode__play"><i>▶</i> 收听这一期</span>`;
      eps.appendChild(el);
    });
  }

  /* ───────── 4. 数字与文案 ───────── */
  const meta = $('.hero__meta');
  if (meta && D.stats) {
    const kinds = Object.keys(D.stats.per_medium).filter((k) => D.stats.per_medium[k] > 0);
    meta.innerHTML = `
      <span>${D.stats.n_traces} 条痕迹</span>
      <span>${D.stats.n_clusters} 个主题</span>
      <span>跨 ${kinds.length} 种媒介</span>`;
  }
  const statLine = $('.map__stat');
  if (statLine && D.stats) {
    const m = D.stats.per_medium;
    const parts = Object.keys(m).filter((k) => m[k] > 0)
      .map((k) => `<b>${m[k]}</b> 条${k}`);
    statLine.innerHTML = `<b>${D.stats.n_traces}</b> 条痕迹 · ` + parts.join(' · ');
  }
  const lede = $('.lede');
  if (lede && D.stats) {
    lede.innerHTML =
      `${D.stats.n_traces} 条痕迹，聚成 ${D.stats.n_clusters} 个主题。<br>` +
      `每一片都能点回原处——原句、原页码、原时间码。`;
  }
  const sub = $('#scrapsSub');
  if (sub && D.stats) {
    sub.textContent =
      `${D.stats.n_traces} 条痕迹聚成 ${D.stats.n_clusters} 个主题，` +
      `平均每张卡覆盖 ${D.stats.coverage_avg} 种媒介。按「你在追问什么」分组，不按媒介分组。`;
  }

  /* ───────── 5. 数据来源提示 ───────── */
  const foot = $('.foot__note');
  if (foot && D.meta) {
    foot.textContent = D.meta.demo
      ? `当前为演示语料（${D.stats.n_traces} 条虚构痕迹，${D.meta.generated} 生成）。角色插画来自本人收集的参考图，仅作课程演示。`
      : `数据来自你自己的微信读书与看过的电影（${D.stats.n_traces} 条，${D.meta.generated} 生成）。仅在本机渲染。`;
  }
})();
