import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { bindForm } from "../../core/forms.js";
import { state } from "../../core/state.js";
import { dialog, notify } from "../../core/ui.js";
import { render } from "../../router.js";

export function config(id) {
  const p = state.programs.find((x) => x.id === id);
  dialog(
    "<h2>Atur " +
      esc(p.name) +
      '</h2><form id="config"><label>Deskripsi<textarea name="description" required>' +
      esc(p.description) +
      '</textarea></label><label>Persyaratan resmi (satu per baris)<textarea name="requirements">' +
      esc(p.requirements.join("\n")) +
      ("</textarea>" +
        "</label>" +
        '<label>Status<select name="is_open">' +
        '<option value="false">Ditutup / informasi saja</option>' +
        '<option value="true">Dibuka</option>' +
        "</select>" +
        "</label>" +
        '<p class="warning">Buka hanya setelah persyaratan disahkan. Kanal kasus belum bisa dibuka.</p>' +
        '<button type="submit">Simpan</button>' +
        "</form>"),
  );
  $("#config").is_open.value = String(Boolean(p.is_open));
  bindForm("config", async (data) => {
    await api("/programs/" + id, "PATCH", {
      description: data.description,
      requirements: data.requirements
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      is_open: data.is_open === "true",
    });
    state.programs = await api("/programs");
    $("#dialog").close();
    notify("Pengaturan tersimpan");
    await render();
  });
}
