let pyodidePromise;
const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";

function loadPython() {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    installCacheFirstFetch();
    if (window.loadPyodide) {
      return window.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
    }
    const scriptUrl = `${PYODIDE_INDEX_URL}pyodide.js`;
    const cachedScript = await caches.match(scriptUrl);
    const script = document.createElement("script");
    script.crossOrigin = "anonymous";
    if (cachedScript) {
      const source = await cachedScript.text();
      script.src = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    } else {
      script.src = scriptUrl;
    }
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error("The Python runtime could not be loaded. Check your network connection."));
      document.head.append(script);
    });
    return window.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  })();
  return pyodidePromise;
}

function installCacheFirstFetch() {
  if (window.__syntropicaCacheFirstFetch) return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (request.url.startsWith(PYODIDE_INDEX_URL) && request.method === "GET") {
      const cached = await caches.match(request);
      if (cached) return cached;
    }
    return originalFetch(request);
  };
  window.__syntropicaCacheFirstFetch = true;
}

async function runPythonCode(code, input, onState = () => {}) {
  onState("loading");
  const py = await loadPython();
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  let cursor = 0;
  let output = "";
  py.setStdout({
    batched: (value) => {
      output += `${value}\n`;
    },
  });
  py.setStderr({
    batched: (value) => {
      output += `${value}\n`;
    },
  });
  py.globals.set("_read_line", () =>
    cursor < lines.length ? lines[cursor++] : "",
  );
  py.runPython("import builtins\nbuiltins.input = _read_line");
  await py.runPythonAsync(code);
  return output.trimEnd() || "(no output)";
}
