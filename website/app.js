const root = document.documentElement;
const themeToggle = document.querySelector("[data-theme-toggle]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const sidebar = document.querySelector("[data-sidebar]");
const dialog = document.querySelector("[data-search-dialog]");
const searchInput = document.querySelector("[data-search-input]");
const searchResults = document.querySelector("[data-search-results]");
const toast = document.querySelector("[data-toast]");
const sections = [...document.querySelectorAll(".doc-section")];

const storedTheme = localStorage.getItem("jg-docs-theme");
if (storedTheme === "light" || storedTheme === "dark") root.dataset.theme = storedTheme;

themeToggle?.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("jg-docs-theme", root.dataset.theme);
});

menuToggle?.addEventListener("click", () => sidebar?.classList.toggle("open"));
document.querySelectorAll(".sidebar a").forEach((link) => link.addEventListener("click", () => sidebar?.classList.remove("open")));

document.querySelectorAll("[data-tabs]").forEach((tabs) => {
  const buttons = [...tabs.querySelectorAll("[data-tab]")];
  const panels = [...tabs.querySelectorAll("[data-panel]")];
  buttons.forEach((button) => button.addEventListener("click", () => {
    buttons.forEach((item) => item.setAttribute("aria-selected", String(item === button)));
    panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab));
  }));
});

let toastTimer;
document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", async () => {
    const container = button.closest(".code-window, .inline-command");
    const code = container?.querySelector("code")?.innerText || "";
    await navigator.clipboard.writeText(code.replace(/^\$ /gm, ""));
    button.textContent = "Copied";
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      button.textContent = "Copy";
    }, 1500);
  });
});

const searchIndex = sections.map((section) => ({
  id: section.id,
  title: section.dataset.searchTitle?.split(" ").slice(0, 5).join(" ") || section.querySelector("h2, h1")?.textContent || section.id,
  keywords: `${section.dataset.searchTitle || ""} ${section.textContent}`.replace(/\s+/g, " ").trim(),
}));

function renderSearch(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    searchResults.innerHTML = "<p>Start typing to search this guide.</p>";
    return;
  }
  const matches = searchIndex.filter((entry) => entry.keywords.toLowerCase().includes(normalized)).slice(0, 8);
  searchResults.innerHTML = matches.length
    ? matches.map((entry) => `<a class="search-result" href="#${entry.id}"><strong>${entry.title}</strong><small>${entry.keywords.slice(0, 145)}…</small></a>`).join("")
    : "<p>No matching section found.</p>";
  searchResults.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => dialog.close()));
}

function openSearch() {
  dialog.showModal();
  searchInput.value = "";
  renderSearch("");
  setTimeout(() => searchInput.focus(), 0);
}

document.querySelectorAll("[data-open-search]").forEach((button) => button.addEventListener("click", openSearch));
searchInput?.addEventListener("input", () => renderSearch(searchInput.value));
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearch();
  }
});

const observedLinks = [...document.querySelectorAll('.sidebar a[href^="#"], .on-this-page a[href^="#"]')];
const observer = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  observedLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
}, { rootMargin: "-20% 0px -68%", threshold: [0, .2, .6] });
sections.forEach((section) => observer.observe(section));
