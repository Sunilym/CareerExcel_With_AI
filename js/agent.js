/* agent.js — Google Gemini integration. Exposed as window.Agent. */
(function () {
  "use strict";

  const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

  // Build the combined system instruction from persona + enabled tools.
  function buildSystemInstruction() {
    const s = window.Store.getSettings();
    const tools = window.Store.getTools().filter((t) => t.enabled);
    let text = s.persona || "";
    if (tools.length) {
      text += "\n\nActive tools / behaviors you MUST follow:\n";
      tools.forEach((t, i) => {
        text += `${i + 1}. ${t.name}: ${t.instruction}\n`;
      });
    }
    // Give the mentor awareness of the user's current tasks.
    const tasks = window.Store.getTasks();
    if (tasks.length) {
      text += "\nThe user's current tasks (for context):\n";
      tasks.slice(0, 20).forEach((t) => {
        text += `- [${t.status}] (${t.track}) ${t.title}${t.deadline ? " · due " + t.deadline : ""}\n`;
      });
    }
    return text;
  }

  // Convert stored chat history to Gemini "contents" format.
  function toContents(history) {
    return history
      .filter((m) => m.role === "user" || m.role === "model")
      .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  }

  async function sendMessage(userText) {
    const s = window.Store.getSettings();
    if (!s.apiKey) {
      throw new Error("No Gemini API key set. Add one in Settings.");
    }

    const history = window.Store.getChat();
    const contents = toContents(history);
    contents.push({ role: "user", parts: [{ text: userText }] });

    const body = {
      systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };

    const url = `${BASE}/${encodeURIComponent(s.model)}:generateContent?key=${encodeURIComponent(s.apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      let detail = "";
      try {
        const err = await res.json();
        detail = err?.error?.message || JSON.stringify(err);
      } catch (_) {
        detail = await res.text();
      }
      throw new Error(`Gemini API error (${res.status}): ${detail}`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text).join("") || "";
    if (!text) {
      const reason = candidate?.finishReason || "empty response";
      throw new Error(`No text returned (${reason}).`);
    }
    return text;
  }

  // Lightweight key validation by listing/generating a trivial prompt.
  async function testKey(apiKey, model) {
    const url = `${BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with the single word: OK" }] }] })
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json())?.error?.message; } catch (_) { detail = res.statusText; }
      throw new Error(detail || `HTTP ${res.status}`);
    }
    return true;
  }

  window.Agent = { sendMessage, testKey, buildSystemInstruction };
})();
