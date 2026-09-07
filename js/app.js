/* app.js — view rendering, routing, and event wiring. */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const content = $("#content");
  const viewTitle = $("#viewTitle");
  const TITLES = { dashboard: "Dashboard", roadmap: "Roadmap", tasks: "Tasks", agent: "AI Mentor", settings: "Settings" };

  let currentView = "dashboard";

  // ---------- Helpers ----------
  function toast(msg, kind = "ok") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "toast toast-" + kind;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.hidden = true), 2600);
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((d - now) / 86400000);
  }

  function deadlineLabel(dateStr) {
    const n = daysUntil(dateStr);
    if (n === null) return "";
    if (n < 0) return `${-n}d overdue`;
    if (n === 0) return "Due today";
    if (n === 1) return "Due tomorrow";
    return `${n}d left`;
  }

  const TRACK_LABEL = { cpp: "C++", ai: "AI Agents", general: "General" };

  // Only allow safe http/https links; normalize scheme-less URLs.
  function sanitizeUrl(raw) {
    const url = String(raw || "").trim();
    if (!url) return null;
    let candidate = url;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) candidate = "https://" + candidate;
    try {
      const u = new URL(candidate);
      if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    } catch (_) { /* invalid */ }
    return null;
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (_) { return url; }
  }

  // ---------- Router ----------
  function navigate(view) {
    currentView = view;
    viewTitle.textContent = TITLES[view] || view;
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    render();
    $("#sidebar").classList.remove("open");
  }

  function render() {
    switch (currentView) {
      case "dashboard": return renderDashboard();
      case "roadmap": return renderRoadmap();
      case "tasks": return renderTasks();
      case "agent": return renderAgent();
      case "settings": return renderSettings();
    }
  }

  // ---------- Dashboard ----------
  function renderDashboard() {
    const tasks = Store.getTasks();
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const doing = tasks.filter((t) => t.status === "doing").length;
    const overdue = tasks.filter((t) => t.status !== "done" && daysUntil(t.deadline) < 0).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const trackProgress = (track) => {
      const list = tasks.filter((t) => t.track === track);
      const d = list.filter((t) => t.status === "done").length;
      return { total: list.length, done: d, pct: list.length ? Math.round((d / list.length) * 100) : 0 };
    };
    const cpp = trackProgress("cpp");
    const ai = trackProgress("ai");

    const upcoming = tasks
      .filter((t) => t.status !== "done" && t.deadline)
      .sort((a, b) => (a.deadline > b.deadline ? 1 : -1))
      .slice(0, 5);

    content.innerHTML = `
      <div class="grid stats">
        ${statCard("📋", "Total tasks", total)}
        ${statCard("🚧", "In progress", doing)}
        ${statCard("✅", "Completed", done)}
        ${statCard("⏰", "Overdue", overdue, overdue ? "danger" : "")}
      </div>

      <div class="grid two">
        <div class="card">
          <h3>Overall progress</h3>
          ${progressBar(pct)}
          <p class="muted">${done} of ${total} tasks done</p>
          <div class="track-progress">
            <div><span class="tag tag-cpp">C++</span> ${progressBar(cpp.pct)} <small>${cpp.done}/${cpp.total}</small></div>
            <div><span class="tag tag-ai">AI Agents</span> ${progressBar(ai.pct)} <small>${ai.done}/${ai.total}</small></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head">
            <h3>Upcoming deadlines</h3>
            <button class="link-btn" data-goto="tasks">View all →</button>
          </div>
          ${upcoming.length ? `<ul class="mini-list">${upcoming.map((t) => `
            <li>
              <span class="tag tag-${t.track}">${TRACK_LABEL[t.track]}</span>
              <span class="mini-title">${esc(t.title)}</span>
              <span class="deadline ${daysUntil(t.deadline) < 0 ? "overdue" : ""}">${deadlineLabel(t.deadline)}</span>
            </li>`).join("")}</ul>` : `<p class="muted">No upcoming deadlines. 🎉</p>`}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h3>Your execution plan</h3>
          <button class="link-btn" data-goto="roadmap">Open roadmap →</button>
        </div>
        <p class="muted">A 24-week path to expert-level C++ and AI-agent development. Track your milestones in the Roadmap tab and turn them into dated tasks.</p>
        <div class="cta-row">
          <button class="primary-btn" data-goto="agent">🤖 Ask your AI Mentor</button>
          <button class="ghost-btn" id="quickAddTask">＋ Quick add task</button>
        </div>
      </div>
    `;

    $$("[data-goto]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.goto)));
    $("#quickAddTask")?.addEventListener("click", () => openTaskModal());
  }

  function statCard(icon, label, value, kind = "") {
    return `<div class="card stat ${kind}"><div class="stat-icon">${icon}</div><div><strong>${value}</strong><small>${label}</small></div></div>`;
  }
  function progressBar(pct) {
    return `<div class="progress"><div class="progress-fill" style="width:${pct}%"></div><span class="progress-label">${pct}%</span></div>`;
  }

  // ---------- Roadmap ----------
  function renderRoadmap() {
    const roadmap = Store.getRoadmap();
    content.innerHTML = `
      <div class="section-head">
        <p class="muted">Your phased plan. Click any text to edit. Add milestones or convert them into dated tasks.</p>
        <button class="primary-btn" id="addPhase">＋ Add phase</button>
      </div>
      <div class="roadmap">
        ${roadmap.map((p) => `
          <div class="card phase" data-phase="${p.id}">
            <div class="phase-head">
              <h3 class="editable" contenteditable data-field="title" data-phase="${p.id}">${esc(p.title)}</h3>
              <button class="icon-btn danger" data-del-phase="${p.id}" title="Delete phase">🗑️</button>
            </div>
            <p class="phase-goal editable" contenteditable data-field="goal" data-phase="${p.id}">${esc(p.goal)}</p>
            <ul class="milestones">
              ${p.milestones.map((m, i) => `
                <li>
                  <span class="tag tag-${m.track}">${TRACK_LABEL[m.track] || m.track}</span>
                  <span class="ms-text editable" contenteditable data-ms-phase="${p.id}" data-ms-index="${i}">${esc(m.text)}</span>
                  <span class="ms-actions">
                    <button class="icon-btn" title="Make task" data-ms-task="${p.id}:${i}">📌</button>
                    <button class="icon-btn danger" title="Delete" data-ms-del="${p.id}:${i}">✕</button>
                  </span>
                </li>`).join("")}
            </ul>
            <div class="add-ms">
              <select data-ms-track="${p.id}">
                <option value="cpp">C++</option>
                <option value="ai">AI Agents</option>
                <option value="general">General</option>
              </select>
              <input type="text" placeholder="New milestone…" data-ms-input="${p.id}" />
              <button class="ghost-btn" data-ms-add="${p.id}">Add</button>
            </div>
          </div>`).join("")}
      </div>
    `;

    // Editable text (title/goal)
    $$(".editable[data-field]").forEach((el) => {
      el.addEventListener("blur", () => {
        Store.updatePhase(el.dataset.phase, { [el.dataset.field]: el.textContent.trim() });
      });
    });
    // Editable milestone text
    $$(".ms-text.editable").forEach((el) => {
      el.addEventListener("blur", () => {
        Store.updateMilestone(el.dataset.msPhase, Number(el.dataset.msIndex), { text: el.textContent.trim() });
      });
    });
    // Add milestone
    $$("[data-ms-add]").forEach((btn) => btn.addEventListener("click", () => {
      const pid = btn.dataset.msAdd;
      const input = $(`[data-ms-input="${pid}"]`);
      const track = $(`[data-ms-track="${pid}"]`).value;
      const text = input.value.trim();
      if (!text) return;
      Store.addMilestone(pid, { track, text });
      renderRoadmap();
    }));
    // Milestone → task
    $$("[data-ms-task]").forEach((btn) => btn.addEventListener("click", () => {
      const [pid, idx] = btn.dataset.msTask.split(":");
      const phase = Store.getRoadmap().find((x) => x.id === pid);
      const m = phase.milestones[Number(idx)];
      openTaskModal({ title: m.text, track: m.track, notes: "From roadmap: " + phase.title });
    }));
    // Delete milestone / phase
    $$("[data-ms-del]").forEach((btn) => btn.addEventListener("click", () => {
      const [pid, idx] = btn.dataset.msDel.split(":");
      Store.deleteMilestone(pid, Number(idx));
      renderRoadmap();
    }));
    $$("[data-del-phase]").forEach((btn) => btn.addEventListener("click", () => {
      if (confirm("Delete this entire phase?")) { Store.deletePhase(btn.dataset.delPhase); renderRoadmap(); }
    }));
    $("#addPhase").addEventListener("click", () => { Store.addPhase(); renderRoadmap(); });
  }

  // ---------- Tasks ----------
  let taskFilter = { track: "all", status: "all" };

  function renderTasks() {
    const all = Store.getTasks();
    const tasks = all.filter((t) =>
      (taskFilter.track === "all" || t.track === taskFilter.track) &&
      (taskFilter.status === "all" || t.status === taskFilter.status)
    ).sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      return (rank[a.priority] - rank[b.priority]) || ((a.deadline || "9") > (b.deadline || "9") ? 1 : -1);
    });

    content.innerHTML = `
      <div class="section-head">
        <div class="filters">
          <select id="filterTrack">
            <option value="all">All tracks</option>
            <option value="cpp">C++</option>
            <option value="ai">AI Agents</option>
            <option value="general">General</option>
          </select>
          <select id="filterStatus">
            <option value="all">All status</option>
            <option value="todo">To Do</option>
            <option value="doing">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <button class="primary-btn" id="addTask">＋ New task</button>
      </div>
      ${tasks.length ? `<div class="task-list">${tasks.map(taskRow).join("")}</div>`
        : `<div class="empty">No tasks match. <button class="link-btn" id="addTask2">Add one</button>.</div>`}
    `;

    $("#filterTrack").value = taskFilter.track;
    $("#filterStatus").value = taskFilter.status;
    $("#filterTrack").addEventListener("change", (e) => { taskFilter.track = e.target.value; renderTasks(); });
    $("#filterStatus").addEventListener("change", (e) => { taskFilter.status = e.target.value; renderTasks(); });
    $("#addTask")?.addEventListener("click", () => openTaskModal());
    $("#addTask2")?.addEventListener("click", () => openTaskModal());

    $$("[data-task-status]").forEach((sel) => sel.addEventListener("change", (e) => {
      Store.setTaskStatus(sel.dataset.taskStatus, e.target.value);
      renderTasks();
    }));
    $$("[data-edit-task]").forEach((btn) => btn.addEventListener("click", () => {
      const t = Store.getTasks().find((x) => x.id === btn.dataset.editTask);
      openTaskModal(t);
    }));
    $$("[data-del-task]").forEach((btn) => btn.addEventListener("click", () => {
      if (confirm("Delete this task?")) { Store.deleteTask(btn.dataset.delTask); renderTasks(); }
    }));
  }

  function taskRow(t) {
    const overdue = t.status !== "done" && daysUntil(t.deadline) < 0;
    return `
      <div class="task ${t.status === "done" ? "is-done" : ""}">
        <div class="task-main">
          <div class="task-top">
            <span class="tag tag-${t.track}">${TRACK_LABEL[t.track]}</span>
            <span class="prio prio-${t.priority}">${t.priority}</span>
            ${t.deadline ? `<span class="deadline ${overdue ? "overdue" : ""}">📅 ${deadlineLabel(t.deadline)}</span>` : ""}
          </div>
          <h4>${esc(t.title)}</h4>
          ${t.notes ? `<p class="task-notes">${esc(t.notes)}</p>` : ""}
          ${renderTaskLinks(t.links)}
        </div>
        <div class="task-side">
          <select data-task-status="${t.id}" class="status-select status-${t.status}">
            <option value="todo" ${t.status === "todo" ? "selected" : ""}>To Do</option>
            <option value="doing" ${t.status === "doing" ? "selected" : ""}>In Progress</option>
            <option value="done" ${t.status === "done" ? "selected" : ""}>Done</option>
          </select>
          <div class="task-btns">
            <button class="icon-btn" data-edit-task="${t.id}" title="Edit">✏️</button>
            <button class="icon-btn danger" data-del-task="${t.id}" title="Delete">🗑️</button>
          </div>
        </div>
      </div>`;
  }

  function renderTaskLinks(links) {
    const valid = (links || []).map((l) => ({ ...l, url: sanitizeUrl(l.url) })).filter((l) => l.url);
    if (!valid.length) return "";
    return `<div class="task-links">${valid.map((l) =>
      `<a class="task-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(l.label || hostOf(l.url))}</a>`
    ).join("")}</div>`;
  }

  // ---------- Task modal ----------
  function openTaskModal(task = null) {
    const m = $("#taskModal");
    $("#taskModalTitle").textContent = task && task.id ? "Edit Task" : "New Task";
    $("#taskId").value = task?.id || "";
    $("#taskTitle").value = task?.title || "";
    $("#taskNotes").value = task?.notes || "";
    $("#taskTrack").value = task?.track || "cpp";
    $("#taskPriority").value = task?.priority || "medium";
    $("#taskStatus").value = task?.status || "todo";
    $("#taskDeadline").value = task?.deadline || "";
    renderLinkRows(task?.links || []);
    m.hidden = false;
    setTimeout(() => $("#taskTitle").focus(), 30);
  }

  function renderLinkRows(links) {
    const wrap = $("#taskLinks");
    const rows = links.length ? links : [];
    wrap.innerHTML = rows.map(linkRowHtml).join("");
    if (!rows.length) addLinkRow();
    bindLinkRowRemovers();
  }

  function linkRowHtml(link = { label: "", url: "" }) {
    return `<div class="link-row">
      <input type="text" class="link-label" placeholder="Label (optional)" value="${esc(link.label || "")}" />
      <input type="url" class="link-url" placeholder="https://…" value="${esc(link.url || "")}" />
      <button type="button" class="icon-btn danger remove-link" title="Remove">✕</button>
    </div>`;
  }

  function addLinkRow() {
    const wrap = $("#taskLinks");
    wrap.insertAdjacentHTML("beforeend", linkRowHtml());
    bindLinkRowRemovers();
  }

  function bindLinkRowRemovers() {
    $$("#taskLinks .remove-link").forEach((b) => {
      b.onclick = () => {
        b.closest(".link-row").remove();
        if (!$$("#taskLinks .link-row").length) addLinkRow();
      };
    });
  }

  function collectLinks() {
    return $$("#taskLinks .link-row").map((row) => ({
      label: row.querySelector(".link-label").value.trim(),
      url: row.querySelector(".link-url").value.trim()
    })).filter((l) => sanitizeUrl(l.url));
  }

  $("#taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const task = {
      id: $("#taskId").value || undefined,
      title: $("#taskTitle").value.trim(),
      notes: $("#taskNotes").value.trim(),
      track: $("#taskTrack").value,
      priority: $("#taskPriority").value,
      status: $("#taskStatus").value,
      deadline: $("#taskDeadline").value,
      links: collectLinks()
    };
    if (!task.title) return;
    Store.upsertTask(task);
    closeModals();
    toast("Task saved");
    if (currentView === "tasks") renderTasks();
    if (currentView === "dashboard") renderDashboard();
  });

  $("#addLinkRow").addEventListener("click", addLinkRow);

  // ---------- AI Mentor ----------
  function renderAgent() {
    const chat = Store.getChat();
    const tools = Store.getTools();
    const hasKey = !!Store.getSettings().apiKey;

    content.innerHTML = `
      <div class="agent-layout">
        <div class="card chat-card">
          <div class="card-head">
            <h3>🤖 AI Mentor <small class="muted">${esc(Store.getSettings().model)}</small></h3>
            <button class="link-btn" id="clearChat">Clear chat</button>
          </div>
          ${hasKey ? "" : `<div class="banner warn">Add your Gemini API key in <button class="link-btn" data-goto="settings">Settings</button> to start chatting.</div>`}
          <div class="tool-chips" id="toolChips">
            <span class="chips-label">Tools for this chat:</span>
            ${tools.length ? tools.map((t) =>
              `<button type="button" class="chip ${t.enabled ? "on" : ""}" data-chip="${t.id}" title="${esc(t.instruction)}">${t.enabled ? "✓ " : ""}${esc(t.name)}</button>`
            ).join("") : `<span class="muted small">No tools yet — add one →</span>`}
          </div>
          <div class="chat-window" id="chatWindow">
            ${chat.length ? chat.map(msgBubble).join("") : `<div class="empty small">Ask about C++, AI agents, or your plan. Try: “Give me a week-1 study plan for C++ concurrency.”</div>`}
          </div>
          <form class="chat-input" id="chatForm">
            <textarea id="chatText" rows="1" placeholder="Message your mentor…" ${hasKey ? "" : "disabled"}></textarea>
            <button class="primary-btn" id="sendBtn" ${hasKey ? "" : "disabled"}>Send</button>
          </form>
        </div>

        <div class="card tools-card">
          <div class="card-head">
            <h3>🛠️ Agent Tools</h3>
            <button class="ghost-btn" id="addTool">＋ Tool</button>
          </div>
          <p class="muted small">Toggle tools to shape how the mentor answers. Add your own to make it respond your way.</p>
          <div class="tool-list">
            ${tools.map(toolRow).join("")}
          </div>
        </div>
      </div>
    `;

    $$("[data-goto]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.goto)));
    $("#clearChat").addEventListener("click", () => { if (confirm("Clear conversation?")) { Store.clearChat(); renderAgent(); } });
    $("#addTool")?.addEventListener("click", () => openToolModal());

    $$("[data-chip]").forEach((chip) => chip.addEventListener("click", () => {
      Store.toggleTool(chip.dataset.chip);
      renderAgent();
    }));

    $$("[data-tool-toggle]").forEach((el) => el.addEventListener("change", () => {
      Store.toggleTool(el.dataset.toolToggle);
      renderAgent();
    }));
    $$("[data-edit-tool]").forEach((b) => b.addEventListener("click", () => {
      const t = Store.getTools().find((x) => x.id === b.dataset.editTool);
      openToolModal(t);
    }));
    $$("[data-del-tool]").forEach((b) => b.addEventListener("click", () => {
      if (confirm("Delete this tool?")) { Store.deleteTool(b.dataset.delTool); renderAgent(); }
    }));

    const chatText = $("#chatText");
    chatText?.addEventListener("input", () => {
      chatText.style.height = "auto";
      chatText.style.height = Math.min(chatText.scrollHeight, 160) + "px";
    });
    chatText?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chatForm").requestSubmit(); }
    });
    $("#chatForm")?.addEventListener("submit", onSend);
    scrollChat();
  }

  function toolRow(t) {
    return `
      <div class="tool">
        <label class="switch">
          <input type="checkbox" data-tool-toggle="${t.id}" ${t.enabled ? "checked" : ""} />
          <span class="slider"></span>
        </label>
        <div class="tool-info">
          <strong>${esc(t.name)}</strong>
          <small>${esc(t.instruction)}</small>
        </div>
        <div class="tool-btns">
          <button class="icon-btn" data-edit-tool="${t.id}" title="Edit">✏️</button>
          <button class="icon-btn danger" data-del-tool="${t.id}" title="Delete">🗑️</button>
        </div>
      </div>`;
  }

  function msgBubble(m) {
    const who = m.role === "user" ? "you" : "mentor";
    return `<div class="bubble ${who}"><div class="bubble-role">${who === "you" ? "You" : "🤖 Mentor"}</div><div class="bubble-text">${renderMarkdown(m.text)}</div></div>`;
  }

  // Minimal, safe markdown: escape first, then apply formatting.
  function renderMarkdown(text) {
    let html = esc(text);
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
    html = html.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
    return `<p>${html}</p>`;
  }

  function scrollChat() {
    const w = $("#chatWindow");
    if (w) w.scrollTop = w.scrollHeight;
  }

  async function onSend(e) {
    e.preventDefault();
    const input = $("#chatText");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.style.height = "auto";

    Store.addMessage({ role: "user", text });
    renderAgent();

    const win = $("#chatWindow");
    const typing = document.createElement("div");
    typing.className = "bubble mentor";
    typing.innerHTML = `<div class="bubble-role">🤖 Mentor</div><div class="bubble-text typing"><span></span><span></span><span></span></div>`;
    win.appendChild(typing);
    scrollChat();

    $("#sendBtn").disabled = true;
    try {
      const reply = await Agent.sendMessage(text);
      Store.addMessage({ role: "model", text: reply });
      renderAgent();
    } catch (err) {
      typing.remove();
      Store.addMessage({ role: "model", text: "⚠️ " + err.message });
      renderAgent();
      toast(err.message, "danger");
    }
  }

  // ---------- Tool modal ----------
  function openToolModal(tool = null) {
    $("#toolModalTitle").textContent = tool && tool.id ? "Edit Tool" : "New Tool";
    $("#toolId").value = tool?.id || "";
    $("#toolName").value = tool?.name || "";
    $("#toolInstruction").value = tool?.instruction || "";
    $("#toolModal").hidden = false;
    setTimeout(() => $("#toolName").focus(), 30);
  }

  $("#toolForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const tool = {
      id: $("#toolId").value || undefined,
      name: $("#toolName").value.trim(),
      instruction: $("#toolInstruction").value.trim()
    };
    if (!tool.name || !tool.instruction) return;
    Store.upsertTool(tool);
    closeModals();
    toast("Tool saved");
    if (currentView === "agent") renderAgent();
  });

  // ---------- Settings ----------
  function renderSettings() {
    const s = Store.getSettings();
    content.innerHTML = `
      <div class="card">
        <h3>🔑 Google Gemini API</h3>
        <p class="muted">Your key is stored locally in this browser (localStorage) and sent directly to Google's API. It never touches any other server.</p>
        <label>API key
          <div class="key-row">
            <input type="password" id="apiKey" placeholder="AIza…" value="${esc(s.apiKey)}" />
            <button class="ghost-btn" id="toggleKey" type="button">👁</button>
          </div>
        </label>
        <label>Model
          <select id="model">
            <option value="gemini-2.0-flash">gemini-2.0-flash (fast)</option>
            <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (cheapest)</option>
            <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro (most capable)</option>
          </select>
        </label>
        <div class="cta-row">
          <button class="primary-btn" id="saveKey">Save</button>
          <button class="ghost-btn" id="testKey">Test connection</button>
          <a class="link-btn" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Get a free key ↗</a>
        </div>
      </div>

      <div class="card">
        <h3>🧠 Mentor persona</h3>
        <p class="muted">The base system prompt for your AI mentor. Customize its personality and focus.</p>
        <textarea id="persona" rows="5">${esc(s.persona)}</textarea>
        <div class="cta-row">
          <button class="primary-btn" id="savePersona">Save persona</button>
          <button class="ghost-btn" id="resetPersona">Reset to default</button>
        </div>
      </div>

      <div class="card danger-zone">
        <h3>⚠️ Data</h3>
        <p class="muted">Everything lives in your browser. Export a backup or reset to defaults.</p>
        <div class="cta-row">
          <button class="ghost-btn" id="exportData">⬇ Export JSON</button>
          <button class="ghost-btn" id="importData">⬆ Import JSON</button>
          <button class="danger-btn" id="resetData">Reset all data</button>
        </div>
        <input type="file" id="importFile" accept="application/json" hidden />
      </div>
    `;

    $("#model").value = s.model;

    $("#toggleKey").addEventListener("click", () => {
      const el = $("#apiKey");
      el.type = el.type === "password" ? "text" : "password";
    });
    $("#saveKey").addEventListener("click", () => {
      Store.updateSettings({ apiKey: $("#apiKey").value.trim(), model: $("#model").value });
      updateApiStatus();
      toast("Settings saved");
    });
    $("#testKey").addEventListener("click", async () => {
      const btn = $("#testKey");
      const key = $("#apiKey").value.trim();
      if (!key) return toast("Enter a key first", "danger");
      btn.disabled = true; btn.textContent = "Testing…";
      try {
        await Agent.testKey(key, $("#model").value);
        toast("Connection OK ✔", "ok");
        Store.updateSettings({ apiKey: key, model: $("#model").value });
        updateApiStatus();
      } catch (err) {
        toast("Failed: " + err.message, "danger");
      } finally {
        btn.disabled = false; btn.textContent = "Test connection";
      }
    });

    $("#savePersona").addEventListener("click", () => {
      Store.updateSettings({ persona: $("#persona").value.trim() });
      toast("Persona saved");
    });
    $("#resetPersona").addEventListener("click", () => {
      $("#persona").value = window.AscendData.DEFAULT_PERSONA;
      Store.updateSettings({ persona: window.AscendData.DEFAULT_PERSONA });
      toast("Persona reset");
    });

    $("#exportData").addEventListener("click", exportData);
    $("#importData").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", importData);
    $("#resetData").addEventListener("click", () => {
      if (confirm("This erases all tasks, roadmap edits, tools, chat, and settings. Continue?")) {
        Store.resetAll();
        toast("Reset complete");
        updateApiStatus();
        navigate("dashboard");
      }
    });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(Store.get(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ascenddev-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        localStorage.setItem("ascenddev.state.v1", JSON.stringify(data));
        location.reload();
      } catch (err) {
        toast("Invalid file", "danger");
      }
    };
    reader.readAsText(file);
  }

  // ---------- Shared ----------
  function updateApiStatus() {
    const el = $("#apiStatus");
    const has = !!Store.getSettings().apiKey;
    el.className = "pill " + (has ? "pill-ok" : "pill-warn");
    el.textContent = has ? "🔑 API connected" : "🔑 No API key";
  }

  function closeModals() {
    $("#taskModal").hidden = true;
    $("#toolModal").hidden = true;
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $("#themeToggle").textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
  }

  // ---------- Init ----------
  function init() {
    applyTheme(Store.getSettings().theme || "dark");
    updateApiStatus();

    $$(".nav-item").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.view)));
    $("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
    $("#themeToggle").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      Store.updateSettings({ theme: next });
    });
    $$("[data-close-modal]").forEach((b) => b.addEventListener("click", closeModals));
    $$(".modal-backdrop").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModals(); }));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });

    navigate("dashboard");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
