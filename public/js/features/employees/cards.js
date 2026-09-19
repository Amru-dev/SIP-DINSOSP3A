import { placements } from "../../config/fields.js";
import { esc } from "../../core/dom.js";

export const defaultAvatar =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="360" viewBox="0 0 320 360">' +
      '<rect width="320" height="360" fill="#e5eee8"/>' +
      '<circle cx="160" cy="132" r="57" fill="#8ba99b"/>' +
      '<path d="M48 340v-30a112 112 0 0 1 224 0v30" fill="#8ba99b"/>' +
      "</svg>",
  );

export function employeeCard(row) {
  return (
    '<article class="card employee-card"><div class="employee-portrait"><img class="employee-avatar" src="' +
    (row.photo_id ? "/api/public-files/" + esc(row.photo_id) : defaultAvatar) +
    '" alt="' +
    (row.photo_id ? "Foto " + esc(row.name) : "Avatar default pegawai") +
    '" loading="lazy"><span class="employee-status">' +
    esc(row.employment_type) +
    '</span></div><div class="employee-info"><span class="eyebrow">' +
    esc(placements[row.placement]) +
    "</span><h2>" +
    esc(row.name) +
    '</h2><p class="employee-position">' +
    esc(row.position) +
    "</p><dl><dt>NIP</dt><dd>" +
    esc(row.nip) +
    "</dd></dl></div></article>"
  );
}
