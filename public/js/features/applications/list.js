import { api } from "../../core/api.js";
import { esc, label } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { notify } from "../../core/ui.js";
import { aidStatusNames, documentBadge } from "./components.js";
import { detail } from "./detail.js";

export async function citizenAidList(panel) {
  const rows = await api("/applications");
  if (!panel.isConnected || panel.dataset.workspace !== "aid") return;
  panel.innerHTML =
    "<h2>" +
    (state.user.role === "masyarakat"
      ? "Pengajuan bantuan saya"
      : "Pengajuan bidang") +
    "</h2>" +
    (rows.length
      ? '<div class="table-wrap"><table><thead><tr><th>Program</th><th>Status</th><th>Aksi</th></tr></thead><tbody>' +
        rows
          .map(
            (a) =>
              "<tr><td>" +
              esc(state.programs.find((p) => p.id === a.program_id)?.name) +
              "</td><td>" +
              esc(aidStatusNames[a.status] || label(a.status)) +
              documentBadge(a) +
              '</td><td><button data-aid-id="' +
              esc(a.id) +
              '">Buka</button></td></tr>',
          )
          .join("") +
        "</tbody></table></div>"
      : '<p class="empty">' +
        (state.user.role === "masyarakat"
          ? 'Belum ada pengajuan bantuan. <a href="#layanan">Lihat layanan</a>.'
          : "Belum ada pengajuan yang telah dikirim pemohon untuk bidang ini.") +
        "</p>");
  panel
    .querySelectorAll("[data-aid-id]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          detail(b.dataset.aidId).catch((e) => notify(e.message))),
    );
}
