import { api } from "../../core/api.js";
import { $, esc, label } from "../../core/dom.js";
import { bindForm, input } from "../../core/forms.js";
import { state } from "../../core/state.js";
import { dialog, notify } from "../../core/ui.js";
import { aidDocumentChecklist, aidHistory, aidSummary } from "./components.js";
import { render } from "../../router.js";

export async function detail(id) {
  const a = await api("/applications/" + id),
    p = state.programs.find((x) => x.id === a.program_id);
  const editable =
    state.user.id === a.owner_id && ["draf", "perbaikan"].includes(a.status);
  const transitions = {
    operator: {
      diajukan: ["diverifikasi"],
      diverifikasi: ["perbaikan", "menunggu_kabid"],
      disetujui: ["direalisasikan"],
    },
    kabid: { menunggu_kabid: ["disetujui", "ditolak"] },
  };
  const choices = transitions[state.user.role]?.[a.status] || [];
  dialog(
    '<div class="aid-detail"><span class="eyebrow">DETAIL PENGAJUAN</span><h2>' +
      esc(p?.name || "Pengajuan bantuan") +
      '</h2><p class="aid-reference">Nomor pengajuan: ' +
      esc(a.id) +
      "</p>" +
      aidSummary(a) +
      aidDocumentChecklist(a, p) +
      aidHistory(a.history) +
      '<details class="aid-applicant"><summary>Data pengajuan</summary><dl><dt>Telepon</dt><dd>' +
      esc(a.details.phone) +
      "</dd><dt>Alamat</dt><dd>" +
      esc(a.details.address) +
      "</dd><dt>Keterangan</dt><dd>" +
      esc(a.details.note || "Tidak ada keterangan tambahan.") +
      '</dd></dl></details><section class="aid-documents"><div class="aid-section-heading"><h3>Dokumen persyaratan</h3><span class="aid-count">' +
      a.files.length +
      ' berkas</span></div><div class="application-documents">' +
      (a.files
        .map(
          (f) =>
            '<article class="application-document"><div><strong>' +
            esc(f.requirement) +
            "</strong><small>" +
            esc(f.name) +
            '</small></div><div class="application-document-actions"><button type="button" class="secondary" data-file-preview="' +
            f.id +
            '">Preview</button><a href="/api/files/' +
            f.id +
            '?download=1">Unduh</a></div></article>',
        )
        .join("") || '<p class="empty">Belum ada dokumen yang diunggah.</p>') +
      "</div></section>" +
      (editable
        ? '<form id="editForm"><h3>Perbaiki data</h3>' +
          input("phone", "Telepon", "tel", a.details.phone) +
          '<label>Alamat<textarea name="address" required>' +
          esc(a.details.address) +
          '</textarea></label><label>Keterangan<textarea name="note">' +
          esc(a.details.note) +
          ("</textarea>" +
            "</label>" +
            '<button type="submit">Simpan data</button>' +
            "</form>" +
            '<form id="uploadForm">' +
            "<h3>Unggah persyaratan</h3>" +
            '<label>Jenis dokumen<select name="requirement">') +
          p.requirements
            .map((r) => "<option>" + esc(r) + "</option>")
            .join("") +
          ("</select>" +
            "</label>" +
            '<label>File PDF, PNG, JPG; maksimal 5 MB<input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg" required>' +
            "</label>" +
            '<button type="submit">Unggah</button>' +
            "</form>" +
            "<p>" +
            '<button id="submitApplication">Kirim pengajuan ke dinas</button>' +
            "</p>")
        : "") +
      (choices.length
        ? '<form id="transition"><label>Status berikutnya<select name="status">' +
          choices
            .map(
              (s) => '<option value="' + s + '">' + esc(label(s)) + "</option>",
            )
            .join("") +
          ("</select>" +
            "</label>" +
            '<label>Catatan / alasan keputusan<textarea name="note" required maxlength="2000">' +
            "</textarea>" +
            "</label>" +
            '<button type="submit">Simpan keputusan</button>' +
            "</form>")
        : "") +
      "</div>",
  );
  $("#dialog").scrollTop = 0;
  document.querySelectorAll("[data-file-preview]").forEach(
    (button) =>
      (button.onclick = () =>
        previewApplicationFile(
          a.files.find((file) => file.id === button.dataset.filePreview),
          a.id,
        ).catch((error) => notify(error.message))),
  );
  if (editable) {
    const missing = p.requirements.filter(
      (r) => !a.files.some((f) => f.requirement === r),
    );
    $("#submitApplication").disabled =
      missing.length > 0 || p.requirements.length === 0;
    document.querySelectorAll("[data-missing-requirement]").forEach(
      (button) =>
        (button.onclick = () => {
          const form = $("#uploadForm");
          form.requirement.value = button.dataset.missingRequirement;
          form.scrollIntoView({ behavior: "smooth", block: "start" });
          form.file.focus();
        }),
    );
    bindForm("editForm", async (data) => {
      await api("/applications/" + id, "PATCH", data);
      notify("Data tersimpan");
      await detail(id);
    });
    bindForm("uploadForm", async (_, form) => {
      const file = form.file.files[0];
      if (file.size > 5 * 1024 * 1024) throw Error("Maksimal 5 MB");
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await api("/applications/" + id + "/files", "POST", {
        name: file.name,
        requirement: form.requirement.value,
        data,
      });
      notify(
        result.replaced
          ? "Berkas lama berhasil diganti dengan berkas perbaikan."
          : "Berkas tersimpan",
      );
      await detail(id);
    });
    $("#submitApplication").onclick = async (e) => {
      e.target.disabled = true;
      try {
        await api("/applications/" + id + "/submit", "POST", {});
        notify("Pengajuan terkirim");
        await detail(id);
        await render();
      } catch (e) {
        notify(e.message);
      } finally {
        if ($("#submitApplication")) $("#submitApplication").disabled = false;
      }
    };
  }
  if (choices.length)
    bindForm("transition", async (data) => {
      await api("/applications/" + id + "/transition", "POST", data);
      notify("Status diperbarui");
      await detail(id);
      await render();
    });
}

export async function previewApplicationFile(file, applicationId) {
  const source = "/api/files/" + file.id,
    download = source + "?download=1";
  if (file.mime === "application/pdf") {
    dialog(
      '<div class="pdf-preview-heading"><div><span class="eyebrow">PREVIEW BERKAS PENGAJUAN</span><h2>' +
        esc(file.name) +
        '</h2></div><div class="preview-heading-actions"><button type="button" class="secondary" id="backToApplication">Kembali</button><a class="download-link" href="' +
        download +
        ('">Unduh</a>' +
          "</div>" +
          "</div>" +
          '<p id="pdfPreviewStatus" class="muted">Menyiapkan dokumen…</p>' +
          '<div id="pdfPreviewPages" class="pdf-preview-pages" aria-live="polite">' +
          "</div>"),
    );
    $("#backToApplication").onclick = () =>
      detail(applicationId).catch((error) => notify(error.message));
    const [{ getDocument, GlobalWorkerOptions }, response] = await Promise.all([
      import("/vendor/pdf.mjs"),
      fetch(source, { credentials: "same-origin" }),
    ]);
    if (!response.ok) throw Error("Dokumen tidak dapat ditampilkan");
    GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.mjs";
    const pdf = await getDocument({ data: await response.arrayBuffer() })
        .promise,
      pages = $("#pdfPreviewPages"),
      status = $("#pdfPreviewStatus");
    status.textContent = "Memuat " + pdf.numPages + " halaman…";
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number),
        viewport = page.getViewport({ scale: 1.35 }),
        canvas = document.createElement("canvas"),
        context = canvas.getContext("2d");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute("aria-label", "Halaman " + number);
      pages.append(canvas);
      await page.render({ canvasContext: context, viewport }).promise;
    }
    status.textContent = pdf.numPages + " halaman";
    return;
  }
  dialog(
    '<span class="eyebrow">PREVIEW BERKAS PENGAJUAN</span><h2>' +
      esc(file.name) +
      '</h2><div class="image-preview"><img src="' +
      source +
      '" alt="Preview ' +
      esc(file.requirement) +
      '"></div><div class="preview-heading-actions"><button type="button" class="secondary" id="backToApplication">Kembali</button><a class="download-link" href="' +
      download +
      '">Unduh</a></div>',
  );
  $("#backToApplication").onclick = () =>
    detail(applicationId).catch((error) => notify(error.message));
}
