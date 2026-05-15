const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Document parser — supports PDF, DOCX (via mammoth), TXT, MD.
 */
async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

module.exports = { parsePDF };
