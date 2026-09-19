import { fields } from "../../config/fields.js";
import { api } from "../../core/api.js";
import { $, esc, label } from "../../core/dom.js";
import { bindForm, input } from "../../core/forms.js";
import { state } from "../../core/state.js";
import { notify } from "../../core/ui.js";

export function accountManagement() {
  return (
    '<section class="admin-accounts">' +
    "<h2>Kelola akun petugas</h2>" +
    '<p class="muted">Buat, ubah, reset kata sandi, aktifkan, atau nonaktifkan akun petugas. Akun masyarakat tidak ditampilkan di sini.</p>' +
    '<div class="card">' +
    '<form id="staffAccountForm">' +
    '<input type="hidden" name="id">' +
    input("name", "Nama petugas") +
    input("email", "Email", "email") +
    ('<label>Kata sandi <span id="staffPasswordHint">(minimal 12 karakter)</span>' +
      '<input name="password" type="password" minlength="12" required>' +
      "</label>" +
      '<label>Peran<select name="role" required>' +
      '<option value="operator">Operator</option>' +
      '<option value="kabid">Kepala Bidang</option>' +
      '<option value="petugas">Petugas Perlindungan</option>' +
      '<option value="sekretaris">Sekretaris Dinas</option>' +
      '<option value="pimpinan">Pimpinan</option>' +
      '<option value="admin">Admin</option>' +
      "</select>" +
      "</label>" +
      '<label>Bidang / penempatan<select name="field" required>' +
      "</select>" +
      "</label>" +
      '<label id="staffActiveLabel" hidden>' +
      '<input name="active" type="checkbox" checked> Akun aktif</label>' +
      '<button type="submit" id="staffSubmit">Tambah akun</button> <button type="button" class="secondary" id="staffCancel" hidden>Batal edit</button>' +
      "</form>" +
      "</div>" +
      '<div id="staffAccounts">' +
      '<p class="empty">Memuat akun…</p>' +
      "</div>" +
      "</section>")
  );
}

export function wireAccountManagement() {
  const form = $("#staffAccountForm"),
    role = form.role,
    field = form.field;
  let accounts = [];
  const options = {
    operator: [
      ["sekretariat", "Sekretariat"],
      ["rehabsos", "Rehabilitasi Sosial"],
      ["linjamsos", "Perlindungan & Jaminan Sosial"],
      ["anak", "Bidang Anak"],
      ["perempuan", "Bidang Perempuan"],
    ],
    kabid: [
      ["rehabsos", "Rehabilitasi Sosial"],
      ["linjamsos", "Perlindungan & Jaminan Sosial"],
      ["anak", "Bidang Anak"],
      ["perempuan", "Bidang Perempuan"],
    ],
    petugas: [
      ["anak", "Bidang Anak"],
      ["perempuan", "Bidang Perempuan"],
    ],
    sekretaris: [["sekretariat", "Sekretariat"]],
    pimpinan: [["umum", "Umum"]],
    admin: [["umum", "Umum"]],
  };
  const setFields = (value) => {
    const selected = value || field.value;
    field.innerHTML = (options[role.value] || [])
      .map(([v, t]) => '<option value="' + v + '">' + t + "</option>")
      .join("");
    if ([...field.options].some((o) => o.value === selected))
      field.value = selected;
  };
  role.onchange = () => setFields();
  setFields();
  const reset = () => {
    form.reset();
    form.id.value = "";
    role.value = "operator";
    setFields();
    form.password.required = true;
    $("#staffPasswordHint").textContent = "(minimal 12 karakter)";
    $("#staffActiveLabel").hidden = true;
    $("#staffSubmit").textContent = "Tambah akun";
    $("#staffCancel").hidden = true;
  };
  const draw = () => {
    $("#staffAccounts").innerHTML =
      '<div class="table-wrap"><table><thead><tr><th>NAMA</th><th>EMAIL</th><th>PERAN</th><th>BIDANG</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>' +
      accounts
        .map(
          (a) =>
            "<tr><td>" +
            esc(a.name) +
            (a.id === state.user.id ? " (Anda)" : "") +
            "</td><td>" +
            esc(a.email) +
            "</td><td>" +
            esc(label(a.role)) +
            "</td><td>" +
            esc(fields[a.field] || a.field) +
            '</td><td><span class="tag">' +
            (a.active ? "Aktif" : "Nonaktif") +
            '</span></td><td><button class="secondary" data-account-edit="' +
            a.id +
            '">Edit</button></td></tr>',
        )
        .join("") +
      "</tbody></table></div>";
    document.querySelectorAll("[data-account-edit]").forEach(
      (button) =>
        (button.onclick = () => {
          const a = accounts.find((x) => x.id === button.dataset.accountEdit);
          form.id.value = a.id;
          form.name.value = a.name;
          form.email.value = a.email;
          role.value = a.role;
          setFields(a.field);
          form.password.value = "";
          form.password.required = false;
          form.active.checked = a.active;
          $("#staffPasswordHint").textContent = "(kosongkan jika tidak diubah)";
          $("#staffActiveLabel").hidden = false;
          $("#staffSubmit").textContent = "Simpan perubahan";
          $("#staffCancel").hidden = false;
          form.scrollIntoView({ behavior: "smooth", block: "center" });
        }),
    );
  };
  const load = async () => {
    accounts = await api("/users");
    draw();
  };
  $("#staffCancel").onclick = reset;
  bindForm("staffAccountForm", async (data) => {
    const id = data.id;
    delete data.id;
    data.active = form.active.checked;
    if (!data.password) delete data.password;
    await api("/users" + (id ? "/" + id : ""), id ? "PATCH" : "POST", data);
    notify(id ? "Perubahan akun tersimpan." : "Akun petugas berhasil dibuat.");
    reset();
    await load();
  });
  load().catch((e) => notify(e.message));
}
