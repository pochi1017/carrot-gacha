/*
 * gacha.js — 당근 뽑기 상태 머신 · 확률 · 저장 · 연출
 *
 * 상태:  IDLE → DRAWING → VIDEO_PLAYING → REVEALING → RESULT → IDLE
 *  - IDLE / RESULT 에서만 새 뽑기를 시작할 수 있다 (영상 중 연타 = 무시)
 *  - 결과 연출은 <video> 의 ended 이벤트를 기준으로 시작한다
 */
(function () {
  'use strict';

  var DATA = window.GACHA_DATA;
  var State = { IDLE: 'IDLE', DRAWING: 'DRAWING', VIDEO_PLAYING: 'VIDEO_PLAYING', REVEALING: 'REVEALING', RESULT: 'RESULT' };
  var state = State.IDLE;

  /* URL 옵션 — 테스트용
   *   ?fast=1          영상 4배속
   *   ?force=ultraRare 등급 강제 / ?force=king 당근 id 강제 */
  var params = new URLSearchParams(location.search);
  var FAST = params.get('fast') === '1';
  var FORCE = params.get('force');

  /* ───────── DOM ───────── */
  var $ = function (s) { return document.querySelector(s); };
  var els = {
    body: document.body,
    main: $('#main'),
    drawBtn: $('#drawBtn'),
    stage: $('#stage'),
    video: $('#pullVideo'),
    tension: $('#tension'),
    result: $('#result'),
    fx: $('#fx'),
    scene: $('.card-scene'),
    card: $('#card'),
    cardBack: $('#cardBack'),
    cardFront: $('#cardFront'),
    resultCarrot: $('#resultCarrot'),
    resultName: $('#resultName'),
    resultNo: $('#resultNo'),
    resultDesc: $('#resultDesc'),
    resultGrade: $('#resultGrade'),
    resultStars: $('#resultStars'),
    resultTag: $('#resultTag'),
    resultActions: $('#resultActions'),
    againBtn: $('#againBtn'),
    okBtn: $('#okBtn'),
    resultDexBtn: $('#resultDexBtn'),
    dexBtn: $('#dexBtn'),
    dexCount: $('#dexCount'),
    dex: $('#dex'),
    dexClose: $('#dexClose'),
    dexGrid: $('#dexGrid'),
    dexProgressText: $('#dexProgressText'),
    dexProgressBar: $('#dexProgressBar'),
    dexDraws: $('#dexDraws'),
    dexReset: $('#dexReset'),
    toast: $('#toast')
  };

  /* ───────── 저장 ───────── */
  function loadSave() {
    try {
      var raw = localStorage.getItem(DATA.storageKey);
      if (raw) { var s = JSON.parse(raw); if (s && s.owned) return s; }
    } catch (e) {}
    return { owned: {}, draws: 0, history: [] };
  }
  function persist() {
    try { localStorage.setItem(DATA.storageKey, JSON.stringify(save)); } catch (e) {}
  }
  var save = loadSave();

  function ownedCount() {
    var n = 0;
    DATA.carrots.forEach(function (c) { if (save.owned[c.id]) n++; });
    return n;
  }

  /* ───────── 확률 ───────── */
  function pickWeighted(items, weightOf) {
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += weightOf(items[i]);
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) {
      r -= weightOf(items[i]);
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }
  function roll(force) {
    var gradeKey, pool;
    if (force && DATA.grades[force]) {
      gradeKey = force;
    } else if (force) {
      var forced = DATA.carrots.filter(function (c) { return c.id === force; })[0];
      if (forced) return forced;
    }
    if (!gradeKey) {
      var keys = Object.keys(DATA.grades);
      gradeKey = pickWeighted(keys, function (k) { return DATA.grades[k].rate; });
    }
    pool = DATA.carrots.filter(function (c) { return c.grade === gradeKey; });
    return pickWeighted(pool, function (c) { return c.weight == null ? 1 : c.weight; });
  }

  /* 획득 → 도감 등록. 반환: { isNew, count } */
  function acquire(carrot) {
    var now = Date.now();
    var rec = save.owned[carrot.id];
    var isNew = !rec;
    if (isNew) rec = save.owned[carrot.id] = { count: 0, firstAt: now, lastAt: now };
    rec.count += 1;
    rec.lastAt = now;
    save.draws += 1;
    save.history.unshift({ id: carrot.id, at: now, isNew: isNew });
    if (save.history.length > 30) save.history.length = 30;
    persist();
    if (!isNew) onDuplicate(carrot, rec);
    return { isNew: isNew, count: rec.count };
  }
  /* 중복 보상 훅 — 재화 시스템이 생기면 여기서 지급한다 */
  function onDuplicate(carrot, rec) {
    if (!DATA.duplicate || !DATA.duplicate.enabled) return;
    /* var reward = DATA.duplicate.rewardByGrade[carrot.grade]; ... */
  }

  /* ───────── 상태 ───────── */
  function setState(s) {
    state = s;
    els.body.setAttribute('data-gacha', s);
    els.drawBtn.setAttribute('aria-busy', s !== State.IDLE && s !== State.RESULT ? 'true' : 'false');
  }
  function canStart() { return state === State.IDLE || state === State.RESULT; }

  /* ───────── 뽑기 흐름 ───────── */
  var current = null;       // 이번 뽑기 결과 { carrot, grade, isNew, count }
  var revealed = false;     // ended 가 두 번 오거나 fallback 과 겹쳐도 한 번만
  var timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function startDraw(force) {
    if (!canStart()) return false;
    clearTimers();
    hideResult(true);
    closeDex();

    setState(State.DRAWING);
    var carrot = roll(force || FORCE);
    current = { carrot: carrot, grade: DATA.grades[carrot.grade] };
    revealed = false;

    /* 화면 전환: 메인 → 영상 스테이지 */
    els.stage.hidden = false;
    els.tension.hidden = true;
    void els.stage.offsetWidth; els.stage.classList.add('on'); /* rAF 대신 강제 reflow — 숨은 탭에서도 전환이 멈추지 않게 */

    var v = els.video;
    v.playbackRate = FAST ? 4 : 1;
    /* 뽑기는 사용자가 당근을 직접 클릭해 시작하므로 소리 있는 재생이 허용된다.
       혹시 자동재생이 막히는 환경이면 음소거로라도 재생해 첫 프레임에 멈추지 않게 한다. */
    v.muted = false;
    v.volume = 1;
    try { v.currentTime = 0; } catch (e) {}
    var p = v.play();
    if (p && p.then) {
      p.then(function () { setState(State.VIDEO_PLAYING); })
       .catch(function () {
         v.muted = true;
         var p2 = v.play();
         if (p2 && p2.then) p2.then(function () { setState(State.VIDEO_PLAYING); }).catch(function () { onVideoEnded(); });
         else setState(State.VIDEO_PLAYING);
       });
    } else {
      setState(State.VIDEO_PLAYING);
    }
    /* ended 가 끝내 안 오는 경우의 안전장치 (길이 + 1.5초) */
    var dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 6;
    later(function () { if (!revealed) onVideoEnded(); }, (dur / (FAST ? 4 : 1)) * 1000 + 1500);
    return true;
  }

  function onVideoEnded() {
    if (revealed || !current) return;
    revealed = true;
    setState(State.REVEALING);

    /* 영상 마지막 프레임을 잠시 유지한 채 짧은 긴장감 */
    els.tension.hidden = false;
    els.tension.classList.add('on');

    later(function () {
      els.stage.classList.remove('on');
      els.tension.classList.remove('on');
      showResult();
    }, 700);
    later(function () { els.stage.hidden = true; els.tension.hidden = true; }, 1100);
  }

  /* ───────── 결과 카드 ───────── */
  function starsHtml(n) {
    var s = '';
    for (var i = 0; i < 4; i++) s += '<span class="star' + (i < n ? ' on' : '') + '">★</span>';
    return s;
  }
  function applyGrade(grade) {
    var r = els.result;
    r.style.setProperty('--g-color', grade.color);
    r.style.setProperty('--g-bg', grade.bg);
    r.style.setProperty('--g-ring', grade.ring);
    r.style.setProperty('--g-glow', grade.glow);
  }

  function showResult() {
    var c = current.carrot, g = current.grade;
    var got = acquire(c);
    current.isNew = got.isNew; current.count = got.count;
    updateDexBadge();

    applyGrade(g);
    els.result.className = 'result grade-' + c.grade;
    els.resultCarrot.src = c.image;
    els.resultCarrot.alt = c.name;
    els.resultName.textContent = c.name;
    els.resultNo.textContent = 'No.' + String(c.no).padStart(2, '0');
    els.resultDesc.textContent = c.desc;
    els.resultGrade.textContent = g.label;
    els.resultStars.innerHTML = starsHtml(g.stars);
    els.cardBack.querySelector('.back-grade').textContent = g.label;
    els.cardBack.querySelector('.back-stars').innerHTML = starsHtml(g.stars);

    if (got.isNew) {
      els.resultTag.className = 'tag new';
      els.resultTag.textContent = 'NEW!';
    } else {
      els.resultTag.className = 'tag dup';
      els.resultTag.textContent = '이미 보유한 당근 · ' + got.count + '번째';
    }

    buildFx(c.grade);

    els.result.hidden = false;
    els.card.classList.remove('flip'); els.scene.classList.remove('in');
    els.result.classList.remove('on', 'revealed');
    void els.result.offsetWidth; // 애니메이션 리셋

    /* 1) 카드 뒷면 등장 → 2) 뒤집기 → 3) 당근 pop · 텍스트 → 4) RESULT */
    els.result.classList.add('on');
    els.scene.classList.add('in');
    var flipAt = c.grade === 'ultraRare' ? 1250 : c.grade === 'superRare' ? 1050 : 850;
    later(function () { els.card.classList.add('flip'); }, flipAt);
    later(function () { els.result.classList.add('revealed'); }, flipAt + 380);
    later(function () { setState(State.RESULT); }, flipAt + 1200);
  }

  function hideResult(immediate) {
    els.result.classList.remove('on', 'revealed');
    els.card.classList.remove('flip'); els.scene.classList.remove('in');
    els.fx.innerHTML = '';
    els.body.classList.remove('shake');
    if (immediate) els.result.hidden = true;
    else later(function () { els.result.hidden = true; }, 260);
  }

  /* 등급별 연출 요소 (CSS 가 그린다) */
  function buildFx(gradeKey) {
    var fx = els.fx, html = '', i;
    fx.innerHTML = '';
    els.body.classList.remove('shake');
    if (gradeKey === 'common') return;

    var sparkles = gradeKey === 'rare' ? 6 : gradeKey === 'superRare' ? 12 : 18;
    for (i = 0; i < sparkles; i++) {
      var a = (360 / sparkles) * i + Math.random() * 20;
      var d = 120 + Math.random() * 120;
      html += '<i class="sp" style="--a:' + a + 'deg;--d:' + d + 'px;--t:' + (0.9 + Math.random() * 0.9).toFixed(2) + 's;--s:' + (0.6 + Math.random()).toFixed(2) + '"></i>';
    }
    if (gradeKey === 'superRare' || gradeKey === 'ultraRare') html += '<i class="rays"></i>';
    if (gradeKey === 'ultraRare') {
      html += '<i class="flash"></i><i class="rays rays2"></i><b class="ultra-word">ULTRA RARE!</b>';
      var colors = ['#FF99CE', '#FFD166', '#9DD374', '#80B7EB', '#B99AEB', '#EB8484'];
      for (i = 0; i < 36; i++) {
        html += '<i class="confetti" style="--x:' + (Math.random() * 100).toFixed(1) + 'vw;--r:' + (Math.random() * 720 - 360).toFixed(0) + 'deg;--t:' + (2.2 + Math.random() * 1.6).toFixed(2) + 's;--dl:' + (Math.random() * 0.9).toFixed(2) + 's;--c:' + colors[i % colors.length] + ';--w:' + (6 + Math.random() * 8).toFixed(0) + 'px"></i>';
      }
      els.body.classList.add('shake');
    }
    fx.innerHTML = html;
  }

  /* ───────── 도감 ───────── */
  function updateDexBadge() {
    els.dexCount.textContent = ownedCount() + '/' + DATA.carrots.length;
  }
  function renderDex() {
    var total = DATA.carrots.length, have = ownedCount(), html = '';
    DATA.carrots.forEach(function (c) {
      var g = DATA.grades[c.grade], rec = save.owned[c.id];
      html += '<li class="slot' + (rec ? ' got' : ' locked') + ' g-' + c.grade + '" style="--g-color:' + g.color + ';--g-bg:' + g.bg + ';--g-ring:' + g.ring + '">' +
        '<div class="slot-grade">' + g.label + ' <span class="slot-stars">' + starsHtml(g.stars) + '</span></div>' +
        '<div class="slot-img"><img src="' + c.image + '" alt="' + (rec ? c.name : '미획득 당근') + '" loading="lazy"></div>' +
        (rec ? '' : '<div class="slot-lock">???</div>') +
        '<div class="slot-name">' + (rec ? c.name : '???') + '</div>' +
        '<div class="slot-sub">' + (rec ? 'No.' + String(c.no).padStart(2, '0') + ' · ' + rec.count + '개 획득' : '아직 못 만났어요') + '</div>' +
        '</li>';
    });
    els.dexGrid.innerHTML = html;
    els.dexProgressText.textContent = total + '종 중 ' + have + '종 수집';
    els.dexProgressBar.style.width = (have / total * 100) + '%';
    els.dexDraws.textContent = '총 ' + save.draws + '번 뽑음';
  }
  function openDex() { renderDex(); els.dex.hidden = false; void els.dex.offsetWidth; els.dex.classList.add('on'); }
  function closeDex() { els.dex.classList.remove('on'); if (!els.dex.hidden) later(function () { els.dex.hidden = true; }, 220); }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    els.toast.classList.add('on');
    later(function () { els.toast.classList.remove('on'); }, 1600);
    later(function () { els.toast.hidden = true; }, 1900);
  }

  /* ───────── 이벤트 ───────── */
  els.drawBtn.addEventListener('click', function () {
    if (!startDraw()) {
      if (state === State.VIDEO_PLAYING || state === State.DRAWING || state === State.REVEALING) {
        els.drawBtn.classList.remove('nudge'); void els.drawBtn.offsetWidth; els.drawBtn.classList.add('nudge');
      }
    }
  });
  els.againBtn.addEventListener('click', function () { startDraw(); });
  els.okBtn.addEventListener('click', function () { if (state === State.RESULT) { hideResult(false); setState(State.IDLE); } });
  els.resultDexBtn.addEventListener('click', function () { if (state === State.RESULT) { hideResult(false); setState(State.IDLE); openDex(); } });
  els.dexBtn.addEventListener('click', function () { if (els.dex.hidden) openDex(); else closeDex(); });
  els.dexClose.addEventListener('click', closeDex);
  els.dex.addEventListener('click', function (e) { if (e.target === els.dex) closeDex(); });
  els.dexReset.addEventListener('click', function () {
    if (!confirm('도감을 초기화할까요? 획득한 당근 기록이 모두 지워져요.')) return;
    save = { owned: {}, draws: 0, history: [] };
    persist(); updateDexBadge(); renderDex(); toast('도감을 초기화했어요');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDex(); if (state === State.RESULT) { hideResult(false); setState(State.IDLE); } }
  });

  els.video.addEventListener('ended', onVideoEnded);
  els.video.addEventListener('error', function () { if (state === State.VIDEO_PLAYING || state === State.DRAWING) onVideoEnded(); });
  els.video.src = DATA.video;
  els.video.load();

  /* 이미지 프리로드 — 결과 카드에서 첫 표시가 늦지 않게 */
  DATA.carrots.forEach(function (c) { var im = new Image(); im.src = c.image; });

  updateDexBadge();
  setState(State.IDLE);

  /* 콘솔 테스트용 API */
  window.pochiGacha = {
    get state() { return state; },
    draw: function (force) { return startDraw(force); },
    save: function () { return save; },
    reset: function () { save = { owned: {}, draws: 0, history: [] }; persist(); updateDexBadge(); }
  };
})();
