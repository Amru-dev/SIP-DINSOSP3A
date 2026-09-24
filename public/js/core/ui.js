import { $ } from "./dom.js";

let activeToast = null;
let dialogObserver = null;

function closeToast() {
  clearTimeout(notify.timer);
  if (!activeToast) return;
  const { element } = activeToast;
  activeToast = null;
  if (typeof element.hidePopover === "function" && element.matches(":popover-open")) element.hidePopover();
  element.style.display = "none";
}

function positionToast() {
  if (!activeToast) return;
  const { element } = activeToast;
  const dialogs = [...document.querySelectorAll("dialog[open]")];
  const host = dialogs.at(-1) || document.body;
  // Keep controls inside the active modal so they are not made inert.
  if (typeof element.hidePopover === "function" && element.matches(":popover-open")) element.hidePopover();
  if (element.parentElement !== host) host.append(element);
  element.style.display = "grid";
  // Popover uses the browser top layer, above the dialog and its backdrop.
  if (typeof element.showPopover === "function") element.showPopover();
}

export function notify(message) {
  closeToast();
  const element = $("#message");
  const fullText = String(message?.message ?? message ?? "").trim();
  if (!fullText) return;
  const compact = fullText.replace(/\s+/g, " ");
  const isLong = compact.length > 180;
  const summary = isLong ? compact.slice(0, 180).trimEnd() + "…" : compact;
  element.replaceChildren();
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  if (typeof element.showPopover === "function") element.setAttribute("popover", "manual");

  const content = document.createElement("div");
  content.className = "toast-content";
  const title = document.createElement("strong");
  title.className = "toast-title";
  title.textContent = "Pemberitahuan";
  const text = document.createElement("p");
  text.className = "toast-text";
  text.textContent = summary;
  content.append(title, text);
  if (isLong) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "toast-details";
    toggle.textContent = "Lihat detail";
    toggle.setAttribute("aria-expanded", "false");
    toggle.onclick = () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = expanded ? "Ringkas pesan" : "Lihat detail";
      text.textContent = expanded ? fullText : summary;
    };
    content.append(toggle);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.textContent = "×";
  close.setAttribute("aria-label", "Tutup pemberitahuan");
  close.onclick = closeToast;
  element.append(content, close);
  activeToast = { element };
  positionToast();
  if (!dialogObserver) {
    dialogObserver = new MutationObserver(records => {
      if (records.some(record => record.target.tagName === "DIALOG")) positionToast();
    });
    dialogObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  }
  // Long messages remain available until dismissed. Pause short ones while read.
  const schedule = () => {
    clearTimeout(notify.timer);
    if (!isLong) notify.timer = setTimeout(closeToast, 7000);
  };
  element.onmouseenter = element.onfocusin = () => clearTimeout(notify.timer);
  element.onmouseleave = schedule;
  element.onfocusout = event => {
    if (!element.contains(event.relatedTarget)) schedule();
  };
  schedule();
}

export function dialog(html) {
  $("#dialog-body").innerHTML = html;
  if (!$("#dialog").open) $("#dialog").showModal();
  positionToast();
}
