import { api } from "./core/api.js";
import { $ } from "./core/dom.js";
import { state } from "./core/state.js";
import { notify } from "./core/ui.js";
import { login, updateAccount } from "./features/auth/views.js";
import { setupPublicNavigation } from "./layout/navigation.js";
import { render } from "./router.js";

$("#close").onclick = () => $("#dialog").close();

$("#account").onclick = async () => {
  try {
    if (!state.user) return login();
    await api("/logout", "POST", {});
    state.user = null;
    state.csrf = null;
    updateAccount();
    location.hash = "home";
    await render();
  } catch (e) {
    notify(e.message);
  }
};

window.addEventListener("hashchange", render);

(async () => {
  try {
    setupPublicNavigation();
    const me = await api("/me");
    state.user = me.user;
    state.csrf = me.csrf;
    state.programs = await api("/programs");
    updateAccount();
    await render();
  } catch (e) {
    $("#page").textContent = "Server belum siap. " + e.message;
  }
})();
