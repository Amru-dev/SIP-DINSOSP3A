import { state } from "./state.js";

export async function api(url, method = "GET", data) {
  const response = await fetch("/api" + url, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(state.csrf ? { "X-CSRF-Token": state.csrf } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "Permintaan gagal");
  return value;
}
