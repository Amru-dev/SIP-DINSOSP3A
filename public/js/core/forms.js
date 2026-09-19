import { $, esc } from "./dom.js";
import { notify } from "./ui.js";

export const choice = (name, title, options) =>
  "<label>" +
  title +
  '<select name="' +
  name +
  '">' +
  Object.entries(options)
    .map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + "</option>")
    .join("") +
  "</select></label>";

export async function fileData(file) {
  if (!file || !file.size) throw Error("Pilih foto atau file terlebih dahulu");
  if (file.size > 5 * 1024 * 1024) throw Error("Ukuran maksimal 5 MB");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(Error("File gagal dibaca"));
    reader.readAsDataURL(file);
  });
  return { name: file.name, data };
}

export function input(name, title, type = "text", value = "") {
  return (
    "<label>" +
    esc(title) +
    '<input name="' +
    name +
    '" type="' +
    type +
    '" value="' +
    esc(value) +
    '" required></label>'
  );
}

export function bindForm(id, handler) {
  $("#" + id).onsubmit = async (e) => {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      await handler(Object.fromEntries(new FormData(e.target)), e.target);
    } catch (error) {
      notify(error.message);
    } finally {
      if (button) button.disabled = false;
    }
  };
}
