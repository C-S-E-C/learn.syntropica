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
    document.body.appendChild(langreq);
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
  container.innerHTML = `<div class="layout"><section><div class="chapter">${escapeHtml(item.chapterName)} · ${escapeHtml(item.language)}</div><h1>${escapeHtml(quiz.name || "Untitled exercise")}</h1><p class="description">${escapeHtml(quiz.desk || "")}</p><div class="panel-title">Input / output examples</div>${samples.length ? samples.map(([input, output]) => `<div class="sample"><div><label>Input</label>${escapeHtml(input)}</div><div><label>Output</label>${escapeHtml(output)}</div></div>`).join("") : '<p class="description">No examples available.</p>'}</section><section><div class="editor-head"><strong>Write code</strong><span class="language">${escapeHtml(item.language)}</span></div><textarea id="code" spellcheck="false" aria-label="Code editor"></textarea><div class="panel-title">Standard input</div><textarea id="input" spellcheck="false" aria-label="Standard input"></textarea><button class="run" id="run" type="button">Run code</button><div class="output"><div class="output-title">Output</div><div id="result">Your output will appear here.</div></div></section></div>`;
  document.querySelector("#code").value = quiz.starterCode || "";
  document.querySelector("#input").value = samples[0]?.[0] || "";
  document.querySelector("#run").addEventListener("click", runPython);
}

async function runPython() {
  const button = document.querySelector("#run");
  const result = document.querySelector("#result");
  button.disabled = true;
  button.textContent = "Running...";
  result.className = "";
  result.textContent = "Starting the Python runtime...";
  try {
    result.textContent = await runPythonCode(
      document.querySelector("#code").value,
      document.querySelector("#input").value,
    );
  } catch (error) {
    result.className = "error";
    result.textContent = error.message || String(error);
  } finally {
    button.disabled = false;
    button.textContent = "Run code";
  }
}

initQuiz();
