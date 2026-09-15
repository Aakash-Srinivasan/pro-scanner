import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

const FONT_SIZE = 40;
const WATERMARK_OPACITY = 0.35;
const WATERMARK_GRAY = 0.55;

// Stamps a single diagonal, semi-transparent text watermark across the
// center of every page. Runs on the PDF's own bytes (not the source images),
// so it can be applied to a scan at any point - original or already
// size-reduced - without redoing the page-build pipeline.
export async function addWatermarkToPdf(pdfBase64, text) {
  const pdfDoc = await PDFDocument.load(pdfBase64);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, FONT_SIZE);
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size: FONT_SIZE,
      font,
      color: rgb(WATERMARK_GRAY, WATERMARK_GRAY, WATERMARK_GRAY),
      opacity: WATERMARK_OPACITY,
      rotate: degrees(45),
    });
  }

  return pdfDoc.saveAsBase64();
}
