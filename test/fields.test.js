import test from "node:test";
import assert from "node:assert/strict";
import { fieldGateway, fieldPage } from "../public/js/features/fields/views.js";
import { state } from "../public/js/core/state.js";

test("four field pages filter programs, keep links and handle unknown fields", () => {
  const page = { innerHTML: "" };
  const ids = ["rehabsos", "linjamsos", "anak", "perempuan"];
  const previousDocument = globalThis.document;
  const previousPrograms = state.programs;
  globalThis.document = {
    querySelector: () => page,
    querySelectorAll: () => [],
  };
  state.programs = ids.map((id) => ({
    id: "program-" + id,
    field: id,
    name: id,
    description: "Uji",
    is_open: false,
  }));
  try {
    const gateway = fieldGateway();
    for (const id of ids) {
      assert.ok(gateway.includes('href="#bidang/' + id + '"'));
      fieldPage(id);
      assert.ok(page.innerHTML.includes("Tugas Pokok dan Fungsi"));
      assert.ok(page.innerHTML.includes("Nomor 94 Tahun 2022"));
      assert.ok(!page.innerHTML.includes("Ringkasan sementara"));
      assert.ok(page.innerHTML.includes('data-program="program-' + id + '"'));
      for (const other of ids.filter((x) => x !== id))
        assert.ok(
          !page.innerHTML.includes('data-program="program-' + other + '"'),
        );
    }
    fieldPage("unknown");
    assert.ok(page.innerHTML.includes("Bidang tidak ditemukan"));
  } finally {
    globalThis.document = previousDocument;
    state.programs = previousPrograms;
  }
});
