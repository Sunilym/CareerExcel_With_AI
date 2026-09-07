/* store.js — localStorage-backed state. Exposed as window.Store. */
(function () {
  "use strict";

  const KEY = "ascenddev.state.v1";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Failed to parse saved state, starting fresh.", e);
    }
    // First run: seed from defaults.
    const d = window.AscendData;
    return {
      tasks: d.SEED_TASKS.map((t) => ({ ...t })),
      roadmap: d.ROADMAP.map((p) => ({ ...p, milestones: p.milestones.map((m) => ({ ...m })) })),
      tools: d.SEED_TOOLS.map((t) => ({ ...t })),
      settings: {
        apiKey: "",
        model: "gemini-2.0-flash",
        persona: d.DEFAULT_PERSONA,
        theme: "dark"
      },
      chat: []
    };
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save state", e);
    }
  }

  const genId = () => "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const Store = {
    get: () => state,

    // ---- Tasks ----
    getTasks: () => state.tasks,
    upsertTask(task) {
      if (task.id) {
        const i = state.tasks.findIndex((t) => t.id === task.id);
        if (i >= 0) state.tasks[i] = { ...state.tasks[i], ...task };
        else state.tasks.push(task);
      } else {
        task.id = genId();
        state.tasks.push(task);
      }
      save();
      return task;
    },
    deleteTask(id) {
      state.tasks = state.tasks.filter((t) => t.id !== id);
      save();
    },
    setTaskStatus(id, status) {
      const t = state.tasks.find((x) => x.id === id);
      if (t) { t.status = status; save(); }
    },

    // ---- Roadmap ----
    getRoadmap: () => state.roadmap,
    updatePhase(id, patch) {
      const p = state.roadmap.find((x) => x.id === id);
      if (p) { Object.assign(p, patch); save(); }
    },
    addMilestone(phaseId, milestone) {
      const p = state.roadmap.find((x) => x.id === phaseId);
      if (p) { p.milestones.push(milestone); save(); }
    },
    updateMilestone(phaseId, index, patch) {
      const p = state.roadmap.find((x) => x.id === phaseId);
      if (p && p.milestones[index]) { Object.assign(p.milestones[index], patch); save(); }
    },
    deleteMilestone(phaseId, index) {
      const p = state.roadmap.find((x) => x.id === phaseId);
      if (p) { p.milestones.splice(index, 1); save(); }
    },
    addPhase() {
      const phase = { id: genId(), title: "New Phase", goal: "Describe the goal of this phase.", milestones: [] };
      state.roadmap.push(phase);
      save();
      return phase;
    },
    deletePhase(id) {
      state.roadmap = state.roadmap.filter((p) => p.id !== id);
      save();
    },

    // ---- Tools ----
    getTools: () => state.tools,
    upsertTool(tool) {
      if (tool.id) {
        const i = state.tools.findIndex((t) => t.id === tool.id);
        if (i >= 0) state.tools[i] = { ...state.tools[i], ...tool };
        else state.tools.push(tool);
      } else {
        tool.id = genId();
        tool.enabled = tool.enabled ?? false;
        state.tools.push(tool);
      }
      save();
      return tool;
    },
    toggleTool(id) {
      const t = state.tools.find((x) => x.id === id);
      if (t) { t.enabled = !t.enabled; save(); }
    },
    deleteTool(id) {
      state.tools = state.tools.filter((t) => t.id !== id);
      save();
    },

    // ---- Settings ----
    getSettings: () => state.settings,
    updateSettings(patch) {
      Object.assign(state.settings, patch);
      save();
    },

    // ---- Chat ----
    getChat: () => state.chat,
    addMessage(msg) { state.chat.push(msg); save(); },
    clearChat() { state.chat = []; save(); },

    // ---- Danger zone ----
    resetAll() {
      localStorage.removeItem(KEY);
      state = load();
      save();
    }
  };

  window.Store = Store;
})();
