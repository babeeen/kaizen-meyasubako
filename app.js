/* ============================================================
   カイゼン目安箱 — app.js
   投稿・共感・追記は localStorage に保存（デモ用）
   ============================================================ */

(() => {
  "use strict";

  // シードデータ更新時はバージョンを上げると保存済みデータがリセットされる
  const LS_POSTS = "meyasubako.posts.v2";
  const LS_VOTES = "meyasubako.votes.v2";

  /* ---------- state ---------- */
  const state = {
    posts: loadPosts(),
    votedIds: new Set(JSON.parse(localStorage.getItem(LS_VOTES) || "[]")),
    org: "すべて",
    category: "すべて",
    query: "",
    sort: "new",
  };

  function loadPosts() {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_POSTS) || "null");
      if (Array.isArray(saved) && saved.length) {
        // シードが増えた場合は不足分をマージ
        const ids = new Set(saved.map((p) => p.id));
        SEED_POSTS.forEach((s) => { if (!ids.has(s.id)) saved.push(s); });
        return saved;
      }
    } catch (_) { /* fall through */ }
    return structuredClone(SEED_POSTS);
  }

  function persist() {
    localStorage.setItem(LS_POSTS, JSON.stringify(state.posts));
    localStorage.setItem(LS_VOTES, JSON.stringify([...state.votedIds]));
  }

  /* ---------- helpers ---------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

  const FREQ_WEIGHT = { "毎日": 3, "毎週": 2, "毎月": 1, "随時": 2 };
  const severity = (p) => p.impact * 2 + (FREQ_WEIGHT[p.freq] || 1);
  const isSevere = (p) => severity(p) >= 8; // 影響:大 × 毎日/随時

  const IMPACT_LABEL = { 1: "小", 2: "中", 3: "大" };

  function fmtDate(iso) {
    const [y, m, d] = iso.split("-");
    return `${y}.${m}.${d}`;
  }

  function postNo(post) {
    const idx = state.posts.findIndex((p) => p.id === post.id);
    return String(state.posts.length - idx).padStart(4, "0");
  }

  function stampHtml(status, large = false) {
    const meta = STATUS_META[status] || STATUS_META["受付"];
    const cls = ["stamp", meta.tone !== "shu" ? meta.tone : "", large ? "lg" : ""].join(" ").trim();
    return `<span class="${cls}" title="ステータス：${meta.label}">${meta.label}</span>`;
  }

  /* ---------- filtering ---------- */
  function visiblePosts() {
    let list = state.posts.filter((p) => {
      if (state.org !== "すべて" && p.org !== state.org) return false;
      if (state.category !== "すべて" && p.category !== state.category) return false;
      if (state.query) {
        const q = state.query.toLowerCase();
        const hay = [p.title, p.current, p.pain, p.hope, p.dept, p.org, p.category].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (state.sort === "votes") list.sort((a, b) => b.votes - a.votes || b.date.localeCompare(a.date));
    else if (state.sort === "severe") list.sort((a, b) => severity(b) - severity(a) || b.votes - a.votes);
    else list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }

  /* ---------- render: stats / ticker ---------- */
  function renderStats() {
    $("#statPosts").textContent = state.posts.length;
    $("#statVotes").textContent = state.posts.reduce((n, p) => n + p.votes, 0);
    $("#statSolved").textContent = state.posts.filter((p) => p.status === "解決済").length;
  }

  function renderTicker() {
    const words = state.posts.map((p) => p.title);
    const seq = words.map((w) => `<span>${escapeHtml(w)}</span>`).join("");
    $("#tickerTrack").innerHTML = seq + seq; // seamless loop
  }

  /* ---------- render: toolbar ---------- */
  function renderOrgTabs() {
    const tabs = ["すべて", ...ORGS];
    $("#orgTabs").innerHTML = tabs.map((o) =>
      `<button class="org-tab ${state.org === o ? "active" : ""}" data-org="${o}" role="tab" aria-selected="${state.org === o}">${o}</button>`
    ).join("");
  }

  function renderChips() {
    const counts = {};
    state.posts.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    const chips = ["すべて", ...CATEGORIES];
    $("#catChips").innerHTML = chips.map((c) => {
      const count = c === "すべて" ? state.posts.length : (counts[c] || 0);
      return `<button class="chip ${state.category === c ? "active" : ""}" data-cat="${c}" aria-pressed="${state.category === c}">
        ${c}<span class="chip-count">${count}</span>
      </button>`;
    }).join("");
  }

  /* ---------- render: cards ---------- */
  function renderCards() {
    const list = visiblePosts();
    const wrap = $("#cardList");
    $("#resultCount").textContent = `${list.length}件 / 全${state.posts.length}件`;
    $("#emptyState").hidden = list.length > 0;

    wrap.innerHTML = list.map((p, i) => {
      const voted = state.votedIds.has(p.id);
      const solved = p.status === "解決済" && p.solution;
      return `
      <li class="card" style="--i:${Math.min(i, 12)}" data-id="${p.id}" tabindex="0" role="button"
          aria-label="${escapeHtml(p.title)} 詳細を見る">
        ${stampHtml(p.status)}
        <div class="card-meta-top">
          <span class="card-no">No.${postNo(p)}</span>
          <span class="card-cat">${escapeHtml(p.category)}</span>
          <span class="card-date">${fmtDate(p.date)}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(p.title)}</h3>
          <p class="card-excerpt">${solved
            ? `<span class="excerpt-label">解決</span>${escapeHtml(p.solution)}`
            : escapeHtml(p.pain)}</p>
        </div>
        <div class="card-tags">
          <span class="tag tag-org">${escapeHtml(p.org)}</span>
          <span class="tag">頻度：${escapeHtml(p.freq)}</span>
          <span class="tag">影響：${IMPACT_LABEL[p.impact]}</span>
          ${solved ? `<span class="tag tag-solved">解決事例</span>`
                   : isSevere(p) ? `<span class="tag tag-severe">切実</span>` : ""}
        </div>
        <div class="card-foot">
          <span class="card-dept">${escapeHtml(p.org)}・${escapeHtml(p.dept)}</span>
          <button class="vote-btn ${voted ? "voted" : ""}" data-vote="${p.id}"
                  aria-pressed="${voted}" aria-label="うちも困ってる（共感 ${p.votes}件）">
            <span>${voted ? "共感済" : "うちも困ってる"}</span><span class="vote-count">${p.votes}</span>
          </button>
        </div>
      </li>`;
    }).join("");
  }

  /* ---------- render: detail ---------- */
  let currentDetailId = null;

  function renderDetail(id) {
    const p = state.posts.find((x) => x.id === id);
    if (!p) return;
    currentDetailId = id;
    const voted = state.votedIds.has(p.id);
    const sevDots = [1, 2, 3].map((n) =>
      `<span class="${n <= p.impact ? "" : "off"}">●</span>`
    ).join("");

    $("#detailBody").innerHTML = `
      <header class="sheet-head">
        <p class="sheet-form-no mono">受付番号 No.${postNo(p)} ／ ${fmtDate(p.date)} 受付</p>
        <div class="detail-top">
          <h2 class="sheet-title" id="detailTitle">${escapeHtml(p.title)}</h2>
          ${stampHtml(p.status, true)}
        </div>
      </header>

      <table class="detail-meta-table">
        <tr><th>組織</th><td>${escapeHtml(p.org)}</td><th>部署・現場</th><td>${escapeHtml(p.dept)}</td></tr>
        <tr><th>カテゴリ</th><td>${escapeHtml(p.category)}</td><th>投書者</th><td>${escapeHtml(p.author || "匿名")}</td></tr>
        <tr><th>発生頻度</th><td>${escapeHtml(p.freq)}</td>
            <th>業務への影響</th><td><span class="severe-dots">${sevDots}</span>（${IMPACT_LABEL[p.impact]}）</td></tr>
      </table>

      <section class="detail-section">
        <h3>現状のやり方</h3>
        <p>${escapeHtml(p.current)}</p>
      </section>
      <section class="detail-section">
        <h3>何がつらいか</h3>
        <p>${escapeHtml(p.pain)}</p>
      </section>
      ${p.hope ? `
      <section class="detail-section hope">
        <h3>こうなったら最高</h3>
        <p>${escapeHtml(p.hope)}</p>
      </section>` : ""}
      ${p.solution ? `
      <section class="detail-section solved">
        <h3>どう解決したか</h3>
        <p>${escapeHtml(p.solution)}</p>
      </section>` : ""}

      <div class="detail-vote-row">
        <button class="vote-btn ${voted ? "voted" : ""}" data-vote="${p.id}" aria-pressed="${voted}">
          <span>${voted ? "共感済" : "うちも困ってる"}</span><span class="vote-count">${p.votes}</span>
        </button>
        <span class="detail-vote-note">同じ課題を抱えていたら、押して開発者に切実さを伝えてください。</span>
      </div>

      <section class="comments">
        <h3 class="comments-title">現場からの追記（${p.comments.length}）</h3>
        ${p.comments.length
          ? p.comments.map((c) => `
            <div class="comment">
              <div class="comment-meta"><span>${escapeHtml(c.author || "匿名")}</span><span class="mono">${fmtDate(c.date)}</span></div>
              <p class="comment-text">${escapeHtml(c.text)}</p>
            </div>`).join("")
          : `<p class="comment-empty">まだ追記はありません。現場の補足情報や「うちではこう回避している」を歓迎します。</p>`}
        <form class="comment-form" id="commentForm">
          <input type="text" class="c-author" name="author" placeholder="お名前（任意）" maxlength="30">
          <input type="text" class="c-text" name="text" placeholder="補足・類似事例・回避策など" required maxlength="200">
          <button type="submit">追記する</button>
        </form>
      </section>
    `;

    $("#commentForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const text = String(fd.get("text") || "").trim();
      if (!text) return;
      p.comments.push({
        author: String(fd.get("author") || "").trim() || "匿名",
        date: new Date().toISOString().slice(0, 10),
        text,
      });
      persist();
      renderDetail(p.id);
      toast("追記を受け付けました");
    });

    openModal("#detailModal");
  }

  /* ---------- modal ---------- */
  let lastFocus = null;

  function openModal(sel) {
    lastFocus = document.activeElement;
    const m = $(sel);
    m.hidden = false;
    document.body.style.overflow = "hidden";
    const focusable = m.querySelector("input, select, textarea, button:not(.sheet-close)");
    (focusable || m.querySelector(".sheet-close"))?.focus({ preventScroll: true });
    m.querySelector(".sheet")?.scrollTo(0, 0);
  }

  function closeModals() {
    $$(".modal").forEach((m) => { m.hidden = true; });
    document.body.style.overflow = "";
    currentDetailId = null;
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }

  /* ---------- vote ---------- */
  function toggleVote(id, btn) {
    const p = state.posts.find((x) => x.id === id);
    if (!p) return;
    if (state.votedIds.has(id)) {
      state.votedIds.delete(id);
      p.votes = Math.max(0, p.votes - 1);
    } else {
      state.votedIds.add(id);
      p.votes += 1;
      btn?.classList.add("pop");
      setTimeout(() => btn?.classList.remove("pop"), 450);
      toast("切実さ、届けました", true);
    }
    persist();
    renderStats();
    // 表示中の要素だけ更新（一覧全体は崩さない）
    $$(`[data-vote="${CSS.escape(id)}"]`).forEach((b) => {
      const voted = state.votedIds.has(id);
      b.classList.toggle("voted", voted);
      b.setAttribute("aria-pressed", voted);
      b.querySelector("span:first-child").textContent = voted ? "共感済" : "うちも困ってる";
      b.querySelector(".vote-count").textContent = p.votes;
    });
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg, stamp = false) {
    const el = $("#toast");
    el.innerHTML = (stamp ? `<span class="toast-stamp">印</span>` : "") + escapeHtml(msg);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  /* ---------- form ---------- */
  function initForm() {
    $("#formCategory").innerHTML =
      `<option value="">選択してください</option>` +
      CATEGORIES.map((c) => `<option>${c}</option>`).join("");

    $("#postForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target;
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const post = {
        id: "user-" + Date.now(),
        title: String(fd.get("title")).trim(),
        org: String(fd.get("org")),
        dept: String(fd.get("dept")).trim(),
        author: String(fd.get("author") || "").trim() || "匿名",
        category: String(fd.get("category")),
        freq: String(fd.get("freq")),
        impact: Number(fd.get("impact")),
        status: "受付",
        date: new Date().toISOString().slice(0, 10),
        votes: 0,
        current: String(fd.get("current")).trim(),
        pain: String(fd.get("pain")).trim(),
        hope: String(fd.get("hope") || "").trim(),
        comments: [],
      };
      state.posts.unshift(post);
      persist();
      form.reset();
      closeModals();
      // 新着が見えるようにフィルタを緩める
      state.org = "すべて"; state.category = "すべて"; state.query = ""; state.sort = "new";
      $("#searchInput").value = "";
      $("#sortSelect").value = "new";
      renderAll();
      toast("投書を受け付けました。ありがとうございます", true);
      $("#cardList")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ---------- events ---------- */
  function initEvents() {
    // 委譲：カード開閉・共感・タブ・チップ
    document.addEventListener("click", (e) => {
      const voteBtn = e.target.closest("[data-vote]");
      if (voteBtn) {
        e.stopPropagation();
        toggleVote(voteBtn.dataset.vote, voteBtn);
        return;
      }
      const card = e.target.closest(".card[data-id]");
      if (card) { renderDetail(card.dataset.id); return; }

      const orgTab = e.target.closest("[data-org]");
      if (orgTab) { state.org = orgTab.dataset.org; renderOrgTabs(); renderCards(); return; }

      const chip = e.target.closest("[data-cat]");
      if (chip) { state.category = chip.dataset.cat; renderChips(); renderCards(); return; }

      if (e.target.closest("[data-close]")) { closeModals(); return; }
      if (e.target.closest("#openFormBtn") || e.target.closest("[data-open-form]")) { openModal("#formModal"); return; }
      if (e.target.closest("#sortSevereBtn")) {
        state.sort = "severe";
        $("#sortSelect").value = "severe";
        renderCards();
        $("#cardList")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    // キーボードでカードを開く
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeModals(); return; }
      if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("card")) {
        e.preventDefault();
        renderDetail(e.target.dataset.id);
      }
    });

    $("#searchInput").addEventListener("input", (e) => {
      state.query = e.target.value.trim();
      renderCards();
    });
    $("#sortSelect").addEventListener("change", (e) => {
      state.sort = e.target.value;
      renderCards();
    });
  }

  /* ---------- boot ---------- */
  function renderAll() {
    renderStats();
    renderTicker();
    renderOrgTabs();
    renderChips();
    renderCards();
  }

  const now = new Date();
  $("#todayLabel").textContent =
    `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;

  initForm();
  initEvents();
  renderAll();
})();
