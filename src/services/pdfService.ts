const pdfParse = require("pdf-parse");

/**
 * PDF Service for text extraction (Admin Port)
 */
export class PdfService {
    /**
     * Extract text from a base64 encoded PDF or URL? 
     * The app currently sends Base64 or URLs. 
     * Let's support both if possible, but primarily Base64 based on the app's current flow.
     */
    static async extractTextFromPdf(pdfInput: string): Promise<string> {
        try {
            console.log('📄 [ADMIN] Starting PDF extraction...');

            let pdfBuffer: Buffer;

            if (pdfInput.startsWith('http')) {
                // Fetch from S3/URL
                const response = await fetch(pdfInput);
                const arrayBuffer = await response.arrayBuffer();
                pdfBuffer = Buffer.from(arrayBuffer);
            } else {
                // Handle Base64
                const base64Data = pdfInput.includes(',')
                    ? pdfInput.split(',')[1]
                    : pdfInput;
                pdfBuffer = Buffer.from(base64Data, 'base64');
            }

            if (!pdfBuffer.toString('utf8', 0, 5).startsWith('%PDF')) {
                throw new Error('Invalid PDF format');
            }

            const data = await pdfParse(pdfBuffer);
            const extractedText = data.text;

            return this.cleanText(extractedText);
        } catch (error: any) {
            console.error('❌ [ADMIN] PDF extraction error:', error.message);
            throw new Error(`Failed to process PDF: ${error.message}`);
        }
    }

    private static cleanText(text: string): string {
        if (!text) return "";
        let cleaned = text.replace(/^\s*(Page\s*)?\d+(\s*of\s*\d+)?\s*$/gim, '');
        cleaned = cleaned.replace(/^\s*[-*_•=]{3,}\s*$/gm, '');
        cleaned = cleaned.replace(/^Copyright\s*©?.*$/gim, '');
        cleaned = cleaned.replace(/[ \t]+/g, ' ');
        cleaned = cleaned.replace(/\n\s*\n+/g, '\n\n');
        return cleaned.trim();
    }

    static isValidPdf(pdfInput: string): boolean {
        try {
            if (pdfInput.startsWith('http')) return pdfInput.toLowerCase().endsWith('.pdf');
            const base64Data = pdfInput.includes(',') ? pdfInput.split(',')[1] : pdfInput;
            const buffer = Buffer.from(base64Data, 'base64');
            return buffer.toString('utf8', 0, 4) === '%PDF';
        } catch {
            return false;
        }
    }
}
