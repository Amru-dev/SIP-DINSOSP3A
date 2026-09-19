import { fields } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { bindForm, choice } from "../../core/forms.js";
import { state } from "../../core/state.js";

export function fieldContactCards(row) {
  const phone = (row.phone || "").replace(/[^+0-9]/g, "");
  return (
    '<section class="field-contact-card"><span class="eyebrow">HUBUNGI BIDANG</span><h2>Kontak bidang</h2>' +
    (row.contact_name
      ? '<p class="field-contact-name">' + esc(row.contact_name) + "</p>"
      : "") +
    (phone
      ? '<p><span>Telepon</span><a href="tel:' +
        esc(phone) +
        '">' +
        esc(row.phone) +
        "</a></p>"
      : "") +
    (row.email
      ? '<p><span>Surel</span><a href="mailto:' +
        esc(row.email) +
        '">' +
        esc(row.email) +
        "</a></p>"
      : "") +
    (!phone && !row.email
      ? '<p class="muted">Kontak bidang belum dicantumkan.</p>'
      : "") +
    '</section><section class="field-contact-card"><span class="eyebrow">WAKTU PELAYANAN</span><h2>Jadwal pelayanan</h2><p class="field-schedule">' +
    esc(row.schedule || "Jadwal pelayanan belum dicantumkan.") +
    "</p></section>"
  );
}

export async function loadFieldContacts(id, container) {
  container.innerHTML = '<p role="status">Memuat kontak dan jadwal bidang…</p>';
  try {
    const rows = await api("/field-contacts");
    if (!container.isConnected) return;
    const row = rows.find((r) => r.field === id);
    if (!row) throw Error("Data bidang belum tersedia.");
    container.innerHTML = fieldContactCards(row);
  } catch (e) {
    if (!container.isConnected) return;
    container.innerHTML =
      '<p>Kontak dan jadwal belum dapat dimuat.</p><button class="secondary" type="button">Coba lagi</button>';
    container.querySelector("button").onclick = () =>
      loadFieldContacts(id, container);
  }
}

export async function manageFieldContacts(panel) {
  let rows;
  try {
    rows = await api("/field-contacts");
  } catch (e) {
    if (panel.isConnected && state.dashboardSection === "fields") {
      panel.innerHTML =
        '<p>Pengaturan bidang gagal dimuat.</p><button type="button" class="secondary" id="retryFieldSettings">Coba lagi</button>';
      $("#retryFieldSettings").onclick = () => manageFieldContacts(panel);
    }
    return;
  }
  if (!panel.isConnected || state.dashboardSection !== "fields") return;
  panel.innerHTML =
    '<div class="admin-section-heading">' +
    '<span class="eyebrow">PENGATURAN BIDANG</span>' +
    "<h2>Kontak & Jadwal Bidang</h2>" +
    '<p class="muted">Pilih bidang, lalu atur kontak dan jadwal yang akan tampil pada halaman bidang tersebut.</p>' +
    "</div>" +
    '<div class="card">' +
    choice("contact_field", "Bidang", fields) +
    ('<form id="fieldContactForm">' +
      '<label>Nama kontak / unit (opsional)<input name="contact_name" maxlength="120" placeholder="Nama petugas atau unit pelayanan">' +
      "</label>" +
      '<label>Nomor telepon (opsional)<input name="phone" type="tel" maxlength="30" placeholder="Nomor yang dapat dihubungi masyarakat">' +
      "</label>" +
      '<label>Surel bidang (opsional)<input name="email" type="email" maxlength="180">' +
      "</label>" +
      '<label>Jadwal pelayanan (opsional)<textarea name="schedule" maxlength="3000" rows="6" placeholder="Isi hari, jam layanan, waktu istirahat, dan keterangan hari libur sesuai jadwal bidang.">' +
      "</textarea>" +
      "</label>" +
      '<p class="muted">Isian kosong akan ditampilkan sebagai belum dicantumkan. Gunakan kontak yang disetujui untuk dipublikasikan.</p>' +
      '<button type="submit">Simpan kontak & jadwal</button>' +
      '<p id="fieldSaveStatus" role="status">' +
      "</p>" +
      "</form>" +
      "</div>");
  const selector = panel.querySelector('[name="contact_field"]'),
    form = panel.querySelector("#fieldContactForm");
  let current;
  const fill = () => {
    current = rows.find((r) => r.field === selector.value);
    for (const key of ["contact_name", "phone", "email", "schedule"])
      form.elements.namedItem(key).value = current?.[key] || "";
    $("#fieldSaveStatus").textContent = "";
  };
  selector.onchange = () => {
    if (
      [...form.elements].some(
        (el) => el.name && el.value !== (current?.[el.name] || ""),
      ) &&
      !window.confirm("Ganti bidang dan abaikan perubahan yang belum disimpan?")
    ) {
      selector.value = current.field;
      return;
    }
    fill();
  };
  fill();
  bindForm("fieldContactForm", async (data) => {
    if (!current)
      throw Error(
        "Data bidang belum tersedia. Jalankan ulang server, lalu muat ulang halaman.",
      );
    const target = current;
    selector.disabled = true;
    try {
      const result = await api("/field-contacts/" + target.field, "PATCH", {
        ...data,
        revision: Number(target.revision),
      });
      Object.assign(target, data, { revision: result.revision });
      if (form.isConnected) {
        $("#fieldSaveStatus").textContent =
          "Tersimpan. Kontak dan jadwal sudah diperbarui pada halaman " +
          fields[target.field] +
          ".";
      }
    } finally {
      selector.disabled = false;
    }
  });
}
