import * as pdfjsLib from 'pdfjs-dist';

// Configure worker safely
try {
  if (typeof window !== 'undefined') {
    // Prefer cdnjs/unpkg matching version for zero-config reliable worker inside Vite
    const version = pdfjsLib.version || '4.10.38';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('PDF.js worker setup error:', e);
}

export interface RenderedPdfPage {
  canvas: HTMLCanvasElement;
  pageNumber: number;
  totalPdfPages: number;
  width: number;
  height: number;
}

export async function renderPdfPage(
  fileData: ArrayBuffer,
  pageNumber = 1,
  renderScale = 2.0
): Promise<RenderedPdfPage> {
  const loadingTask = pdfjsLib.getDocument({
    data: fileData,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const clampedPage = Math.max(1, Math.min(pageNumber, pdf.numPages));
  const page = await pdf.getPage(clampedPage);

  // Render at designated scale (e.g. 2.0x for crisp blueprints)
  const viewport = page.getViewport({ scale: renderScale });
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = Math.floor(viewport.width);
  offscreenCanvas.height = Math.floor(viewport.height);

  const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Could not get 2D canvas context for PDF rendering');
  }

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
    canvas: offscreenCanvas,
  };

  await page.render(renderContext).promise;

  return {
    canvas: offscreenCanvas,
    pageNumber: clampedPage,
    totalPdfPages: pdf.numPages,
    width: offscreenCanvas.width,
    height: offscreenCanvas.height,
  };
}
