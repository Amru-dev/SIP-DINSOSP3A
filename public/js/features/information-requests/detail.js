import { fields } from "../../config/fields.js";
import {
  informationActionNames,
  informationStatusNames,
} from "../../config/information-statuses.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { bindForm, choice, fileData } from "../../core/forms.js";
import { state } from "../../core/state.js";
import { dialog, notify } from "../../core/ui.js";
import { previewDocument } from "../documents/preview.js";
import { informationRequestList } from "./list.js";

export async function informationRequestDetail(id) {
  const row = await api("/information-requests/" + id),
    staff = state.user.role !== "masyarakat",
    actions = row.allowed_actions || [];
  const draft = [...row.replies]
    .reverse()
    .find((r) => r.status === "menunggu_persetujuan");
  const files = (r) =>
    r.file_id
      ? "<p>" +
        esc(r.file_name) +
        '</p><button class="secondary" data-request-preview="' +
        esc(r.file_id) +
        '">Preview PDF</button> <a href="/api/information-requests/' +
        esc(id) +
        "/files/" +
        esc(r.file_id) +
        '?download=1">Unduh PDF</a>'
      : "";
  let form = "";
  if (actions.length) {
    const proposal = actions.includes("menunggu_persetujuan"),
      final = actions.includes("selesai"),
      forward = actions.includes("diteruskan");
    form =
      '<form id="informationReply"><h3>Tindak lanjut</h3><label>Tindakan<select name="status">' +
      actions
        .map(
          (action) =>
            '<option value="' +
            action +
            '">' +
            informationActionNames[action] +
            "</option>",
        )
        .join("") +
      "</select></label>" +
      (forward
        ? choice("field", "Teruskan ke tujuan", {
            sekretariat: "Sekretariat",
            ...fields,
          })
        : "") +
      (final
        ? "<p>Jawaban dan lampiran yang dikirim sama persis dengan draf yang disetujui. Catatan internal tidak ikut dikirim.</p>"
        : "<label>" +
          (proposal ? "Draf jawaban untuk pemohon" : "Catatan internal") +
          '<textarea name="message" maxlength="5000"' +
          (proposal ? " required" : "") +
          "></textarea></label>") +
      (proposal
        ? '<label>Lampiran jawaban (PDF, opsional; maksimal 5 MB)<input type="file" name="file" accept=".pdf">' +
          "</label>" +
          '<p class="muted">Jika merevisi, isi kembali jawaban lengkap dan unggah lampiran yang ingin disertakan. Lampiran draf sebelumnya tidak otomatis disertakan.</p>'
        : "") +
      '<button type="submit">Simpan tindakan</button></form>';
  }
  dialog(
    '<div class="request-detail"><span class="eyebrow">PERMOHONAN INFORMASI PUBLIK</span><h2>' +
      esc(row.subject) +
      '</h2><span class="tag">' +
      esc(informationStatusNames[row.status] || row.status) +
      '</span><p class="request-number">Nomor: ' +
      esc(row.id) +
      '</p><dl class="request-facts"><dt>Pemohon</dt><dd>' +
      esc(row.applicant_name) +
      "</dd><dt>Kontak</dt><dd>" +
      esc(row.phone) +
      " · " +
      esc(row.applicant_email) +
      "</dd><dt>Tujuan</dt><dd>" +
      esc(fields[row.field] || "Sekretariat") +
      "</dd><dt>Dikirim</dt><dd>" +
      new Date(row.created).toLocaleString("id-ID") +
      '</dd></dl><h3>Informasi yang diminta</h3><p class="request-text">' +
      esc(row.details) +
      '</p><h3>Tujuan penggunaan</h3><p class="request-text">' +
      esc(row.purpose) +
      "</p>" +
      (staff &&
      draft &&
      ["menunggu_persetujuan", "disetujui_bidang", "perbaikan_bidang"].includes(
        row.status,
      )
        ? '<section class="request-approved-draft"><h3>' +
          (row.status === "disetujui_bidang"
            ? "Jawaban yang telah disetujui"
            : "Draf jawaban terakhir") +
          '</h3><p class="request-text">' +
          esc(draft.body) +
          "</p>" +
          files(draft) +
          "</section>"
        : "") +
      form +
      "<h3>" +
      (staff ? "Riwayat penanganan" : "Jawaban dinas") +
      "</h3>" +
      (row.replies.length
        ? [...row.replies]
            .reverse()
            .map(
              (r) =>
                '<article class="request-reply"><span class="tag">' +
                esc(informationStatusNames[r.status] || r.status) +
                "</span>" +
                (staff && !Number(r.is_public)
                  ? '<span class="tag">Internal</span>'
                  : "") +
                '<p class="muted">' +
                esc(r.actor_name) +
                " · " +
                new Date(r.created).toLocaleString("id-ID") +
                '</p><p class="request-text">' +
                esc(r.body) +
                "</p>" +
                files(r) +
                "</article>",
            )
            .join("")
        : '<p class="empty">Belum ada jawaban yang dikirim dinas. Anda dapat memantau status permohonan di dashboard.</p>') +
      '<p><button class="secondary" id="closeRequestDetail">Tutup</button></p></div>',
  );
  $("#dialog").scrollTop = 0;
  $("#closeRequestDetail").onclick = () => {
    $("#dialog").close();
    if (location.hash === "#permohonan-informasi") location.hash = "dashboard";
  };
  document.querySelectorAll("[data-request-preview]").forEach(
    (b) =>
      (b.onclick = () => {
        const file = row.replies.find(
          (r) => r.file_id === b.dataset.requestPreview,
        );
        previewDocument(
          file.file_id,
          file.file_name,
          "/api/information-requests/" + id + "/files/" + file.file_id,
        ).catch((e) => notify(e.message));
      }),
  );
  const replyForm = $("#informationReply");
  if (replyForm) {
    if (replyForm.elements.namedItem("field"))
      replyForm.elements.namedItem("field").value = row.field;
    if (actions.includes("menunggu_persetujuan") && draft)
      replyForm.elements.namedItem("message").value = draft.body;
    const sync = () => {
      const el = replyForm.elements.namedItem("message");
      if (el)
        el.required = ["menunggu_persetujuan", "perbaikan_bidang"].includes(
          replyForm.elements.namedItem("status").value,
        );
    };
    replyForm.elements.namedItem("status").onchange = sync;
    sync();
    bindForm("informationReply", async (data, form) => {
      const file = form.elements.namedItem("file")?.files[0];
      delete data.file;
      if (file) data.file = await fileData(file);
      await api("/information-requests/" + id + "/replies", "POST", {
        ...data,
        version: Number(row.version),
      });
      notify("Tindakan berhasil disimpan.");
      await informationRequestDetail(id);
      const panel =
        state.user.role === "admin" ? $("#adminPanel") : $("#staffPanel");
      if (
        panel &&
        (state.user.role === "admin"
          ? state.dashboardSection === "requests"
          : panel.dataset.workspace === "information")
      )
        await informationRequestList(panel);
    });
  }
}
