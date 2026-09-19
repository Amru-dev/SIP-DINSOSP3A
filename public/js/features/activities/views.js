import { placements } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc } from "../../core/dom.js";
import { formatDate } from "../../core/format.js";
import { state } from "../../core/state.js";

export function activityCard(row) {
  const photos = row.photo_ids || [row.photo_id].filter(Boolean),
    summary = row.description.replace(/\s+/g, " ").trim();
  return (
    '<article class="card activity-card"><a class="activity-cover" href="#kegiatan/' +
    esc(row.id) +
    '" aria-label="Baca ' +
    esc(row.name) +
    '">' +
    (photos.length
      ? '<img src="/api/public-files/' +
        esc(photos[0]) +
        '" alt="' +
        esc(row.name) +
        '" loading="lazy">'
      : '<span class="activity-placeholder">' +
        (row.youtube_id ? "▶ Dokumentasi video" : "Kegiatan Dinas") +
        "</span>") +
    '<span class="media-badge">' +
    (photos.length ? photos.length + " foto" : "") +
    (row.youtube_id ? (photos.length ? " · " : "") + "Video" : "") +
    '</span></a><div class="activity-card-body"><span class="tag">' +
    esc(placements[row.field]) +
    '</span><p class="activity-date">' +
    formatDate(row.activity_date) +
    '</p><h2><a href="#kegiatan/' +
    esc(row.id) +
    '">' +
    esc(row.name) +
    '</a></h2><p class="activity-excerpt">' +
    esc(summary.slice(0, 180)) +
    (summary.length > 180 ? "…" : "") +
    '</p><a class="activity-read" href="#kegiatan/' +
    esc(row.id) +
    '">Baca selengkapnya <span aria-hidden="true">→</span></a></div></article>'
  );
}

export async function activityDetail(id) {
  $("#page").innerHTML =
    '<section class="section"><p role="status">Memuat kegiatan…</p></section>';
  let row;
  try {
    row = await api("/activities/" + encodeURIComponent(id));
  } catch (e) {
    if (location.hash === "#kegiatan/" + id)
      $("#page").innerHTML =
        '<section class="section"><a href="#kegiatan">← Kembali ke kegiatan</a><h1>Kegiatan tidak dapat ditampilkan</h1><p>' +
        esc(e.message) +
        "</p></section>";
    return;
  }
  if (location.hash !== "#kegiatan/" + id) return;
  const photos = row.photo_ids || [];
  $("#page").innerHTML =
    '<article class="section activity-detail"><a class="back-link" href="#kegiatan">← Semua kegiatan</a><header class="activity-detail-heading"><span class="tag">' +
    esc(placements[row.field]) +
    "</span><h1>" +
    esc(row.name) +
    '</h1><p><time datetime="' +
    esc(row.activity_date) +
    '">' +
    formatDate(row.activity_date) +
    "</time> · Dinas Sosial P3A</p></header>" +
    (photos.length
      ? '<section class="activity-gallery" aria-label="Galeri foto kegiatan"><div class="gallery-stage">' +
        photos
          .map(
            (photo, i) =>
              '<img src="/api/public-files/' +
              esc(photo) +
              '" alt="' +
              esc(row.name) +
              " — foto " +
              (i + 1) +
              '"' +
              (i ? ' hidden loading="lazy"' : "") +
              ">",
          )
          .join("") +
        "</div>" +
        (photos.length > 1
          ? '<div class="gallery-controls">' +
            '<button type="button" class="secondary" id="galleryPrevious" aria-label="Foto sebelumnya">←</button>' +
            '<span id="galleryCount" aria-live="polite">1 / ' +
            photos.length +
            ("</span>" +
              '<button type="button" class="secondary" id="galleryNext" aria-label="Foto berikutnya">→</button>' +
              '<button type="button" class="secondary" id="galleryPlay">Putar otomatis</button>' +
              "</div>")
          : "") +
        "</section>"
      : "") +
    '<div class="activity-description">' +
    esc(row.description) +
    "</div>" +
    (row.youtube_id
      ? '<section class="activity-video">' +
        "<h2>Video kegiatan</h2>" +
        '<div id="youtubePlayer" class="youtube-placeholder">' +
        "<p>Tonton dokumentasi kegiatan melalui YouTube.</p>" +
        '<button type="button" id="loadYoutube">▶ Putar video</button>' +
        "</div>" +
        "<p>" +
        '<a target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=' +
        esc(row.youtube_id) +
        '">Buka di YouTube ↗</a></p></section>'
      : "") +
    '<footer class="activity-detail-footer"><a href="#kegiatan">← Kembali ke daftar kegiatan</a></footer></article>';
  if (photos.length > 1) {
    let current = 0,
      playing = false;
    const slides = [...document.querySelectorAll(".gallery-stage img")];
    const show = (offset) => {
      current = (current + offset + slides.length) % slides.length;
      slides.forEach((el, i) => (el.hidden = i !== current));
      $("#galleryCount").textContent = current + 1 + " / " + slides.length;
    };
    const stop = () => {
      clearInterval(state.galleryTimer);
      playing = false;
      $("#galleryPlay").textContent = "Putar otomatis";
    };
    $("#galleryPrevious").onclick = () => {
      stop();
      show(-1);
    };
    $("#galleryNext").onclick = () => {
      stop();
      show(1);
    };
    $("#galleryPlay").onclick = () => {
      if (playing) return stop();
      playing = true;
      $("#galleryPlay").textContent = "Jeda slideshow";
      state.galleryTimer = setInterval(() => show(1), 5000);
    };
  }
  // YouTube requires an HTTP Referer. Override the page's no-referrer policy
  // only for this player; cross-origin requests disclose the site origin only.
  if (row.youtube_id)
    $("#loadYoutube").onclick = () => {
      $("#youtubePlayer").innerHTML =
        '<iframe referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube-nocookie.com/embed/' +
        esc(row.youtube_id) +
        '?autoplay=1&amp;playsinline=1" title="Video ' +
        esc(row.name) +
        '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    };
}
