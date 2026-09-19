import { announcementFields } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { formatDate } from "../../core/format.js";
import { dialog, notify } from "../../core/ui.js";
import { activityCard } from "../activities/views.js";
import { previewDocument } from "../documents/preview.js";

export async function loadPublicUpdates(container) {
  if (!container) return;
  container.innerHTML =
    '<p role="status" class="empty">Memuat informasi terbaru…</p>';
  try {
    const info = await api("/public-information");
    if (!container.isConnected) return;
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Jakarta",
    });
    const activities = [...info.activities]
      .sort(
        (a, b) =>
          b.activity_date.localeCompare(a.activity_date) ||
          Number(b.published) - Number(a.published),
      )
      .slice(0, 3);
    const announcements = info.announcements
      .filter(
        (a) =>
          a.publish_date <= today &&
          (!a.expires_date || a.expires_date >= today),
      )
      .sort(
        (a, b) =>
          Number(b.important) - Number(a.important) ||
          b.publish_date.localeCompare(a.publish_date) ||
          Number(b.published) - Number(a.published),
      )
      .slice(0, 3);
    const documents = [...info.documents]
      .sort(
        (a, b) =>
          b.publish_date.localeCompare(a.publish_date) ||
          Number(b.published) - Number(a.published),
      )
      .slice(0, 3);
    container.innerHTML =
      '<div class="latest-heading">' +
      "<div>" +
      '<span class="eyebrow">KABAR DARI DINAS</span>' +
      "<h2>Informasi terbaru</h2>" +
      "<p>Kegiatan, pengumuman, dan dokumen dalam satu tempat.</p>" +
      "</div>" +
      '<a href="#informasi">Semua informasi →</a>' +
      "</div>" +
      '<div class="latest-category-heading">' +
      "<h3>Kegiatan dinas</h3>" +
      '<a href="#kegiatan">Semua kegiatan →</a>' +
      "</div>" +
      '<div class="cards activity-grid">' +
      (activities.map(activityCard).join("") ||
        '<p class="empty">Belum ada kegiatan yang dipublikasikan.</p>') +
      ("</div>" +
        '<div class="latest-panels">' +
        '<section class="latest-panel">' +
        '<div class="latest-category-heading">' +
        "<h3>Pengumuman</h3>" +
        '<a href="#pengumuman">Lihat semua →</a>' +
        "</div>") +
      (announcements
        .map(
          (a) =>
            '<article class="latest-row">' +
            (a.important
              ? '<span class="latest-important">PENTING</span>'
              : "") +
            '<time datetime="' +
            esc(a.publish_date) +
            '">' +
            formatDate(a.publish_date) +
            '</time><h4><button class="latest-title" type="button" data-home-announcement="' +
            esc(a.id) +
            '">' +
            esc(a.title) +
            "</button></h4><p>" +
            esc(a.body.replace(/\s+/g, " ").slice(0, 140)) +
            (a.body.length > 140 ? "…" : "") +
            "</p></article>",
        )
        .join("") || '<p class="empty">Belum ada pengumuman aktif.</p>') +
      '</section><section class="latest-panel"><div class="latest-category-heading"><h3>Dokumen terbaru</h3><a href="#dokumen">Lihat semua →</a></div>' +
      (documents
        .map(
          (d) =>
            '<article class="latest-row"><span class="latest-pdf">PDF · ' +
            esc(d.year) +
            '</span><time datetime="' +
            esc(d.publish_date) +
            '">' +
            formatDate(d.publish_date) +
            "</time><h4>" +
            esc(d.name) +
            '</h4><div class="latest-document-actions"><button class="secondary" type="button" data-home-document="' +
            esc(d.file_id) +
            '">Preview dokumen</button><a href="/api/public-files/' +
            esc(d.file_id) +
            '?download=1">Unduh PDF</a></div></article>',
        )
        .join("") ||
        '<p class="empty">Belum ada dokumen yang dipublikasikan.</p>') +
      "</section></div>";
    container.querySelectorAll("[data-home-announcement]").forEach(
      (button) =>
        (button.onclick = () => {
          const a = announcements.find(
            (item) => item.id === button.dataset.homeAnnouncement,
          );
          dialog(
            '<span class="eyebrow">PENGUMUMAN DINAS</span><h2>' +
              esc(a.title) +
              '</h2><p class="muted">' +
              formatDate(a.publish_date) +
              " · " +
              esc(announcementFields[a.field]) +
              '</p><div class="announcement-detail-body">' +
              esc(a.body) +
              "</div>",
          );
          $("#dialog").scrollTop = 0;
        }),
    );
    container.querySelectorAll("[data-home-document]").forEach(
      (button) =>
        (button.onclick = () => {
          const d = documents.find(
            (item) => item.file_id === button.dataset.homeDocument,
          );
          previewDocument(d.file_id, d.name).catch((e) => notify(e.message));
        }),
    );
  } catch (e) {
    if (!container.isConnected) return;
    container.innerHTML =
      '<h2>Informasi terbaru</h2><p>Informasi belum dapat dimuat. Silakan coba kembali.</p><button type="button" class="secondary" data-home-retry>Coba lagi</button>';
    container.querySelector("[data-home-retry]").onclick = () =>
      loadPublicUpdates(container);
  }
}
