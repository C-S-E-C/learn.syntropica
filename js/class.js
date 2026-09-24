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
  const footnotes = new Map();
  const body = [];
  for (let index = 0; index < lines.length; index += 1) {
    const definition = lines[index].match(/^\[\^([^\]]+)\]:\s+(.+)$/);
    if (definition) footnotes.set(definition[1], definition[2]);
    else body.push(lines[index]);
  }
  const headings = [];
  const html = renderBlocks(body, headings);
  const toc = headings.length
    ? `<nav class="lesson-toc" aria-label="Table of contents"><strong>Contents</strong><ol>${headings.map((heading) => `<li class="toc-level-${heading.level}"><a href="#${heading.id}">${heading.text}</a></li>`).join("")}</ol></nav>`
    : "";
  const footnoteHtml = footnotes.size
    ? `<section class="footnotes"><h2>Footnotes</h2><ol>${[...footnotes].map(([id, value]) => `<li id="fn-${slugify(id)}">${inlineMarkdown(value)} <a href="#fnref-${slugify(id)}" aria-label="Back to reference">↩</a></li>`).join("")}</ol></section>`
    : "";
  return `${toc}${html}${footnoteHtml}` || "<p>This lesson has no content yet.</p>";
}

function renderBlocks(lines, headings) {
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
      while (index < lines.length && !/^\s*```/.test(lines[index])) code.push(lines[index++]);
      index += 1;
      const language = fence[1].trim();
      html.push(`<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1].length;
      const plain = stripMarkdown(heading[2]);
      const id = uniqueSlug(plain, headings);
      headings.push({ level, id, text: escapeHtml(plain) });
      html.push(`<h${level} id="${id}">${inlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      html.push("<hr>"); index += 1; continue;
    }
    if (/^\s*>/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ""));
      html.push(`<blockquote>${renderBlocks(quote, headings)}</blockquote>`); continue;
    }
    if (isTable(lines, index)) {
      const result = renderTable(lines, index);
      html.push(result.html); index = result.index; continue;
    }
    if (isListItem(line)) {
      const result = renderList(lines, index, getIndent(line));
      html.push(result.html); index = result.index; continue;
    }
    if (index + 1 < lines.length && /^\s*:\s+/.test(lines[index + 1])) {
      const term = inlineMarkdown(line.trim());
      const definitions = [];
      index += 1;
      while (index < lines.length && /^\s*:\s+/.test(lines[index])) definitions.push(`<dd>${inlineMarkdown(lines[index++].replace(/^\s*:\s+/, ""))}</dd>`);
      html.push(`<dl><dt>${term}</dt>${definitions.join("")}</dl>`); continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index]) && !isTable(lines, index)) paragraph.push(lines[index++]);
    html.push(`<p>${inlineMarkdown(paragraph.join("\n"))}</p>`);
  }
  return html.join("");
}

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isPipeRow(line) {
  return /^\s*\|.+\|\s*$/.test(line) || /^\s*[^|]+\|[^|]+(?:\|.*)?\s*$/.test(line);
}

function isTable(lines, index) {
  if (index + 1 >= lines.length || !isPipeRow(lines[index]) || !isPipeRow(lines[index + 1])) return false;
  const separator = tableCells(lines[index + 1]);
  const hasHeaderSeparator = separator.length > 1 && separator.every((cell) => /^:?-{3,}:?$/.test(cell));
  return hasHeaderSeparator || isPipeRow(lines[index + 1]);
}

function renderTable(lines, start) {
  const separator = tableCells(lines[start + 1]);
  const hasHeader = separator.length > 1 && separator.every((cell) => /^:?-{3,}:?$/.test(cell));
  const output = ["<table>"];
  let index = start;

  if (hasHeader) {
    const header = tableCells(lines[index++]);
    index += 1;
    output.push("<thead><tr>");
    header.forEach((cell, cellIndex) => {
      const align = tableAlignment(separator[cellIndex]);
      output.push(`<th${align ? ` style="text-align:${align}"` : ""}>${inlineMarkdown(cell)}</th>`);
    });
    output.push("</tr></thead>");
  }

  output.push("<tbody>");
  while (index < lines.length && isPipeRow(lines[index])) {
    output.push("<tr>");
    tableCells(lines[index++]).forEach((cell, cellIndex) => {
      const align = hasHeader ? tableAlignment(separator[cellIndex]) : "";
      output.push(`<td${align ? ` style="text-align:${align}"` : ""}>${inlineMarkdown(cell)}</td>`);
    });
    output.push("</tr>");
  }
  output.push("</tbody></table>");
  return { html: output.join(""), index };
}

function tableAlignment(cell = "") {
  return cell.startsWith(":") && cell.endsWith(":")
    ? "center"
    : cell.endsWith(":")
      ? "right"
      : cell.startsWith(":")
        ? "left"
        : "";
}

function isListItem(line) { return /^\s*(?:[-+*]|\d+[.)])\s+/.test(line); }
function getIndent(line) { return line.match(/^\s*/)[0].replace(/\t/g, "    ").length; }
function isBlockStart(line) { return /^\s*(?:```|#{1,6}\s|>|(?:[-+*]|\d+[.)])\s+|(?:\*{3,}|-{3,}|_{3,})\s*)$/.test(line); }

function renderList(lines, start, baseIndent) {
  const first = lines[start].match(/^\s*(?:[-+*]|\d+[.)])\s+/)[0].trim();
  const tag = /^\d/.test(first) ? "ol" : "ul";
  const output = [`<${tag}>`];
  let index = start;
  while (index < lines.length) {
    if (!isListItem(lines[index]) || getIndent(lines[index]) < baseIndent) break;
    if (getIndent(lines[index]) > baseIndent) {
      const nested = renderList(lines, index, getIndent(lines[index])); output.push(nested.html); index = nested.index; continue;
    }
    const match = lines[index].match(/^\s*(?:[-+*]|\d+[.)])\s+(.*)$/);
    const task = match[1].match(/^\[([ xX])\]\s+(.*)$/);
    const checkbox = task ? `<input type="checkbox" disabled${task[1].toLowerCase() === "x" ? " checked" : ""}> ` : "";
    output.push(`<li>${checkbox}${inlineMarkdown(task ? task[2] : match[1])}`); index += 1;
    if (index < lines.length && isListItem(lines[index]) && getIndent(lines[index]) > baseIndent) {
      const nested = renderList(lines, index, getIndent(lines[index])); output.push(nested.html); index = nested.index;
    }
    output.push("</li>");
  }
  output.push(`</${tag}>`);
  return { html: output.join(""), index };
}

function inlineMarkdown(value) {
  const protectedParts = [];
  const protect = (html) => { protectedParts.push(html); return `\u0000${protectedParts.length - 1}\u0000`; };
  let result = escapeHtml(value)
    .replace(/\\([\\`*_[\]{}()#+.!|>~-])/g, "$1")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, (_, alt, url, title) => protect(`<img src="${safeUrl(url)}" alt="${escapeHtml(alt)}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy">`))
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g, (_, label, url, title) => protect(`<a href="${safeUrl(url)}"${title ? ` title="${escapeHtml(title)}"` : ""}>${label}</a>`))
    .replace(/`([^`]+)`/g, (_, code) => protect(`<code>${code}</code>`))
    .replace(/\[\^([^\]]+)\]/g, (_, id) => `<sup><a id="fnref-${slugify(id)}" href="#fn-${slugify(id)}">[${escapeHtml(id)}]</a></sup>`)
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
    .replace(/\\\n/g, "<br>");
  return result.replace(/\u0000(\d+)\u0000/g, (_, number) => protectedParts[number]);
}

function safeUrl(value) {
  const url = String(value).trim();
  return /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(url) ? escapeHtml(url) : "#";
}
function stripMarkdown(value) { return String(value).replace(/[`*_~]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); }
function slugify(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-") || "section"; }
function uniqueSlug(value, headings) { const base = slugify(value); let id = base; let count = 2; while (headings.some((heading) => heading.id === id)) id = `${base}-${count++}`; return id; }

loadClass();
