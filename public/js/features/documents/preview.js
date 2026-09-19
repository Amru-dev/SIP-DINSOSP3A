import { $, esc } from "../../core/dom.js";
import { dialog } from "../../core/ui.js";

export async function previewDocument(
  fileId,
  title,
  source = "/api/public-files/" + fileId,
) {
  dialog(
    '<div class="pdf-preview-heading"><div><span class="eyebrow">PREVIEW DOKUMEN</span><h2>' +
      esc(title) +
      '</h2></div><a class="download-link" href="' +
      esc(source) +
      ('?download=1">Unduh PDF</a>' +
        "</div>" +
        '<p id="pdfPreviewStatus" class="muted">Menyiapkan dokumen…</p>' +
        '<div id="pdfPreviewPages" class="pdf-preview-pages" aria-live="polite">' +
        "</div>"),
  );
  const [{ getDocument, GlobalWorkerOptions }, response] = await Promise.all([
    import("/vendor/pdf.mjs"),
    fetch(source, { credentials: "same-origin" }),
  ]);
  if (!response.ok) throw Error("Dokumen tidak dapat ditampilkan");
  GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.mjs";
  const pdf = await getDocument({ data: await response.arrayBuffer() }).promise;
  const pages = $("#pdfPreviewPages"),
    status = $("#pdfPreviewStatus");
  status.textContent = "Memuat " + pdf.numPages + " halaman…";
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number),
      viewport = page.getViewport({ scale: 1.35 }),
      canvas = document.createElement("canvas"),
      context = canvas.getContext("2d");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.setAttribute("aria-label", "Halaman " + number);
    pages.append(canvas);
    await page.render({ canvasContext: context, viewport }).promise;
  }
  status.textContent = pdf.numPages + " halaman";
}
