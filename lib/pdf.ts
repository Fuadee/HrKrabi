import { PDFDocument, StandardFonts } from 'pdf-lib';

export async function createSimplePdf(title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText(title, {
    x: 50,
    y: page.getHeight() - 60,
    size: 18,
    font,
  });

  let y = page.getHeight() - 100;
  lines.forEach((line) => {
    page.drawText(line, { x: 50, y, size: 12, font });
    y -= 18;
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
