import type { PdfPage } from "./types";

/**
 * Texto de um PDF com a posição de cada pedaço (pdf.js, no servidor). Só lê o texto: sem fontes, sem imagens.
 * O worker do pdf.js roda no mesmo processo (globalThis.pdfjsWorker), sem arquivo separado.
 */
export async function pdfPages(bytes: Uint8Array): Promise<PdfPage[]> {
  const g = globalThis as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const pages: PdfPage[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      pages.push({
        width: vp.width,
        height: vp.height,
        items: tc.items
          .filter((i): i is typeof i & { str: string; transform: number[]; width: number } => "str" in i && !!i.str.trim())
          .map((i) => ({ s: i.str, x: i.transform[4], y: vp.height - i.transform[5], w: i.width })),
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}
