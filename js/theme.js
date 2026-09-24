(() => {
  const saved = localStorage.getItem("syntropica-theme");
  document.documentElement.dataset.theme = saved || "dark";
})();

function setupThemeToggle() {
  const button = document.querySelector("#theme");
  if (!button) return;
  const sync = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    button.textContent = dark ? "☀" : "☾";
    button.setAttribute(
      "aria-label",
      dark ? "Switch to light mode" : "Switch to dark mode",
    );
  };
  sync();
  button.addEventListener("click", () => {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("syntropica-theme", theme);
    sync();
  });
}

document.addEventListener("DOMContentLoaded", setupThemeToggle);
