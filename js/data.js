/* data.js — default roadmap, seed tasks, and starter AI tools.
 * Exposed on window.AscendData for the classic-script setup. */
(function () {
  "use strict";

  // ---- Learning roadmap: phased curriculum for C++ and AI Agents ----
  const ROADMAP = [
    {
      id: "phase-1",
      title: "Phase 1 · Foundations (Weeks 1-4)",
      goal: "Solidify modern C++ core and understand what an AI agent really is.",
      milestones: [
        { track: "cpp", text: "Master C++17/20 syntax: RAII, move semantics, smart pointers." },
        { track: "cpp", text: "Build 3 small CLI tools (calculator, file parser, mini-DB)." },
        { track: "ai", text: "Understand LLM basics: tokens, context windows, prompting." },
        { track: "ai", text: "Call the Gemini API from a simple script and parse responses." }
      ]
    },
    {
      id: "phase-2",
      title: "Phase 2 · Intermediate Craft (Weeks 5-10)",
      goal: "Write performant C++ and build your first tool-using agent.",
      milestones: [
        { track: "cpp", text: "STL mastery: containers, algorithms, ranges, iterators." },
        { track: "cpp", text: "Concurrency: threads, mutexes, atomics, async/futures." },
        { track: "ai", text: "Build an agent loop: prompt → tool call → observation → answer." },
        { track: "ai", text: "Implement function-calling / tool routing for an LLM." }
      ]
    },
    {
      id: "phase-3",
      title: "Phase 3 · Advanced Systems (Weeks 11-18)",
      goal: "Ship production-grade C++ and multi-step autonomous agents.",
      milestones: [
        { track: "cpp", text: "Templates & metaprogramming, concepts, CRTP." },
        { track: "cpp", text: "Memory profiling, cache-friendly design, benchmarking." },
        { track: "ai", text: "Multi-agent orchestration & planning (ReAct, reflection)." },
        { track: "ai", text: "Add retrieval (RAG) and persistent agent memory." }
      ]
    },
    {
      id: "phase-4",
      title: "Phase 4 · Mastery & Portfolio (Weeks 19-24)",
      goal: "Prove expertise with a flagship project and open-source presence.",
      milestones: [
        { track: "cpp", text: "Contribute to an open-source C++ project (PR merged)." },
        { track: "ai", text: "Build a C++ powered AI-agent framework or runtime." },
        { track: "general", text: "Write 3 technical blog posts + polish GitHub profile." },
        { track: "general", text: "Mock interviews: system design + DSA in C++." }
      ]
    }
  ];

  // ---- Seed tasks (only used the very first time the app loads) ----
  const today = new Date();
  const plus = (d) => {
    const n = new Date(today);
    n.setDate(n.getDate() + d);
    return n.toISOString().slice(0, 10);
  };

  const SEED_TASKS = [
    { id: "t1", title: "Review modern C++ smart pointers", notes: "unique_ptr, shared_ptr, weak_ptr with examples.", track: "cpp", priority: "high", status: "doing", deadline: plus(3), links: [{ label: "cppreference: smart pointers", url: "https://en.cppreference.com/w/cpp/memory" }] },
    { id: "t2", title: "Build a Gemini API 'hello world' agent", notes: "Send a prompt, print the response.", track: "ai", priority: "high", status: "todo", deadline: plus(5), links: [{ label: "Gemini API docs", url: "https://ai.google.dev/gemini-api/docs" }] },
    { id: "t3", title: "Implement a thread-safe queue", notes: "Use std::mutex + condition_variable.", track: "cpp", priority: "medium", status: "todo", deadline: plus(9), links: [] },
    { id: "t4", title: "Design an agent tool-calling loop", notes: "prompt → tool → observation → final answer.", track: "ai", priority: "medium", status: "todo", deadline: plus(12), links: [] },
    { id: "t5", title: "Publish GitHub profile README", notes: "Showcase C++ & AI projects.", track: "general", priority: "low", status: "todo", deadline: plus(20), links: [] }
  ];

  // ---- Starter AI mentor tools (prompt modifiers) ----
  const SEED_TOOLS = [
    { id: "tool-cpp", name: "C++ Reviewer", enabled: true, instruction: "When reviewing C++ code, check for undefined behavior, RAII correctness, memory safety, and prefer modern C++ (smart pointers, ranges). Always mention time/space complexity." },
    { id: "tool-mentor", name: "Strict Mentor", enabled: false, instruction: "Act as a demanding senior engineer. Push back on weak answers, ask probing questions, and require the user to justify design decisions." },
    { id: "tool-planner", name: "Task Planner", enabled: false, instruction: "When asked to plan, break work into concrete tasks with suggested deadlines and clearly mark which track (C++ or AI Agents) each belongs to." }
  ];

  const DEFAULT_PERSONA =
    "You are AscendDev Mentor, an expert C++ engineer and AI-agents architect. " +
    "Help the user become an expert in C++ and AI agent development. Be concrete, use code examples, " +
    "and tie advice back to their learning roadmap when relevant. Keep answers practical and actionable.";

  window.AscendData = { ROADMAP, SEED_TASKS, SEED_TOOLS, DEFAULT_PERSONA };
})();
