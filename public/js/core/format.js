import { esc } from "./dom.js";

export function formatDate(value) {
  const date = new Date(value + "T00:00:00Z");
  return Number.isNaN(date.valueOf())
    ? esc(value)
    : new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}
