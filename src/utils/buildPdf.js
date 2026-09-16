import { PDFDocument } from 'pdf-lib';
import * as FileSystem from 'expo-file-system/legacy';

const PDF_PAGE_SHORT_SIDE = 612; // matches a standard Letter page width in points

// Builds a multi-page PDF from a list of scan-session pages, sizing each page
// to the photo's own aspect ratio so landscape photos don't leave blank space
// on a fixed portrait page (see history of this file for the original bug).
export async function buildPdfFromPages(pages, onProgress) {
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const uri = page.processedUri || page.uri;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const jpgImage = await pdfDoc.embedJpg(base64);
    const { width, height } = jpgImage.size();
    const isLandscape = width > height;
    const pageWidth = isLandscape ? PDF_PAGE_SHORT_SIDE * (width / height) : PDF_PAGE_SHORT_SIDE;
    const pageHeight = isLandscape ? PDF_PAGE_SHORT_SIDE : PDF_PAGE_SHORT_SIDE * (height / width);

    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pdfPage.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
    onProgress?.(i + 1, pages.length);
  }

  return pdfDoc.saveAsBase64();
}

// Rebuilds a PDF from pages that were rasterized from an existing PDF (see
// PdfCompressor.js) rather than photographed. Unlike buildPdfFromPages, the
// page size comes from the source PDF's own point dimensions (captured
// during rasterization) instead of the JPEG's pixel aspect ratio, so the
// rebuilt document keeps the original's exact page size.
export async function buildPdfFromRasterPages(pages) {
  const pdfDoc = await PDFDocument.create();

  for (const page of pages) {
    const base64 = await FileSystem.readAsStringAsync(page.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const jpgImage = await pdfDoc.embedJpg(base64);
    const pdfPage = pdfDoc.addPage([page.pointWidth, page.pointHeight]);
    pdfPage.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: page.pointWidth,
      height: page.pointHeight,
    });
  }

  return pdfDoc.saveAsBase64();
}
