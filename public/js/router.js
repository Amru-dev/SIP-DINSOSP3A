import { $ } from "./core/dom.js";
import { state } from "./core/state.js";
import { notify } from "./core/ui.js";
import { activityDetail } from "./features/activities/views.js";
import { dashboard } from "./features/dashboard/views.js";
import { loadFieldContacts } from "./features/fields/contacts.js";
import { fieldGateway, fieldPage } from "./features/fields/views.js";
import {
  informationRequestCTA,
  informationRequestPage,
} from "./features/information-requests/new-request.js";
import { wirePrograms } from "./features/programs/views.js";
import {
  publicGateway,
  showOrganizationChart,
} from "./features/public-information/gateway.js";
import { publicInformation } from "./features/public-information/list.js";
import { loadPublicUpdates } from "./features/public-information/updates.js";
import { markActiveNavigation } from "./layout/navigation.js";

export async function render() {
  clearInterval(state.galleryTimer);
  try {
    const route = location.hash.slice(1) || "home";
    markActiveNavigation(route);
    if (route === "layanan") {
      $("#page").innerHTML = fieldGateway();
      return;
    }
    if (route.startsWith("bidang/")) {
      const id = route.slice(7);
      fieldPage(id);
      const banner = $("#page .field-banner");
      if (banner) {
        banner.insertAdjacentHTML(
          "afterend",
          '<div id="fieldContactInfo" class="field-contact-info"></div>',
        );
        await loadFieldContacts(id, $("#fieldContactInfo"));
      }
      return;
    }
    if (route === "dashboard") return await dashboard();
    if (route === "permohonan-informasi") {
      informationRequestPage();
      return;
    }
    if (route === "informasi") {
      $("#page").innerHTML =
        publicGateway() +
        informationRequestCTA() +
        '<section class="section home-updates" id="publicUpdates" aria-label="Informasi terbaru"></section>';
      await loadPublicUpdates($("#publicUpdates"));
      return;
    }
    if (route === "pegawai") return await publicInformation("employees");
    if (route.startsWith("kegiatan/"))
      return await activityDetail(route.slice(9));
    if (route === "kegiatan") return await publicInformation("activities");
    if (route === "dokumen") return await publicInformation("documents");
    if (route === "pengumuman") return await publicInformation("announcements");
    $("#page").innerHTML =
      (route === "home"
        ? '<section class="hero">' +
          '<span class="eyebrow">KETERBUKAAN INFORMASI PUBLIK</span>' +
          '<strong class="hero-site-name">SIP DINSOSP3A</strong>' +
          "<h1>Melayani dengan terbuka,<br>" +
          "<em>hadir untuk masyarakat.</em>" +
          "</h1>" +
          "<p>Akses informasi dinas, layanan bantuan, dan perkembangan pengajuan melalui satu portal.</p>" +
          '<a href="#layanan">Jelajahi layanan →</a>' +
          "</section>"
        : "") + fieldGateway();
    if (route === "home") {
      const hero = $("#page .hero");
      hero.insertAdjacentHTML("afterend", $("#profil-beranda").innerHTML);
      const profile = $("#page #profil-heading").closest("section");
      profile.insertAdjacentHTML(
        "afterend",
        $("#struktur-organisasi-beranda").innerHTML,
      );
      const organization = $("#page #organization-heading").closest("section");
      organization.insertAdjacentHTML("afterend", publicGateway());
      $("#expandOrganization").onclick = showOrganizationChart;
    }
    wirePrograms();
  } catch (e) {
    notify(e.message);
  }
}
