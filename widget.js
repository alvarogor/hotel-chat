(function () {
  // Auto-detect the server URL from where this script is loaded
  const scriptTag = document.currentScript;
  const SERVER_URL = scriptTag.src.replace(/\/widget\.js.*$/, "");

  // ── Inject styles ────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #ai-recep-bubble {
      position: fixed; bottom: 20px; right: 20px;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #c98a8a, #e0a8a0);
      box-shadow: 0 4px 16px rgba(150,90,90,0.35);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 999998; border: none;
      transition: transform 0.2s;
      font-size: 26px;
    }
    #ai-recep-bubble:hover { transform: scale(1.08); }
    #ai-recep-frame-wrap {
      position: fixed; bottom: 92px; right: 20px;
      width: 380px; height: 600px; max-height: 80vh;
      border-radius: 16px; overflow: hidden;
      box-shadow: 0 12px 48px rgba(0,0,0,0.25);
      z-index: 999999; display: none;
      border: none;
    }
    #ai-recep-frame-wrap.open { display: block; }
    #ai-recep-frame { width: 100%; height: 100%; border: none; }
    @media (max-width: 480px) {
      #ai-recep-frame-wrap { width: 100vw; height: 100vh; max-height: 100vh; bottom: 0; right: 0; border-radius: 0; }
    }
  `;
  document.head.appendChild(style);

  // ── Bubble button ────────────────────────────────────────────────────────
  const bubble = document.createElement("button");
  bubble.id = "ai-recep-bubble";
  bubble.innerHTML = "💬";
  bubble.setAttribute("aria-label", "Abrir chat de asistencia");
  document.body.appendChild(bubble);

  // ── Chat iframe (loads the existing chat page) ──────────────────────────
  const frameWrap = document.createElement("div");
  frameWrap.id = "ai-recep-frame-wrap";
  frameWrap.innerHTML = `<iframe id="ai-recep-frame" src="${SERVER_URL}/index.html"></iframe>`;
  document.body.appendChild(frameWrap);

  let open = false;
  bubble.addEventListener("click", () => {
    open = !open;
    frameWrap.classList.toggle("open", open);
    bubble.innerHTML = open ? "✕" : "💬";
  });
})();
