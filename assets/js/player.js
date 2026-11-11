/* ===========================================================
   电台播放器 —— 点碎片卡上的时长，就"听"这一期。

   语音用浏览器自带的 speechSynthesis（Web Speech API）：
   零后端、零音频文件、离线可用。后续接 CosyVoice / qwen-tts 时，
   只要把 speak() 换成一个 <audio> 就能接上，其余不动。
   =========================================================== */
(() => {
  const D = window.WR_DATA;
  if (!D || !D.cards || !D.cards.length) return;

  const $ = (s, r = document) => r.querySelector(s);

  /* ───────── 建面板 ───────── */
  const panel = document.createElement('section');
  panel.className = 'radio';
  panel.setAttribute('aria-label', '电台播放器');
  panel.innerHTML = `
    <div class="radio__paper"></div>
    <div class="radio__stage">
      <div class="turntable" aria-hidden="true">
        <div class="turntable__ring"></div>
        <div class="turntable__plinth"></div>
        <div class="vinyl">
          <div class="vinyl__label"><span></span></div>
        </div>
        <div class="tonearm"><i></i></div>
        <div class="turntable__knob"></div>
        <div class="turntable__ui"><i></i><b>REC</b></div>
      </div>
      <div class="radio__body">
        <header class="radio__head">
          <span class="radio__badge">电台</span>
          <h4 class="radio__title"></h4>
          <button class="radio__close" aria-label="关闭">×</button>
        </header>
        <ol class="radio__lines"></ol>
        <footer class="radio__foot">
          <button class="radio__btn" data-act="prev">上一句</button>
          <button class="radio__btn radio__btn--main" data-act="play">▶ 播放</button>
          <button class="radio__btn" data-act="next">下一句</button>
          <span class="radio__meta"></span>
        </footer>
      </div>
    </div>`;
  document.body.appendChild(panel);

  const elTitle = $('.radio__title', panel);
  const elLines = $('.radio__lines', panel);
  const elMeta = $('.radio__meta', panel);
  const btnPlay = $('[data-act="play"]', panel);
  const elLabel = $('.vinyl__label span', panel);

  /* ───────── 状态 ───────── */
  let card = null;
  let lines = [];
  let idx = -1;
  let playing = false;
  let utt = null;
  const tts = 'speechSynthesis' in window;

  // 有真音频就放音频（逐句按 durations 排程），没有才退回浏览器 TTS
  const audioEl = new Audio();
  audioEl.preload = 'none';
  let audioMode = false;
  let audioStart = 0;
  let audioTimer = null;
  let audioIdx = -1;

  function useAudio() {
    audioMode = !!(card && card.episode && card.episode.audio &&
                   card.episode.audio.durations);
    if (audioMode) {
      audioEl.src = card.episode.audio.file;
    }
  }

  function audioSeekTo(i) {
    const a = card.episode.audio;
    const t = a.durations.slice(0, i).reduce((x, y) => x + y, 0);
    audioEl.currentTime = t;
    audioIdx = i;
    mark(i);
  }

  function audioPlay() {
    audioStart = performance.now();
    audioEl.play().catch(() => { audioMode = false; play(); });
    const a = card.episode.audio;
    clearInterval(audioTimer);
    audioTimer = setInterval(() => {
      const t = audioEl.currentTime;
      let acc = 0, k = 0;
      for (; k < a.durations.length; k++) {
        acc += a.durations[k];
        if (t < acc) break;
      }
      if (k !== audioIdx) { audioIdx = k; mark(Math.min(k, lines.length - 1)); }
    }, 120);
  }

  function pickVoice() {
    if (!tts) return null;
    const vs = speechSynthesis.getVoices() || [];
    return vs.find((v) => /zh[-_]CN|Chinese|中文/i.test(v.lang + v.name)) || null;
  }

  function renderLines() {
    elLines.innerHTML = '';
    lines.forEach((ln, i) => {
      const li = document.createElement('li');
      li.className = 'radio__line radio__line--' + (ln.who === '狗' ? 'dog' : 'you');
      li.dataset.i = i;
      li.innerHTML =
        `<span class="radio__who">${ln.who}</span>` +
        `<span class="radio__text">${ln.text}</span>` +
        (ln.cite ? `<span class="radio__cite">${citeOf(ln.cite)}</span>` : '');
      elLines.appendChild(li);
    });
  }

  function citeOf(id) {
    for (const c of D.cards) {
      for (const t of c.traces) if (t.id === id) return t.source + (t.locator ? ' · ' + t.locator : '');
    }
    const n = D.graph.nodes.find((x) => x.id === id);
    return n ? n.label : id;
  }

  function mark(i) {
    [...elLines.children].forEach((el, k) => el.classList.toggle('on', k === i));
    const cur = elLines.children[i];
    if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function stopVoice() {
    if (tts) speechSynthesis.cancel();
    clearInterval(audioTimer);
    audioEl.pause();
  }

  function speak(i) {
    idx = i;
    if (i < 0 || i >= lines.length) { finish(); return; }
    mark(i);
    if (audioMode) { audioIdx = i; return; }
    const ln = lines[i];
    if (!tts) {                       // 没有语音就当字幕机，每句停 2.6s
      clearTimeout(speak._t);
      speak._t = setTimeout(() => { if (playing) speak(i + 1); }, 2600);
      return;
    }
    utt = new SpeechSynthesisUtterance(ln.text);
    utt.lang = 'zh-CN';
    utt.rate = 1.0;
    utt.pitch = ln.who === '狗' ? 1.25 : 1.0;
    const v = pickVoice();
    if (v) utt.voice = v;
    utt.onend = () => { if (playing) speak(i + 1); };
    utt.onerror = () => { if (playing) speak(i + 1); };
    speechSynthesis.speak(utt);
  }

  function finish() {
    playing = false;
    panel.classList.remove('is-playing');
    btnPlay.textContent = '▶ 再听一遍';
    if (tts) speechSynthesis.cancel();
    clearInterval(audioTimer);
  }

  function play() {
    playing = true;
    panel.classList.add('is-playing');
    btnPlay.textContent = '❚❚ 暂停';
    if (audioMode) {
      if (audioIdx >= lines.length - 1 || audioIdx < 0) {
        audioSeekTo(0);
      }
      audioPlay();
      return;
    }
    if (idx >= lines.length - 1) idx = -1;
    speak(idx + 1);
  }

  function pause() {
    playing = false;
    panel.classList.remove('is-playing');
    btnPlay.textContent = '▶ 继续';
    stopVoice();
  }

  function open(i) {
    card = D.cards[i];
    if (!card) return;
    lines = card.episode.lines;
    elTitle.textContent = '「' + card.question.replace(/[「」？?]/g, '') + '」';
    if (elLabel) {
      elLabel.textContent = card.question.replace(/[「」？?\s]/g, '').slice(0, 12);
    }
    elMeta.textContent = card.size + ' 条痕迹 · ' + card.traces.length + ' 个来源 · '
      + (card.episode.audio ? '有音频 · ' : '') + card.episode.duration;
    renderLines();
    idx = -1;
    audioIdx = -1;
    playing = false;
    btnPlay.textContent = '▶ 播放';
    useAudio();
    panel.classList.add('is-open');
    document.body.classList.add('radio-open');
    play();
  }

  function close() {
    playing = false;
    stopVoice();
    panel.classList.remove('is-open');
    document.body.classList.remove('radio-open');
  }

  /* ───────── 事件 ───────── */
  // 第三幕的电台卡
  document.querySelectorAll('.episode[data-episode]').forEach((el) => {
    el.addEventListener('click', () => open(Number(el.dataset.episode)));
  });

  // 碎片卡右下角的时长
  document.querySelectorAll('.scrap [data-play]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const scrap = btn.closest('.scrap');
      const cardIdx = Number(btn.closest('.scrap').dataset.card || 0);
      open(all.indexOf(scrap));
    });
  });

  btnPlay.addEventListener('click', () => (playing ? pause() : play()));
  $('.radio__close', panel).addEventListener('click', close);
  $('[data-act="prev"]', panel).addEventListener('click', () => {
    if (idx <= 0) return;
    stopVoice();
    speak(idx - 1);
  });
  $('[data-act="next"]', panel).addEventListener('click', () => {
    stopVoice();
    speak(idx + 1);
  });
  elLines.addEventListener('click', (e) => {
    const li = e.target.closest('.radio__line');
    if (!li) return;
    const i = Number(li.dataset.i);
    stopVoice();
    playing = true;
    btnPlay.textContent = '❚❚ 暂停';
    if (audioMode) { audioSeekTo(i); audioPlay(); return; }
    speak(i);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  if (tts) speechSynthesis.onvoiceschanged = () => pickVoice();

  // 深链：index.html#radio=0 直接打开第 1 期（也方便截图和分享）
  const m = (location.hash || '').match(/radio=(\d+)/);
  if (m) {
    const n = Math.min(Number(m[1]), D.cards.length - 1);
    setTimeout(() => {
      try {
        open(n);
      } catch (err) {
        const d = document.createElement('pre');
        d.style.cssText = 'position:fixed;z-index:9999;left:20px;top:20px;background:#fff;'
          + 'color:#b00;font-size:13px;padding:12px;max-width:90vw;white-space:pre-wrap;border:1px solid #b00';
        d.textContent = 'ERR ' + err.message + '\n' + String(err.stack || '').slice(0, 400);
        document.body.appendChild(d);
      }
    }, 400);
  }
})();
