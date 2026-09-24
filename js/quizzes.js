const root = document.querySelector("#list");
const search = document.querySelector("#search");
const select = document.querySelector("#language");
let items = [];
const fallback = (value, defaultValue) =>
  typeof value === "string" && value.trim() ? value.trim() : defaultValue;

async function initQuizzes() {
  try {
    const response = await fetch("data/index.json");
    if (!response.ok) throw new Error();
    const manifest = await response.json();
    for (const lang of manifest.languages || []) {
      const option = document.createElement("option");
      option.value = lang.id;
      option.textContent = lang.name || lang.id;
      select.append(option);
      for (const file of lang.courses || []) {
        const courseId = file.split("/").pop().replace(/\.json$/i, "");
        const fileResponse = await fetch(`data/${file}`);
        if (!fileResponse.ok) continue;
        const data = await fileResponse.json();
        let quizNumber = 0;
        (data.chapters || []).forEach((chapter, chapterIndex) =>
          (chapter.quizes || []).forEach((quiz, quizIndex) => {
            quizNumber += 1;
            const id = `${courseId}-${quizNumber}`;
            items.push({
              lang: lang.id,
              language: lang.name || lang.id,
              title: fallback(quiz.name, `Exercise ${quizIndex + 1}`),
              detail: `${courseId}-${chapterIndex + 1} · ${fallback(chapter.name, "Lesson")}`,
              url: `quiz.html?lang=${encodeURIComponent(lang.id)}&class=${encodeURIComponent(id)}`,
            });
          }),
        );
      }
    }
    renderQuizzes();
  } catch {
    root.textContent = "Catalog could not be loaded. Check data/index.json.";
  }
}

function renderQuizzes() {
  const query = search.value.trim().toLowerCase();
  const lang = select.value;
  const shown = items.filter(
    (item) =>
      (!lang || item.lang === lang) &&
      (!query || `${item.title} ${item.detail} ${item.language}`.toLowerCase().includes(query)),
  );
  document.querySelector("#count").textContent = `${shown.length} ${shown.length === 1 ? "exercise" : "exercises"}`;
  root.replaceChildren();
  if (!shown.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = items.length ? "No exercises match your search." : "No exercises available.";
    root.append(empty);
    return;
  }
  for (const item of shown) {
    const link = document.createElement("a");
    link.className = "item";
    link.href = item.url;
    link.innerHTML = `<span><strong>${item.title}</strong><small>${item.language} · ${item.detail}</small></span><span class="arrow">→</span>`;
    root.append(link);
  }
}

search.addEventListener("input", renderQuizzes);
select.addEventListener("change", renderQuizzes);
initQuizzes();
