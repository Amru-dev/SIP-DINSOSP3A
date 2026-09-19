import { fields } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc, label } from "../../core/dom.js";
import { state } from "../../core/state.js";
import { notify } from "../../core/ui.js";
import { accountManagement, wireAccountManagement } from "../accounts/views.js";
import { detail } from "../applications/detail.js";
import { citizenAidList } from "../applications/list.js";
import { login } from "../auth/views.js";
import { manageFieldContacts } from "../fields/contacts.js";
import { informationRequestList } from "../information-requests/list.js";
import { config } from "../programs/admin.js";
import {
  adminInformation,
  wireAdminInformation,
} from "../public-information/admin.js";
import { render } from "../../router.js";

export async function dashboard() {
  if (!state.user) {
    $("#page").innerHTML =
      '<section class="section">' +
      "<h1>Dashboard layanan</h1>" +
      "<p>Masuk untuk melihat pengajuan dan layanan sesuai kewenangan Anda.</p>" +
      '<button id="dashboardLogin">Masuk</button>' +
      "</section>";
    $("#dashboardLogin").onclick = () => login();
    return;
  }
  $("#page").innerHTML =
    '<section class="section dashboard-page"><span class="eyebrow">' +
    esc(
      { sekretaris: "Sekretaris Dinas" }[state.user.role] ||
        label(state.user.role),
    ) +
    " · " +
    esc(
      fields[state.user.field] ||
        (state.user.field === "sekretariat" ? "Sekretariat" : state.user.field),
    ) +
    "</span><h1>" +
    (state.user.role === "admin"
      ? "Dashboard Admin"
      : "Selamat datang, " + esc(state.user.name)) +
    "</h1>" +
    (state.user.role === "admin"
      ? '<p class="page-intro">Pilih menu pengelolaan sesuai pekerjaan yang ingin dilakukan.</p>'
      : "") +
    '<div id="dash-content"></div></section>';
  const target = $("#dash-content");
  if (state.user.role === "admin") {
    const menu = [
      ["summary", "Ringkasan", "Rekap pengajuan bantuan"],
      ["programs", "Program & Persyaratan", "Atur layanan dan persyaratan"],
      ["fields", "Kontak & Jadwal Bidang", "Atur kontak dan jam pelayanan"],
      ["requests", "Permohonan Informasi", "Proses dan jawab permohonan"],
      ["information", "Informasi Publik", "Kelola konten website"],
      ["accounts", "Akun Petugas", "Tambah dan kelola akun"],
    ];
    target.innerHTML =
      '<div class="admin-layout"><aside class="admin-menu" aria-label="Menu dashboard admin"><p class="admin-menu-title">MENU PENGELOLAAN</p>' +
      menu
        .map(
          ([id, title, description]) =>
            '<button type="button" data-admin-section="' +
            id +
            '"' +
            (state.dashboardSection === id ? ' class="active"' : "") +
            "><strong>" +
            title +
            "</strong><small>" +
            description +
            "</small></button>",
        )
        .join("") +
      '</aside><div id="adminPanel" class="admin-panel"></div></div>';
    const show = async (section) => {
      state.dashboardSection = section;
      document
        .querySelectorAll("[data-admin-section]")
        .forEach((button) =>
          button.classList.toggle(
            "active",
            button.dataset.adminSection === section,
          ),
        );
      const panel = $("#adminPanel");
      panel.innerHTML = '<p class="empty">Memuat…</p>';
      if (section === "summary") {
        const summary = await api("/summary");
        if (!panel.isConnected || state.dashboardSection !== "summary") return;
        panel.innerHTML =
          '<div class="admin-section-heading">' +
          '<span class="eyebrow">RINGKASAN</span>' +
          "<h2>Rekap Bantuan</h2>" +
          '<p class="muted">Gambaran jumlah pengajuan berdasarkan bidang dan status.</p>' +
          "</div>" +
          '<div class="cards">' +
          (summary.length
            ? summary
                .map(
                  (x) =>
                    '<article class="card"><span>' +
                    esc(fields[x.field]) +
                    "</span><h3>" +
                    x.total +
                    '</h3><span class="tag">' +
                    esc(label(x.status)) +
                    "</span></article>",
                )
                .join("")
            : '<p class="empty">Belum ada pengajuan.</p>') +
          '</div><p class="muted admin-note">Admin hanya melihat rekap. Identitas dan lampiran pengajuan tetap dibatasi berdasarkan kewenangan petugas.</p>';
      } else if (section === "programs") {
        panel.innerHTML =
          '<div class="admin-section-heading">' +
          '<span class="eyebrow">LAYANAN</span>' +
          "<h2>Program & Persyaratan</h2>" +
          '<p class="muted">Atur deskripsi, persyaratan resmi, dan status pembukaan layanan.</p>' +
          "</div>" +
          '<div class="cards">' +
          state.programs
            .map(
              (p) =>
                '<article class="card"><span class="tag">' +
                esc(fields[p.field]) +
                "</span><h3>" +
                esc(p.name) +
                "</h3><p>" +
                (p.is_open ? "Pengajuan dibuka" : "Pengajuan ditutup") +
                '</p><button data-config="' +
                p.id +
                '">Atur program</button></article>',
            )
            .join("") +
          "</div>";
        document
          .querySelectorAll("[data-config]")
          .forEach((b) => (b.onclick = () => config(b.dataset.config)));
      } else if (section === "requests") {
        await informationRequestList(panel);
      } else if (section === "fields") {
        await manageFieldContacts(panel);
      } else if (section === "information") {
        panel.innerHTML = adminInformation();
        wireAdminInformation();
      } else {
        panel.innerHTML = accountManagement();
        wireAccountManagement();
      }
    };
    document
      .querySelectorAll("[data-admin-section]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            show(button.dataset.adminSection).catch((e) => notify(e.message))),
      );
    await show(state.dashboardSection);
    return;
  }
  if (
    ["operator", "kabid", "petugas", "sekretaris"].includes(state.user.role)
  ) {
    await staffWorkspaces(target);
    return;
  }
  if (state.user.role === "pimpinan") {
    const summary = await api("/summary");
    target.innerHTML =
      '<h2>Rekap bantuan</h2><div class="cards">' +
      (summary.length
        ? summary
            .map(
              (x) =>
                '<article class="card"><span>' +
                esc(fields[x.field]) +
                "</span><h3>" +
                x.total +
                "</h3>" +
                esc(label(x.status)) +
                "</article>",
            )
            .join("")
        : '<p class="empty">Belum ada pengajuan.</p>') +
      '</div><p class="muted">Akun ini tidak dapat membuka identitas atau lampiran pengajuan.</p>';
    return;
  }
  if (state.user.role === "masyarakat") {
    target.innerHTML =
      '<div class="citizen-workspaces">' +
      '<button type="button" id="citizenAid" class="secondary">Pengajuan bantuan</button>' +
      '<button type="button" id="citizenInformation" class="secondary">Permohonan informasi</button>' +
      "</div>" +
      '<div id="citizenPanel">' +
      "</div>";
    const panel = $("#citizenPanel");
    $("#citizenAid").onclick = () => {
      panel.dataset.workspace = "aid";
      citizenAidList(panel).catch((e) => notify(e.message));
    };
    $("#citizenInformation").onclick = () => {
      panel.dataset.workspace = "information";
      informationRequestList(panel).catch((e) => notify(e.message));
    };
    panel.dataset.workspace = "aid";
    await citizenAidList(panel);
    return;
  }
  const rows = await api("/applications");
  target.innerHTML =
    '<div class="toolbar"><h2>' +
    (state.user.role === "masyarakat" ? "Pengajuan saya" : "Pengajuan bidang") +
    '</h2><button class="secondary" id="refresh">Muat ulang</button></div>' +
    (!rows.length
      ? '<p class="empty">Belum ada pengajuan. Pilih layanan pada menu Layanan.</p>'
      : '<div class="table-wrap"><table><thead><tr><th>PROGRAM</th><th>TANGGAL</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>' +
        rows
          .map(
            (a) =>
              "<tr><td>" +
              esc(state.programs.find((p) => p.id === a.program_id)?.name) +
              "</td><td>" +
              new Date(a.created).toLocaleDateString("id-ID") +
              '</td><td><span class="tag">' +
              esc(label(a.status)) +
              '</span></td><td><button data-detail="' +
              a.id +
              '">Buka</button></td></tr>',
          )
          .join("") +
        "</tbody></table></div>");
  $("#refresh").onclick = () => render();
  document
    .querySelectorAll("[data-detail]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          detail(b.dataset.detail).catch((e) => notify(e.message))),
    );
}

export async function staffWorkspaces(target) {
  const canAid =
    state.user.role === "petugas" ||
    (["operator", "kabid"].includes(state.user.role) &&
      ["rehabsos", "linjamsos"].includes(state.user.field));
  const canInformation = ["operator", "kabid", "sekretaris"].includes(
    state.user.role,
  );
  target.innerHTML =
    '<div class="citizen-workspaces" aria-label="Ruang kerja">' +
    (canAid
      ? '<button type="button" class="secondary" data-staff-work="aid">Pengajuan bantuan</button>'
      : "") +
    (canInformation
      ? '<button type="button" class="secondary" data-staff-work="information">Permohonan informasi</button>'
      : "") +
    '</div><div id="staffPanel"></div>';
  const panel = $("#staffPanel");
  const show = async (work) => {
    panel.dataset.workspace = work;
    target.querySelectorAll("[data-staff-work]").forEach((b) => {
      b.classList.toggle("active", b.dataset.staffWork === work);
      b.setAttribute("aria-pressed", String(b.dataset.staffWork === work));
    });
    panel.innerHTML = '<p role="status">Memuat…</p>';
    if (work === "information" && canInformation)
      await informationRequestList(panel);
    else if (work === "aid" && canAid) await citizenAidList(panel);
  };
  target
    .querySelectorAll("[data-staff-work]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          show(b.dataset.staffWork).catch((e) => notify(e.message))),
    );
  await show(canAid ? "aid" : "information");
}
