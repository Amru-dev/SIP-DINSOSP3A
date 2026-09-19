import { api } from "../../core/api.js";
import { $ } from "../../core/dom.js";
import { bindForm, input } from "../../core/forms.js";
import { state } from "../../core/state.js";
import { dialog, notify } from "../../core/ui.js";
import { render } from "../../router.js";

export function login(register = false) {
  dialog(
    "<h2>" +
      (register ? "Daftar akun masyarakat" : "Masuk ke layanan") +
      '</h2><form id="auth">' +
      (register ? input("name", "Nama lengkap") : "") +
      input("email", "Email", "email") +
      input("password", "Kata sandi (minimal 12 karakter)", "password") +
      '<button type="submit">' +
      (register ? "Daftar" : "Masuk") +
      '</button></form><p><button class="secondary" id="toggleAuth">' +
      (register ? "Sudah punya akun" : "Buat akun masyarakat") +
      '</button></p><p class="muted">Akun petugas dibuat dan dikelola oleh admin dinas melalui dashboard.</p>',
  );
  $("#toggleAuth").onclick = () => login(!register);
  bindForm("auth", async (data) => {
    if (register) {
      await api("/register", "POST", data);
      notify("Akun berhasil dibuat. Silakan masuk.");
      login(false);
    } else {
      const result = await api("/login", "POST", data);
      state.user = result.user;
      state.csrf = result.csrf;
      $("#dialog").close();
      updateAccount();
      location.hash =
        location.hash === "#permohonan-informasi"
          ? "permohonan-informasi"
          : "dashboard";
      await render();
    }
  });
}

export function updateAccount() {
  $("#account").textContent = state.user
    ? "Keluar · " + state.user.name
    : "Masuk";
}
