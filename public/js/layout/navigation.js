import { $ } from "../core/dom.js";

export function setupPublicNavigation() {
  const toggle = $("#navToggle"),
    nav = $("#mainNav");
  toggle.onclick = () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    toggle.setAttribute("aria-label", open ? "Buka menu" : "Tutup menu");
    nav.classList.toggle("open", !open);
  };
  nav.querySelectorAll("a").forEach(
    (link) =>
      (link.onclick = () => {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Buka menu");
        nav.classList.remove("open");
      }),
  );
}

export function markActiveNavigation(route) {
  const active =
    route === "permohonan-informasi"
      ? "informasi"
      : (route.startsWith("kegiatan/") || route.startsWith("pengumuman/"))
        ? "informasi"
        : route.startsWith("bidang/")
          ? "layanan"
          : ["pegawai", "kegiatan", "dokumen", "pengumuman"].includes(route)
            ? "informasi"
            : route;
  document.querySelectorAll("#mainNav a").forEach((link) => {
    if (link.getAttribute("href") === "#" + active)
      link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}
