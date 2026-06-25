const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

// Define standard built-in fonts for pdfmake
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

/**
 * Compiles a pdfmake JSON document definition to a PDF Buffer.
 * Saves the JSON and PDF locally for debugging/backup.
 *
 * @param {Object} docDefinition The pdfmake document definition object
 * @param {string} filenameBase (e.g. "tailored_resume_12345")
 * @returns {Promise<Buffer>}
 */
function compileJsonToPdf(docDefinition, filenameBase, outputDir) {
  return new Promise((resolve, reject) => {
    try {
      if (!outputDir) {
        throw new Error('A user-scoped PDF output directory is required.');
      }
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 1. Save the JSON definition locally
      const jsonPath = path.join(outputDir, `${filenameBase}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(docDefinition, null, 2), 'utf8');
      console.log(`📝 Saved PDF definition to ${jsonPath}`);

      // 2. Initialize printer and compile
      const printer = new PdfPrinter(fonts);

      // Ensure default styling uses built-in Helvetica
      if (!docDefinition.defaultStyle) {
        docDefinition.defaultStyle = {};
      }
      docDefinition.defaultStyle.font = 'Helvetica';

      const pdfDoc = printer.createPdfKitDocument(docDefinition);

      // 3. Capture stream to Buffer
      const chunks = [];
      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);

        // Save PDF locally
        const pdfPath = path.join(outputDir, `${filenameBase}.pdf`);
        fs.writeFileSync(pdfPath, pdfBuffer);
        console.log(`✅ Saved compiled PDF to ${pdfPath}`);

        resolve(pdfBuffer);
      });

      pdfDoc.on('error', (err) => {
        console.error('❌ pdfmake generation error:', err);
        reject(err);
      });

      pdfDoc.end();

    } catch (error) {
      console.error('❌ Failed to compile PDF from JSON:', error.message);
      reject(error);
    }
  });
}

module.exports = { compileJsonToPdf };
