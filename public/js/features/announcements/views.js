import { announcementFields } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { formatDate } from "../../core/format.js";

export function announcementSummary(body, limit = 180) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const excerpt = text.slice(0, limit);
  const boundary = excerpt.lastIndexOf(" ");
  return (boundary > limit / 2 ? excerpt.slice(0, boundary) : excerpt) + "…";
}

export function announcementCard(row) {
  const href = "#pengumuman/" + encodeURIComponent(row.id);
  return `
    <article class="card announcement-card${row.important ? " important" : ""}">
      ${row.important ? '<span class="announcement-important">PENTING</span>' : ""}
      <span class="tag">${esc(announcementFields[row.field] || "Umum")}</span>
      <h3><a href="${esc(href)}">${esc(row.title)}</a></h3>
      <p class="muted">Dipublikasikan <time datetime="${esc(row.publish_date)}">${formatDate(row.publish_date)}</time></p>
      <p class="announcement-excerpt">${esc(announcementSummary(row.body))}</p>
      <a class="announcement-read-more" href="${esc(href)}">Baca selengkapnya <span aria-hidden="true">→</span><span class="announcement-sr-only">: ${esc(row.title)}</span></a>
    </article>`;
}

export async function announcementDetail(id) {
  const page = $("#page");
  page.innerHTML = '<section class="section announcement-detail-page"><p role="status">Memuat pengumuman…</p></section>';
  const container = page.firstElementChild;
  window.scrollTo(0, 0);
  try {
    // Memakai API publik yang sama agar aturan tanggal tayang tetap berlaku.
    const info = await api("/public-information");
    if (!container.isConnected) return;
    const row = info.announcements.find(item => String(item.id) === id);
    if (!row) {
      container.innerHTML = '<h1>Pengumuman tidak tersedia</h1><p>Pengumuman mungkin sudah dihapus atau masa tayangnya berakhir.</p><a href="#pengumuman">← Kembali ke pengumuman</a>';
      return;
    }
    container.innerHTML = `
      <nav class="announcement-breadcrumb" aria-label="Jejak halaman">
        <a href="#informasi">Informasi Publik</a><span aria-hidden="true">/</span><a href="#pengumuman">Pengumuman</a><span aria-hidden="true">/</span><span aria-current="page">Detail</span>
      </nav>
      <article class="announcement-detail">
        <header>
          <span class="eyebrow">PENGUMUMAN DINAS</span>
          <h1 tabindex="-1">${esc(row.title)}</h1>
          <div class="announcement-meta">
            ${row.important ? '<span class="announcement-important">PENTING</span>' : ""}
            <span class="tag">${esc(announcementFields[row.field] || "Umum")}</span>
            <span>Dipublikasikan <time datetime="${esc(row.publish_date)}">${formatDate(row.publish_date)}</time></span>
            ${row.expires_date ? `<span>Tampil sampai ${formatDate(row.expires_date)}</span>` : ""}
          </div>
        </header>
        <div class="announcement-detail-body">${esc(row.body)}</div>
        <footer><a href="#pengumuman">← Kembali ke pengumuman</a></footer>
      </article>`;
    container.querySelector("h1").focus({ preventScroll: true });
  } catch {
    if (!container.isConnected) return;
    container.innerHTML = '<h1>Pengumuman gagal dimuat</h1><p>Periksa koneksi Anda, lalu coba kembali.</p><button type="button" class="secondary" data-announcement-retry>Coba lagi</button> <a href="#pengumuman">Kembali ke pengumuman</a>';
    container.querySelector("[data-announcement-retry]").onclick = () => announcementDetail(id);
  }
}
