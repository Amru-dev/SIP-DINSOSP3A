import { $ } from "./dom.js";

export function notify(message) {
  $("#message").textContent = message;
  $("#message").style.display = "block";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => ($("#message").style.display = "none"), 6500);
}

export function dialog(html) {
  $("#dialog-body").innerHTML = html;
  if (!$("#dialog").open) $("#dialog").showModal();
}
