/* 冷锋甬道 / Fahrenheit Fracture — interactions */
(() => {
  "use strict";

  const theater = document.getElementById("theater");
  const chapters = [...document.querySelectorAll(".ch")];
  const magBtns = [...document.querySelectorAll(".mag-btn")];
  const hudCh = document.getElementById("hudCh");
  const hudTemp = document.getElementById("hudTemp");
  const btnSound = document.getElementById("btnSound");
  const btnFilter = document.getElementById("btnFilter");
  const btnEnter = document.getElementById("btnEnter");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnTop = document.getElementById("btnTop");
  const tempDial = document.getElementById("tempDial");
  const tempReadout = document.getElementById("tempReadout");
  const frostCanvas = document.getElementById("frostCanvas");
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbCap = document.getElementById("lbCap");
  const lbClose = document.getElementById("lbClose");
  const poll = document.getElementById("poll");
  const pollResult = document.getElementById("pollResult");

  let current = 0;
  let soundOn = false;
  let audioCtx = null;
  let snapLock = false;
  let filterOn = false;

  /* ---- Frost particles ---- */
  const frost = (() => {
    const ctx = frostCanvas.getContext("2d");
    let w, h, particles, raf;
    function resize() {
      w = frostCanvas.width = window.innerWidth;
      h = frostCanvas.height = window.innerHeight;
      const n = Math.min(90, Math.floor((w * h) / 18000));
      particles = Array.from({ length: n }, () => spawn());
    }
    function spawn() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.8,
        vy: 0.15 + Math.random() * 0.55,
        vx: -0.2 + Math.random() * 0.4,
        a: 0.15 + Math.random() * 0.45,
        spin: Math.random() * Math.PI * 2,
      };
    }
    function tick() {
      ctx.clearRect(0, 0, w, h);
      const warm = parseFloat(getComputedStyle(document.body).getPropertyValue("--temp-warm")) || 0;
      const density = 1 - warm * 0.7;
      for (const p of particles) {
        p.y += p.vy * density;
        p.x += p.vx + Math.sin(p.spin) * 0.15;
        p.spin += 0.02;
        if (p.y > h + 4) { Object.assign(p, spawn()); p.y = -4; }
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        ctx.beginPath();
        ctx.fillStyle = `rgba(200, 230, 255, ${p.a * density})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // tiny crystal cross
        if (p.r > 1.2) {
          ctx.strokeStyle = `rgba(220, 240, 255, ${p.a * 0.5 * density})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x - p.r, p.y);
          ctx.lineTo(p.x + p.r, p.y);
          ctx.moveTo(p.x, p.y - p.r);
          ctx.lineTo(p.x, p.y + p.r);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      resize();
      window.addEventListener("resize", resize);
      tick();
    }
    return { start };
  })();
  frost.start();

  /* ---- Sound (muted default) ---- */
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }
  function beep(freq = 220, dur = 0.07, type = "sine", gain = 0.03) {
    if (!soundOn || !audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  }
  function hallClick() {
    beep(180, 0.05, "triangle", 0.025);
    setTimeout(() => beep(90, 0.08, "sine", 0.02), 30);
  }
  function stampSound() {
    beep(80, 0.04, "square", 0.04);
    setTimeout(() => beep(60, 0.1, "sawtooth", 0.03), 40);
  }

  btnSound.addEventListener("click", () => {
    soundOn = !soundOn;
    btnSound.setAttribute("aria-pressed", String(soundOn));
    btnSound.textContent = soundOn ? "🔊 ON" : "🔇 MUTE";
    if (soundOn) { ensureAudio(); beep(440, 0.05); }
  });

  /* ---- Filter verified-only ---- */
  btnFilter.addEventListener("click", () => {
    filterOn = !filterOn;
    document.body.classList.toggle("filter-verified", filterOn);
    btnFilter.setAttribute("aria-pressed", String(filterOn));
    btnFilter.textContent = filterOn ? "FILTER: 实录" : "FILTER: ALL";
    hallClick();
  });

  /* ---- Temperature dial ---- */
  function applyTemp(v) {
    // v 0..100 → map to hue/warmth + readout
    const warm = v / 100;
    document.body.style.setProperty("--temp-warm", warm.toFixed(3));
    const hue = 210 - warm * 195; // 210 blue → 15 orange
    const sat = 30 + warm * 30;
    document.body.style.setProperty("--temp-hue", hue.toFixed(1));
    document.body.style.setProperty("--temp-sat", sat.toFixed(1) + "%");

    const fApprox = Math.round(0 + (v / 100) * 120);
    hudTemp.textContent = fApprox + "°F";

    let label, mode;
    if (v < 18) { label = "走廊体感 · 冰点 / FREEZE"; mode = "freeze"; }
    else if (v < 35) { label = "走廊体感 · 冷锋主导"; mode = "cold"; }
    else if (v < 50) { label = "走廊体感 · 降温中"; mode = "cooling"; }
    else if (v < 65) { label = "走廊体感 · 中性灰"; mode = "neutral"; }
    else if (v < 82) { label = "走廊体感 · 夏侧渗入"; mode = "warm"; }
    else { label = "走廊体感 · 夏侧高压"; mode = "hot"; }
    tempReadout.textContent = label + " · " + fApprox + "°F";
    document.body.dataset.temp = mode;
    tempDial.setAttribute("aria-valuetext", label);
  }
  tempDial.addEventListener("input", (e) => {
    applyTemp(+e.target.value);
    if (soundOn) beep(120 + +e.target.value, 0.03, "sine", 0.015);
  });
  applyTemp(+tempDial.value);

  /* ---- Magnetic snap navigation ---- */
  function goTo(i, smooth = true) {
    i = Math.max(0, Math.min(chapters.length - 1, i));
    current = i;
    snapLock = true;
    chapters[i].scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    updateUI();
    hallClick();
    setTimeout(() => { snapLock = false; }, 700);
  }

  function updateUI() {
    magBtns.forEach((b, idx) => b.classList.toggle("active", idx === current));
    const ch = chapters[current];
    hudCh.textContent = ch.dataset.ch || "";
    if (ch.dataset.temp) document.body.dataset.temp = ch.dataset.temp;
    btnPrev.disabled = current === 0;
    btnNext.disabled = current === chapters.length - 1;
  }

  magBtns.forEach((b) => b.addEventListener("click", () => goTo(+b.dataset.i)));
  btnEnter.addEventListener("click", () => goTo(1));
  btnPrev.addEventListener("click", () => goTo(current - 1));
  btnNext.addEventListener("click", () => goTo(current + 1));
  btnTop.addEventListener("click", () => goTo(0));

  /* Intersection observer for magnetic chapter state */
  const io = new IntersectionObserver(
    (entries) => {
      if (snapLock) return;
      let best = null, bestRatio = 0;
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          best = e.target;
        }
      }
      if (best) {
        const i = chapters.indexOf(best);
        if (i >= 0 && i !== current) {
          current = i;
          updateUI();
        }
      }
    },
    { root: theater, threshold: [0.35, 0.55, 0.7] }
  );
  chapters.forEach((c) => io.observe(c));

  /* Parallax corridor on scroll */
  theater.addEventListener(
    "scroll",
    () => {
      const max = theater.scrollHeight - theater.clientHeight;
      const t = max > 0 ? theater.scrollTop / max : 0;
      document.documentElement.style.setProperty("--corridor-shift", (t * 80 - 20) + "px");
    },
    { passive: true }
  );

  /* Keyboard */
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
      e.preventDefault();
      goTo(current + 1);
    } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
      e.preventDefault();
      goTo(current - 1);
    } else if (e.key === "Escape" && !lightbox.hidden) {
      closeLb();
    }
  });

  /* ---- Stamp receipts ---- */
  document.querySelectorAll(".receipt").forEach((el) => {
    el.addEventListener("click", () => {
      el.classList.add("stamped");
      stampSound();
      // brief screen flash via halogen
      document.body.style.setProperty("--halogen-glow", "rgba(255, 80, 80, 0.22)");
      setTimeout(() => document.body.style.removeProperty("--halogen-glow"), 350);
    });
  });

  /* ---- Lightbox ---- */
  function openLb(src, cap) {
    lbImg.src = src;
    lbImg.alt = cap || "";
    lbCap.textContent = cap || "";
    lightbox.hidden = false;
    hallClick();
  }
  function closeLb() {
    lightbox.hidden = true;
    lbImg.src = "";
  }
  document.querySelectorAll("[data-lightbox]").forEach((fig) => {
    fig.addEventListener("click", () => {
      const img = fig.querySelector("img");
      if (!img) return;
      openLb(img.src, fig.dataset.cap || fig.querySelector("figcaption")?.textContent || "");
    });
  });
  lbClose.addEventListener("click", closeLb);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLb();
  });

  /* ---- Quote vault tap ---- */
  document.querySelectorAll(".vault-card").forEach((card) => {
    card.addEventListener("click", () => {
      card.classList.toggle("open");
      hallClick();
      // mini stamp feel
      card.style.outline = "1px solid rgba(110,182,255,0.5)";
      setTimeout(() => { card.style.outline = ""; }, 400);
    });
  });

  /* ---- Poll (local only) ---- */
  const POLL_KEY = "ff-poll-v1";
  const defaults = { estrange: 0, trauma: 0, cp: 0, unclear: 0 };

  function loadPoll() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(POLL_KEY) || "{}") };
    } catch {
      return { ...defaults };
    }
  }
  function savePoll(data) {
    localStorage.setItem(POLL_KEY, JSON.stringify(data));
  }
  function renderPoll(data, chosen) {
    const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
    poll.querySelectorAll(".poll-opt").forEach((btn) => {
      const v = btn.dataset.val;
      const pct = Math.round((data[v] / total) * 100);
      btn.querySelector(".bar").style.width = pct + "%";
      btn.querySelector(".pct").textContent = pct + "%";
      btn.classList.toggle("chosen", v === chosen);
    });
    pollResult.hidden = false;
    pollResult.textContent = "已记录本地一票 · 合计 " + total + "（仅本机）";
  }

  const myVote = localStorage.getItem(POLL_KEY + "-mine");
  if (myVote) renderPoll(loadPoll(), myVote);

  poll.querySelectorAll(".poll-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (localStorage.getItem(POLL_KEY + "-mine")) {
        renderPoll(loadPoll(), localStorage.getItem(POLL_KEY + "-mine"));
        return;
      }
      const data = loadPoll();
      data[btn.dataset.val] = (data[btn.dataset.val] || 0) + 1;
      savePoll(data);
      localStorage.setItem(POLL_KEY + "-mine", btn.dataset.val);
      renderPoll(data, btn.dataset.val);
      hallClick();
    });
  });

  /* ---- Dual wall swipe hint on touch ---- */
  document.querySelectorAll(".dual-walls").forEach((wall) => {
    let startX = 0;
    wall.addEventListener(
      "touchstart",
      (e) => { startX = e.touches[0].clientX; },
      { passive: true }
    );
    wall.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) hallClick();
      },
      { passive: true }
    );
  });

  /* ---- Erased seat click ---- */
  document.querySelectorAll(".seat.erased").forEach((seat) => {
    seat.addEventListener("click", () => {
      seat.classList.add("flash");
      stampSound();
      seat.querySelector(".x-mark").style.opacity = "0.9";
      setTimeout(() => { seat.querySelector(".x-mark").style.opacity = ""; }, 600);
    });
  });

  /* Boot */
  updateUI();
})();
