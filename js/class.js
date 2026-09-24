const params = new URLSearchParams(location.search);
const lang = params.get("lang");
const classId = params.get("class");
const content = document.querySelector("#content");
const fileName = (value) => value.split("/").pop().replace(/\.json$/i, "");
const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );

async function loadClass() {
  try {
    if (!lang || !classId) throw new Error("The link is missing lang or class parameters.");
    const manifestResponse = await fetch("data/index.json");
    if (!manifestResponse.ok) throw new Error("The course catalog could not be loaded.");
    const manifest = await manifestResponse.json();
    const entry = (manifest.languages || []).find((item) => item.id === lang);
    const courseFile = (entry?.courses || []).find(
      (file) => fileName(file) === classId.split("-")[0],
    );
    if (!courseFile) throw new Error("Lesson not found.");
    const response = await fetch(
      `data/${courseFile.replace(/[^/]+$/, "classes/")}${encodeURIComponent(classId)}.md`,
    );
    if (!response.ok) throw new Error("Lesson content not found.");
    const markdown = await response.text();
    document.title = `${classId} · Syntropica Studio`;
    document.querySelector("#crumb-title").textContent = classId;
    content.innerHTML = `<div class="class-layout"><div class="chapter">${escapeHtml(lang)}</div><h1>${escapeHtml(classId)}</h1><article class="lesson">${markdownToHtml(markdown)}</article></div>`;
  } catch (error) {
    content.innerHTML = `<p class="status">${escapeHtml(error.message || "Lesson loading failed.")} <a class="back" href="index.html">Back to catalog</a></p>`;
  }
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      const language = fence[1].trim();
      html.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      html.push("<hr>");
      index += 1;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      html.push(`<blockquote>${markdownToHtml(quote.join("\n"))}</blockquote>`);
      continue;
    }
    if (isListItem(line)) {
      const result = renderList(lines, index, getIndent(line));
      html.push(result.html);
      index = result.index;
      continue;
    }
    if (index + 1 < lines.length && /^\s*:\s+/.test(lines[index + 1])) {
      const term = inlineMarkdown(line.trim());
      const definitions = [];
      index += 1;
      while (index < lines.length && /^\s*:\s+/.test(lines[index])) {
        definitions.push(`<dd>${inlineMarkdown(lines[index].replace(/^\s*:\s+/, ""))}</dd>`);
        index += 1;
      }
      html.push(`<dl><dt>${term}</dt>${definitions.join("")}</dl>`);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${inlineMarkdown(paragraph.join("\n"))}</p>`);
  }

  return html.join("") || "<p>This lesson has no content yet.</p>";
}

function isListItem(line) {
  return /^\s*(?:[-+*]|\d+[.)])\s+/.test(line);
}

function getIndent(line) {
  return line.match(/^\s*/)[0].replace(/\t/g, "    ").length;
}

function isBlockStart(line) {
  return /^\s*(?:```|#{1,6}\s|>|(?:[-+*]|\d+[.)])\s+|(?:\*{3,}|-{3,}|_{3,})\s*)$/.test(line);
}

function renderList(lines, start, baseIndent) {
  const first = lines[start].match(/^\s*(?:[-+*]|\d+[.)])\s+/)[0].trim();
  const ordered = /^\d/.test(first);
  const tag = ordered ? "ol" : "ul";
  const output = [`<${tag}>`];
  let index = start;

  while (index < lines.length) {
    if (!isListItem(lines[index]) || getIndent(lines[index]) < baseIndent) break;
    if (getIndent(lines[index]) > baseIndent) {
      const nested = renderList(lines, index, getIndent(lines[index]));
      output.push(nested.html);
      index = nested.index;
      continue;
    }
    const match = lines[index].match(/^\s*(?:[-+*]|\d+[.)])\s+(.*)$/);
    const task = match[1].match(/^\[([ xX])\]\s+(.*)$/);
    const value = task ? task[2] : match[1];
    const checkbox = task
      ? `<input type="checkbox" disabled${task[1].toLowerCase() === "x" ? " checked" : ""}> `
      : "";
    output.push(`<li>${checkbox}${inlineMarkdown(value)}`);
    index += 1;
    if (index < lines.length && isListItem(lines[index]) && getIndent(lines[index]) > baseIndent) {
      const nested = renderList(lines, index, getIndent(lines[index]));
      output.push(nested.html);
      index = nested.index;
    }
    output.push("</li>");
  }
  output.push(`</${tag}>`);
  return { html: output.join(""), index };
}

function inlineMarkdown(value) {
  const code = [];
  let result = escapeHtml(value)
    .replace(/`([^`]+)`/g, (_, content) => {
      code.push(`<code>${content}</code>`);
      return `\u0000${code.length - 1}\u0000`;
    })
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/gi, "<u>$1</u>")
    .replace(/&lt;mark&gt;([\s\S]*?)&lt;\/mark&gt;/gi, "<mark>$1</mark>")
    .replace(/ {2}\n/g, "<br>")
    .replace(/\\\n/g, "<br>")
    .replace(/\n/g, "\n");
  return result.replace(/\u0000(\d+)\u0000/g, (_, number) => code[number]);
}

loadClass();
