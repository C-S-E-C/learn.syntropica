const toc = document.querySelector("#toc");
const search = document.querySelector("#course-search");
const languageFilter = document.querySelector("#language-filter");
const count = document.querySelector("#catalog-count");
const text = (value, fallback) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;
let courses = [];

async function loadToc() {
  try {
    const response = await fetch("data/index.json");
    if (!response.ok) throw new Error();
    const manifest = await response.json();
    for (const language of manifest.languages || []) {
      const option = document.createElement("option");
      option.value = language.id;
      option.textContent = language.name || language.id;
      languageFilter.append(option);

      for (const file of language.courses || []) {
        const courseId = file.split("/").pop().replace(/\.json$/i, "");
        try {
          const courseResponse = await fetch(`data/${file}`);
          if (!courseResponse.ok) continue;
          const data = await courseResponse.json();
          courses.push({
            id: courseId,
            languageId: language.id,
            languageName: language.name || language.id,
            data,
          });
        } catch {
          // Keep the rest of the catalog available when one course is invalid.
        }
      }
    }
    renderToc();
  } catch {
    toc.textContent = "Catalog could not be loaded. Check data/index.json.";
  }
}

function renderToc() {
  const query = search.value.trim().toLowerCase();
  const language = languageFilter.value;
  const visible = courses.filter((course) => {
    const matchesLanguage = !language || course.languageId === language;
    const searchText = `${course.id} ${course.languageName} ${course.data.name || ""} ${(course.data.chapters || []).map((chapter) => `${chapter.name || ""} ${(chapter.quizes || []).map((quiz) => quiz.name || "").join(" ")}`).join(" ")}`.toLowerCase();
    return matchesLanguage && (!query || searchText.includes(query));
  });

  count.textContent = `${visible.length} ${visible.length === 1 ? "course" : "courses"}`;
  toc.replaceChildren();
  if (!visible.length) {
    toc.innerHTML = '<p class="empty">No courses match your search.</p>';
    return;
  }

  const groups = new Map();
  for (const course of visible) {
    if (!groups.has(course.languageId)) {
      groups.set(course.languageId, {
        name: course.languageName,
        courses: [],
      });
    }
    groups.get(course.languageId).courses.push(course);
  }

  for (const groupData of groups.values()) {
    const languageSection = document.createElement("section");
    languageSection.className = "toc-language";
    languageSection.textContent = groupData.name;
    const level = document.createElement("div");
    level.className = "toc-level";

    for (const courseData of groupData.courses) {
      const course = document.createElement("div");
      course.className = "toc-course";
      const name = document.createElement("span");
      name.className = "toc-course-name";
      name.textContent = courseData.data.name || courseData.id;
      course.append(name);
      let quizNumber = 0;
      (courseData.data.chapters || []).forEach((chapter, chapterIndex) => {
        const classId = `${courseData.id}-${chapterIndex + 1}`;
        course.append(
          link(
            text(chapter.name, `Lesson ${chapterIndex + 1}`),
            `class.html?lang=${encodeURIComponent(courseData.languageId)}&class=${encodeURIComponent(classId)}`,
          ),
        );
        const group = document.createElement("div");
        group.className = "toc-group";
        const title = document.createElement("div");
        title.className = "toc-group-title";
        title.textContent = "Practice";
        group.append(title);
        (chapter.quizes || []).forEach((quiz, quizIndex) => {
          quizNumber += 1;
          group.append(
            link(
              text(quiz.name, `Exercise ${quizIndex + 1}`),
              `quiz.html?lang=${encodeURIComponent(courseData.languageId)}&class=${encodeURIComponent(`${courseData.id}-${quizNumber}`)}`,
            ),
          );
        });
        course.append(group);
      });
      level.append(course);
    }
    languageSection.append(level);
    toc.append(languageSection);
  }
}

function link(label, href, detail = "") {
  const anchor = document.createElement("a");
  anchor.className = "toc-link";
  anchor.href = href;
  anchor.innerHTML = `<span>${label}${detail ? ` <small>${detail}</small>` : ""}</span><span class="toc-arrow">→</span>`;
  return anchor;
}

search.addEventListener("input", renderToc);
languageFilter.addEventListener("change", renderToc);
loadToc();
