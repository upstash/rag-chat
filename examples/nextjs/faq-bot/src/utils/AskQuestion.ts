import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';

export const AskQuestion = async (query: string) => {
  const pdfPath = path.join(process.cwd(), 'public', 'assets', 'Effective_Ts.pdf'); 
  const dataBuffer = fs.readFileSync(pdfPath);

  const pdfData = await pdfParse(dataBuffer);
  const text = pdfData.text;

  const lines = text.split('\n');
  const relevantLines = lines.filter(line => line.includes(query));

  return relevantLines.length > 0 ? relevantLines.join('\n') : 'No relevant information found.';
};
