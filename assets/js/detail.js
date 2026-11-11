/* ===========================================================
   详情层 + 星图悬停
   点卡片 / 点星图 / 点碎片带 → 看到这一组的全部痕迹，可筛选、可搜索
   =========================================================== */
(() => {
  const D = window.WR_DATA;
  if (!D) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const byId = {};
  (D.traces || []).forEach((t) => { byId[t.id] = t; });
  D.cards.forEach((c) => (c.traces || []).forEach((t) => { byId[t.id] = byId[t.id] || t; }));

  const MED = { 书摘: 'book', 播客: 'podcast', 电影: 'movie' };
  const MEDS = ['书摘', '播客', '电影'];

  /* ───────── 建面板 ───────── */
  const sheet = document.createElement('section');
  sheet.className = 'sheet';
  sheet.setAttribute('aria-label', '痕迹详情');
  sheet.innerHTML = `
    <div class="sheet__paper"></div>
    <div class="sheet__inner">
      <header class="sheet__head">
        <p class="sheet__no"></p>
        <h4 class="sheet__title"></h4>
        <p class="sheet__meta"></p>
        <button class="sheet__close" aria-label="关闭">×</button>
        <div class="sheet__tools">
          <div class="sheet__chips">
            <button class="sheet__chip on" data-med="">全部 <b></b></button>
            <button class="sheet__chip" data-med="书摘">书摘 <b></b></button>
            <button class="sheet__chip" data-med="播客">播客 <b></b></button>
            <button class="sheet__chip" data-med="电影">电影 <b></b></button>
          </div>
          <input class="sheet__search" type="search" placeholder="搜原文 / 出处…">
        </div>
      </header>
      <ol class="sheet__list"></ol>
    </div>`;
  document.body.appendChild(sheet);

  const elNo = $('.sheet__no', sheet);
  const elTitle = $('.sheet__title', sheet);
  const elMeta = $('.sheet__meta', sheet);
  const elList = $('.sheet__list', sheet);
  const elSearch = $('.sheet__search', sheet);
  const elChips = $$('.sheet__chip', sheet);

  let all = [];        // 当前主题的全部痕迹
  let med = '';        // 媒介筛选
  let q = '';          // 搜索词

  /* ───────── 渲染 ───────── */
  function row(t) {
    const cls = MED[t.medium] || 'book';
    return `<li class="sheet__row">
      <span class="sheet__tag sheet__tag--${cls}">${t.medium}</span>
      <p class="sheet__text">${t.text}</p>
      <cite class="sheet__cite">${[t.source, t.locator].filter(Boolean).join(' · ')}</cite>
    </li>`;
  }

  function counts() {
    const c = { '': all.length };
    MEDS.forEach((m) => { c[m] = all.filter((t) => t.medium === m).length; });
    return c;
  }

  function paint() {
    const cnt = counts();
    elChips.forEach((b) => {
      b.querySelector('b').textContent = cnt[b.dataset.med] || 0;
      b.classList.toggle('on', b.dataset.med === med);
      b.disabled = !cnt[b.dataset.med] && b.dataset.med !== '';
    });

    const ql = q.trim().toLowerCase();
    const list = all.filter((t) => {
      if (med && t.medium !== med) return false;
      if (!ql) return true;
      return (t.text + ' ' + (t.source || '') + ' ' + (t.locator || ''))
        .toLowerCase().includes(ql);
    });

    elList.innerHTML = list.length
      ? list.map(row).join('')
      : `<li class="sheet__empty">没有匹配的痕迹</li>`;
    elList.scrollTop = 0;
    elMeta.textContent = `${list.length} / ${all.length} 条` +
      (med ? `　只看${med}` : '') + (ql ? `　搜索「${q.trim()}」` : '');
  }

  /* ───────── 打开 ───────── */
  function show() {
    sheet.classList.add('is-open');
    document.body.classList.add('sheet-open');
  }

  function openCard(i) {
    const c = D.cards[i];
    if (!c) return;
    const ids = c.all_ids || (c.traces || []).map((t) => t.id);
    let list = ids.map((id) => byId[id]).filter(Boolean);
    const head = new Set((c.traces || []).map((t) => t.id));
    list.sort((a, b) => (head.has(b.id) ? 1 : 0) - (head.has(a.id) ? 1 : 0));

    all = list; med = ''; q = ''; elSearch.value = '';
    elNo.textContent = (c.title_source === 'llm' || c.title_source === 'seed')
      ? '问题 0' + (i + 1) : '碎片 0' + (i + 1);
    elTitle.textContent = c.question;
    paint();
    show();
  }

  function openTrace(id) {
    const t = byId[id];
    if (!t) return;
    let card = null, idx = -1;
    for (let i = 0; i < D.cards.length; i++) {
      const c = D.cards[i];
      if ((c.all_ids || []).includes(id) || (c.traces || []).some((x) => x.id === id)) {
        card = c; idx = i; break;
      }
    }
    all = [t]; med = ''; q = ''; elSearch.value = '';
    elNo.textContent = t.medium + ' · 单条';
    elTitle.textContent = card ? card.question : '一条痕迹';
    elList.innerHTML = row(t) + (card
      ? `<li class="sheet__back"><button data-open-card="${idx}">看这个主题的全部 ${(card.all_ids || []).length} 条 →</button></li>`
      : '');
    elMeta.textContent = [t.source, t.locator].filter(Boolean).join(' · ') || '—';
    elChips.forEach((b) => { b.style.display = 'none'; });
    elSearch.style.display = 'none';
    show();
  }

  function resetTools() {
    elChips.forEach((b) => { b.style.display = ''; });
    elSearch.style.display = '';
  }

  function close() {
    sheet.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    if (location.hash.match(/^#(card|trace)=/)) history.replaceState(null, '', location.pathname);
  }

  /* ───────── 事件 ───────── */
  elChips.forEach((b) => b.addEventListener('click', () => {
    med = b.dataset.med;
    paint();
  }));
  elSearch.addEventListener('input', () => {
    q = elSearch.value;
    paint();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.sheet__chip') || e.target.closest('.sheet__search')) return;

    const cardBtn = e.target.closest('[data-open-card]');
    if (cardBtn) { resetTools(); openCard(Number(cardBtn.dataset.openCard)); return; }

    if (e.target.closest('.sheet__close')) { close(); return; }

    const scrap = e.target.closest('.scrap');
    if (scrap && !e.target.closest('[data-play]')) {
      resetTools();
      openCard(Number(scrap.dataset.card || 0));
      return;
    }

    const chip = e.target.closest('.chip[data-id]');
    if (chip) { resetTools(); openTrace(chip.dataset.id); return; }

    const node = e.target.closest('.nodes circle[data-id]');
    if (node) { resetTools(); openTrace(node.dataset.id); return; }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    // 详情层开着时，输入框里按 Esc 只清搜索
    if (e.key === 'Escape' && q) { q = ''; elSearch.value = ''; paint(); }
  });

  /* ───────── 星图悬停：高亮同一簇 ───────── */
  function wireGraph() {
    const g = $('#mapCanvas');
    if (!g) return;
    const circles = $$('.nodes circle', g);
    const paths = $$('.links path', g);

    function highlight(cluster) {
      if (cluster == null) {
        circles.forEach((c) => c.classList.remove('is-dim', 'is-hot'));
        paths.forEach((p) => p.classList.remove('is-dim', 'is-hot'));
        return;
      }
      circles.forEach((c) => {
        const same = c.dataset.cluster === String(cluster);
        c.classList.toggle('is-hot', same);
        c.classList.toggle('is-dim', !same);
      });
      paths.forEach((p) => {
        const same = p.dataset.cluster === String(cluster);
        p.classList.toggle('is-hot', same);
        p.classList.toggle('is-dim', !same);
      });
    }

    circles.forEach((c) => {
      c.addEventListener('mouseenter', () => highlight(c.dataset.cluster));
      c.addEventListener('mouseleave', () => highlight(null));
    });

    // 按媒介筛选
    const chips = $$('.map__chip');
    chips.forEach((b) => b.addEventListener('click', () => {
      chips.forEach((x) => x.classList.toggle('on', x === b));
      const med = b.dataset.med;
      circles.forEach((c) => {
        const on = !med || c.dataset.med === med;
        c.classList.toggle('is-dim', !on);
        c.classList.remove('is-hot');
      });
      paths.forEach((p) => p.classList.remove('is-hot'));
      if (med) {
        paths.forEach((p) => p.classList.add('is-dim'));
      } else {
        paths.forEach((p) => p.classList.remove('is-dim'));
      }
    }));
  }

  /* ───────── 深链 ───────── */
  const m = (location.hash || '').match(/^#(card|trace)=(.+)$/);
  if (m) {
    setTimeout(() => {
      resetTools();
      if (m[1] === 'card') openCard(Number(m[2]));
      else openTrace(m[2]);
    }, 500);
  }

  setTimeout(wireGraph, 150);
})();
