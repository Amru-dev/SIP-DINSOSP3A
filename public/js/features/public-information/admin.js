import { announcementFields, placements } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { bindForm, choice, fileData, input } from "../../core/forms.js";
import { notify } from "../../core/ui.js";

export function adminInformation() {
  return (
    '<div class="admin-section-heading">' +
    '<span class="eyebrow">KONTEN WEBSITE</span>' +
    "<h2>Kelola Informasi Publik</h2>" +
    '<p class="muted">Pilih jenis informasi, lalu tambah atau perbarui konten yang akan dilihat masyarakat.</p>' +
    "</div>" +
    '<div class="card">' +
    '<label>Jenis informasi<select id="informationType">' +
    '<option value="employees">Data pegawai</option>' +
    '<option value="activities">Kegiatan</option>' +
    '<option value="public-documents">Dokumen publik</option>' +
    '<option value="announcements">Pengumuman</option>' +
    "</select>" +
    "</label>" +
    '<form id="informationForm">' +
    "</form>" +
    "</div>"
  );
}

export function wireAdminInformation() {
  let editing = null,
    loadVersion = 0;
  $("#informationForm").insertAdjacentHTML(
    "afterend",
    '<h3>Informasi yang sudah diterbitkan</h3><div id="managedInformation"></div>',
  );
  const typeKey = (type) => (type === "public-documents" ? "documents" : type);
  async function load() {
    const version = ++loadVersion,
      type = $("#informationType").value;
    try {
      const info = await api("/public-information");
      if (version !== loadVersion || !$("#managedInformation")) return;
      const rows = info[typeKey(type)];
      $("#managedInformation").innerHTML = rows.length
        ? '<div class="table-wrap"><table><thead><tr><th>NAMA</th><th>KETERANGAN</th><th>AKSI</th></tr></thead><tbody>' +
          rows
            .map(
              (row) =>
                "<tr><td>" +
                esc(row.name || row.title) +
                "</td><td>" +
                esc(
                  type === "employees"
                    ? row.nip
                    : type === "activities"
                      ? row.activity_date
                      : type === "announcements"
                        ? row.publish_date
                        : row.year,
                ) +
                '</td><td><button class="secondary" data-edit="' +
                row.id +
                '">Edit</button> <button data-delete="' +
                row.id +
                '">Hapus</button></td></tr>',
            )
            .join("") +
          "</tbody></table></div>"
        : '<p class="empty">Belum ada informasi pada kategori ini.</p>';
      document.querySelectorAll("[data-edit]").forEach(
        (button) =>
          (button.onclick = () => {
            editing = rows.find((row) => row.id === button.dataset.edit);
            draw();
            $("#informationForm").scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }),
      );
      document.querySelectorAll("[data-delete]").forEach(
        (button) =>
          (button.onclick = async () => {
            const row = rows.find((x) => x.id === button.dataset.delete);
            if (
              !window.confirm(
                'Hapus "' +
                  (row.name || row.title) +
                  '"? ' +
                  (type === "announcements"
                    ? "Pengumuman akan dihapus permanen."
                    : "Data dan foto/file terkait akan dihapus permanen.") +
                  " Tindakan ini tidak dapat dibatalkan.",
              )
            )
              return;
            button.disabled = true;
            try {
              await api("/" + type + "/" + row.id, "DELETE", {
                revision: Number(row.published),
              });
              if (editing?.id === row.id) {
                editing = null;
                draw();
              }
              notify(
                type === "announcements"
                  ? "Pengumuman dihapus."
                  : "Informasi dan berkas terkait dihapus.",
              );
              await load();
            } catch (error) {
              notify(error.message);
              button.disabled = false;
            }
          }),
      );
    } catch (error) {
      if ($("#managedInformation"))
        $("#managedInformation").textContent =
          "Daftar gagal dimuat: " + error.message;
    }
  }
  const draw = () => {
    const type = $("#informationType").value,
      form = $("#informationForm"),
      item = editing;
    const required = item ? "" : " required";
    const photo =
      "<label>" +
      (type === "employees" ? "Foto profil" : "Foto kegiatan") +
      ('<input name="photo" type="file" accept=".jpg,.jpeg,.png">' +
        "</label>" +
        '<p class="muted">Opsional. JPG atau PNG, maksimal 5 MB. Foto kosong menggunakan avatar default.</p>');
    if (type === "employees")
      form.innerHTML =
        photo +
        (item?.photo_id
          ? '<label class="check-label"><input type="checkbox" name="remove_photo"> Hapus foto dan gunakan avatar default</label>'
          : "") +
        input("name", "Nama pegawai") +
        ('<label>NIP pegawai<input name="nip" type="text" inputmode="numeric" pattern="[0-9]{18}" minlength="18" maxlength="18" required>' +
          "<small>Tepat 18 digit.</small>" +
          "</label>") +
        input("position", "Jabatan") +
        choice("employment_type", "Jenis pegawai", {
          PNS: "PNS",
          PPPK: "PPPK",
        }) +
        choice("placement", "Bidang penempatan", placements);
    else if (type === "activities")
      form.innerHTML =
        '<label>Foto kegiatan (opsional)<input name="photos" type="file" accept=".jpg,.jpeg,.png" multiple>' +
        "</label>" +
        '<p class="muted">Maksimal 6 foto, masing-masing 5 MB; total unggahan maksimal 20 MB. Foto pertama menjadi sampul.</p>' +
        '<div class="media-edit-grid">' +
        (item?.photo_ids || [])
          .map(
            (id, i) =>
              '<label><img src="/api/public-files/' +
              esc(id) +
              '" alt="Foto kegiatan ' +
              (i + 1) +
              '"><span><input type="checkbox" data-keep-photo="' +
              esc(id) +
              '" checked> Pertahankan foto ' +
              (i + 1) +
              "</span></label>",
          )
          .join("") +
        '</div><label>Tautan video YouTube (opsional)<input name="youtube_url" type="url" placeholder="https://www.youtube.com/watch?v=…" value="' +
        (item?.youtube_id
          ? "https://www.youtube.com/watch?v=" + esc(item.youtube_id)
          : "") +
        '"><small>Video ditayangkan dari YouTube, tanpa unggahan file video.</small></label>' +
        input("name", "Nama kegiatan") +
        '<label>Deskripsi kegiatan<textarea name="description" required maxlength="10000"></textarea></label>' +
        input("activity_date", "Tanggal kegiatan", "date") +
        choice("field", "Bidang pelaksana", placements);
    else if (type === "public-documents")
      form.innerHTML =
        input("name", "Nama dokumen") +
        '<label>File dokumen (PDF, maksimal 5 MB)<input name="file" type="file" accept=".pdf"' +
        required +
        "></label>" +
        input("year", "Tahun dokumen", "number", new Date().getFullYear()) +
        input(
          "publish_date",
          "Tanggal publikasi",
          "date",
          new Date().toLocaleDateString("en-CA"),
        );
    else
      form.innerHTML =
        input("title", "Judul pengumuman") +
        '<label>Isi pengumuman<textarea name="body" required maxlength="10000"></textarea></label>' +
        input(
          "publish_date",
          "Tanggal publikasi",
          "date",
          new Date().toLocaleDateString("en-CA"),
        ) +
        '<label>Batas tampil (opsional)<input name="expires_date" type="date"><small>Kosongkan jika pengumuman tidak memiliki batas waktu.</small></label>' +
        choice("field", "Bidang penerbit", announcementFields) +
        '<label class="check-label"><input name="important" type="checkbox"> Tandai sebagai pengumuman penting</label>';
    if (item) {
      for (const key of [
        "name",
        "title",
        "body",
        "nip",
        "position",
        "employment_type",
        "placement",
        "description",
        "activity_date",
        "field",
        "year",
        "publish_date",
        "expires_date",
      ]) {
        const el = form.elements.namedItem(key);
        if (el && item[key] != null) el.value = item[key];
      }
      const fileId = item.file_id || item.photo_id;
      form.insertAdjacentHTML(
        "afterbegin",
        "<h3>Edit " +
          esc(item.name || item.title) +
          "</h3>" +
          (type === "announcements" || type === "activities" || !fileId
            ? ""
            : '<p class="warning">Biarkan unggahan kosong untuk mempertahankan foto/file lama.</p><p><a target="_blank" rel="noopener" href="/api/public-files/' +
              fileId +
              '">Buka berkas saat ini</a></p>'),
      );
    }
    form.innerHTML +=
      '<p class="warning">Data dan berkas yang diterbitkan dapat dilihat publik. Pastikan sudah disetujui untuk dipublikasikan.</p><button type="submit">' +
      (item ? "Simpan perubahan" : "Terbitkan informasi") +
      "</button>" +
      (item
        ? ' <button type="button" class="secondary" id="cancelInformationEdit">Batal edit</button>'
        : "");
    // Re-apply values after the HTML append recreates inputs.
    if (item)
      for (const key of Object.keys(item)) {
        const el = form.elements.namedItem(key);
        if (el && el.type === "checkbox") el.checked = Boolean(item[key]);
        else if (el && el.type !== "file") el.value = item[key] ?? "";
      }
    if ($("#cancelInformationEdit"))
      $("#cancelInformationEdit").onclick = () => {
        editing = null;
        draw();
      };
    bindForm("informationForm", async (data) => {
      if (type === "announcements")
        data.important = form.elements.namedItem("important").checked;
      else if (type === "activities") {
        const selected = [...form.elements.namedItem("photos").files];
        data.keep_photo_ids = [
          ...form.querySelectorAll("[data-keep-photo]:checked"),
        ].map((el) => el.dataset.keepPhoto);
        if (selected.length + data.keep_photo_ids.length > 6)
          throw Error(
            "Maksimal 6 foto. Hapus centang foto lama yang ingin diganti.",
          );
        if (selected.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024)
          throw Error("Total unggahan maksimal 20 MB");
        data.photos = await Promise.all(selected.map(fileData));
      } else {
        const fileName = type === "public-documents" ? "file" : "photo",
          selected = form.elements.namedItem(fileName).files[0];
        delete data[fileName];
        if (selected) data[fileName] = await fileData(selected);
        else if (
          type === "employees" &&
          form.elements.namedItem("remove_photo")?.checked
        )
          data.photo = null;
        else if (!item && type === "public-documents")
          throw Error("Pilih file terlebih dahulu");
        delete data.remove_photo;
      }
      if (item) data.revision = Number(item.published);
      await api(
        "/" + type + (item ? "/" + item.id : ""),
        item ? "PATCH" : "POST",
        data,
      );
      notify(
        item
          ? "Perubahan berhasil disimpan."
          : "Informasi berhasil diterbitkan.",
      );
      if ($("#informationType")?.value === type) {
        editing = null;
        draw();
        await load();
      }
    });
  };
  $("#informationType").onchange = () => {
    editing = null;
    draw();
    load();
  };
  draw();
  load();
}
