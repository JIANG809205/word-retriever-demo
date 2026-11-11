/* ===========================================================
   把 pipeline 产出的 data.js 渲染进页面。
   加载顺序：data.js → data.local.js → render.js → detail.js → player.js → main.js
   =========================================================== */
(() => {
  const D = window.WR_DATA;
  if (!D || !D.cards || !D.cards.length) return;

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

  /* ───────── 1. 碎片卡 ───────── */
  const grid = $('.scraps__grid');
  if (grid) {
    grid.innerHTML = '';
    D.cards.slice(0, 3).forEach((c, i) => {
      const label = c.title_source === 'seed' || c.title_source === 'llm' ? '问题' : '碎片';
      const tagSrc = c.dominant_source
        ? `<span class="tag">${c.dominant_source}</span>` : '';
      const el = document.createElement('article');
      el.className = 'scrap';
      el.setAttribute('data-tilt', '');
      el.innerHTML = `
        <div class="scrap__paper"></div>
        <img class="scrap__dog" src="${dogAt(i)}" alt="" draggable="false">
        <p class="scrap__no">${label} 0${i + 1}</p>
        <h3 class="scrap__q">${c.question}</h3>
        <blockquote>${c.quote}</blockquote>
        <p class="scrap__cite">${c.cite}</p>
        <div class="scrap__foot">
          ${tagSrc}
          <span class="tag">同主题 ${c.size} 条</span>
          <button class="play" data-play>
            <span class="play__bars"><i></i><i></i><i></i></span>${c.episode.duration}
          </button>
        </div>`;
      grid.appendChild(el);
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
        ${c.episode.audio ? '<span class="episode__badge">有音频</span>' : ''}
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
