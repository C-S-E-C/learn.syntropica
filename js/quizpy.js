let pyodidePromise;

function loadPython() {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = new Promise((resolve, reject) => {
    if (window.loadPyodide) {
      resolve(window.loadPyodide());
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js";
    script.onload = () => resolve(window.loadPyodide());
    script.onerror = () =>
      reject(new Error("The Python runtime could not be loaded. Check your network connection."));
    document.head.append(script);
  });
  return pyodidePromise;
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
