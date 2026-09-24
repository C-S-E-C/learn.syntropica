const params = new URLSearchParams(location.search);
const lang = params.get("lang");
const classId = params.get("class") || params.get("quiz");
const container = document.querySelector("#content");
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
async function initQuiz() {
  try {
    if (!lang || !classId) throw new Error("The link is missing lang or class parameters.");
    const manifestResponse = await fetch("data/index.json");
    if (!manifestResponse.ok) throw new Error("The exercise catalog could not be loaded.");
    const manifest = await manifestResponse.json();
    const entry = (manifest.languages || []).find((item) => item.id === lang);
    if (!entry) throw new Error("Programming language not found.");
    const langreq = document.createElement("script");
    langreq.src = `js/quiz${entry.id}.js`;
    await new Promise((resolve, reject) => {
      langreq.onload = resolve;
      langreq.onerror = () => reject(new Error("The language runtime could not be loaded."));
      document.body.appendChild(langreq);
    });
    let found = null;
    for (const file of entry.courses || []) {
      const response = await fetch(`data/${file}`);
      if (!response.ok) continue;
      const data = await response.json();
      const courseId = file.split("/").pop().replace(/\.json$/i, "");
      let quizNumber = 0;
      for (const [chapterIndex, chapter] of (data.chapters || []).entries()) {
        for (const [quizIndex, quiz] of (chapter.quizes || []).entries()) {
          quizNumber += 1;
          const id = `${courseId}-${quizNumber}`;
          const requestedId = String(classId).trim();
          if (requestedId === id) {
            found = {
              chapter,
              quiz,
              chapterName: chapter.name || data.name || "",
              language: entry.name || lang,
            };
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) throw new Error("Exercise not found.");
    if (!window.quizRuntime) throw new Error("The language runtime is not available.");
    await window.quizRuntime.configure({ language: lang, cache: entry.cache || [] });
    renderQuiz(found);
  } catch (error) {
    container.innerHTML = `<p class="status">${escapeHtml(error.message || "Exercise loading failed.")} <a class="back" href="index.html">Back to catalog</a></p>`;
  }
}

function renderQuiz(item) {
  const quiz = item.quiz;
  document.title = `${quiz.name || "Coding exercise"} · Syntropica Studio`;
  document.querySelector("#crumb-title").textContent = quiz.name || "Exercise";
  const samples = quiz.IOSamples || [];
  container.innerHTML = `<div class="layout"><section><div class="chapter">${escapeHtml(item.chapterName)} · ${escapeHtml(item.language)}</div><h1>${escapeHtml(quiz.name || "Untitled exercise")}</h1><p class="description">${escapeHtml(quiz.desk || "")}</p><div class="panel-title">Input / output examples</div>${samples.length ? samples.map(([input, output]) => `<div class="sample"><div><label>Input</label>${escapeHtml(input)}</div><div><label>Output</label>${escapeHtml(output)}</div></div>`).join("") : '<p class="description">No examples available.</p>'}</section><section><div class="editor-head"><strong>Write code</strong><span class="language">${escapeHtml(item.language)}</span></div><textarea id="code" spellcheck="false" aria-label="Code editor"></textarea><div class="panel-title">Standard input</div><textarea id="input" spellcheck="false" aria-label="Standard input"></textarea><div class="run-actions"><button class="run" id="run" type="button">Run code</button><button class="test" id="test" type="button"${quiz.testNodes?.length ? "" : " disabled"}>Test code</button></div><div class="output"><div class="output-title" id="output-title">Output</div><div id="result">Your output will appear here.\nThe language runtime will be loaded when you run code.</div></div></section></div>`;
  document.querySelector("#code").value = quiz.starterCode || "";
  document.querySelector("#input").value = samples[0]?.[0] || "";
  document.querySelector("#run").addEventListener("click", runCode);
  document.querySelector("#test").addEventListener("click", () => testCode(quiz.testNodes || []));
}

async function prepareRuntime(result) {
  await window.quizRuntime.prepare((message) => {
    result.textContent = message;
  });
}

async function runCode() {
  const button = document.querySelector("#run");
  const testButton = document.querySelector("#test");
  const result = document.querySelector("#result");
  button.disabled = true;
  testButton.disabled = true;
  button.textContent = "Running...";
  result.className = "";
  result.textContent = "Starting the language runtime...";
  try {
    await prepareRuntime(result);
    result.textContent = await window.quizRuntime.runCode(
      document.querySelector("#code").value,
      document.querySelector("#input").value,
    );
  } catch (error) {
    result.className = "error";
    result.textContent = error.message || String(error);
  } finally {
    button.disabled = false;
    testButton.disabled = false;
    button.textContent = "Run code";
  }
}

async function testCode(testNodes) {
  const button = document.querySelector("#test");
  const runButton = document.querySelector("#run");
  const result = document.querySelector("#result");
  const outputTitle = document.querySelector("#output-title");
  const code = document.querySelector("#code").value;
  button.disabled = true;
  runButton.disabled = true;
  button.textContent = "Testing...";
  outputTitle.textContent = "Test results";
  result.className = "test-results";
  result.textContent = "Preparing tests...";
  try {
    await prepareRuntime(result);
    const results = [];
    for (const [index, node] of testNodes.entries()) {
      const input = node?.[0] ?? "";
      const expected = node?.[1] ?? "";
      try {
        const actual = await window.quizRuntime.runCode(code, String(input));
        const accepted = normalizeOutput(actual) === normalizeOutput(expected);
        results.push({
          status: accepted ? "AC" : "WA",
          label: `Test ${index + 1}`,
          detail: accepted ? "" : `input: '${input}'  expected: '${expected}'  received: '${actual}'`,
        });
      } catch (error) {
        results.push({
          status: "RE",
          label: `Test ${index + 1}`,
          detail: error.message || String(error),
        });
      }
      renderTestResults(result, results);
    }
    result.classList.toggle("accepted", results.every((entry) => entry.status === "AC"));
  } catch (error) {
    result.className = "error";
    result.textContent = error.message || String(error);
  } finally {
    button.disabled = false;
    runButton.disabled = false;
    button.textContent = "Test code";
  }
}

function renderTestResults(container, results) {
  container.replaceChildren();
  results.forEach((entry) => {
    const row = document.createElement("div");
    row.className = `test-result test-result-${entry.status.toLowerCase()}`;
    row.innerHTML = `<strong>${entry.status}</strong><span>${escapeHtml(entry.label)}</span>${entry.detail ? `<pre>${escapeHtml(entry.detail)}</pre>` : ""}`;
    container.append(row);
  });
}

function normalizeOutput(value) {
  return String(value).replace(/\\r\\n?/g, "\\n").trim();
}

initQuiz();
