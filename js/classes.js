const root = document.querySelector("#list");
const search = document.querySelector("#search");
const select = document.querySelector("#language");
let items = [];

async function initClasses() {
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
        const courseResponse = await fetch(`data/${file}`);
        if (!courseResponse.ok) continue;
        const course = await courseResponse.json();
        (course.chapters || []).forEach((chapter, chapterIndex) => {
          const classId = `${courseId}-${chapterIndex + 1}`;
          items.push({
            lang: lang.id,
            language: lang.name || lang.id,
            title: chapter.name || `Lesson ${chapterIndex + 1}`,
            detail: classId,
            url: `class.html?lang=${encodeURIComponent(lang.id)}&class=${encodeURIComponent(classId)}`,
          });
        });
      }
    }
    renderClasses();
  } catch {
    root.textContent = "Catalog could not be loaded. Check data/index.json.";
  }
}

function renderClasses() {
  const query = search.value.trim().toLowerCase();
  const lang = select.value;
  const shown = items.filter(
    (item) =>
      (!lang || item.lang === lang) &&
      (!query || `${item.title} ${item.detail} ${item.language}`.toLowerCase().includes(query)),
  );
  document.querySelector("#count").textContent = `${shown.length} ${shown.length === 1 ? "lesson" : "lessons"}`;
  root.replaceChildren();
  if (!shown.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = items.length ? "No lessons match your search." : "No lessons available.";
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

search.addEventListener("input", renderClasses);
select.addEventListener("change", renderClasses);
initClasses();
