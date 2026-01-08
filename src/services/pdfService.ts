const pdfParse: any = require("pdf-parse");

/**
 * PDF Service for text extraction (Admin Port)
 */
export class PdfService {
    /**
     * Extract text from a base64 encoded PDF or URL? 
     * The app currently sends Base64 or URLs. 
     * Let's support both if possible, but primarily Base64 based on the app's current flow.
     */
    static async extractText(fileUrl: string): Promise<string> {
        // Dispatch based on extension
        if (fileUrl.match(/\.(xlsx|xls)$/i)) {
            return this.extractTextFromExcel(fileUrl);
        } else if (fileUrl.match(/\.(pdf)$/i)) {
            return this.extractTextFromPdf(fileUrl);
        } else if (fileUrl.match(/\.(txt)$/i)) {
            return this.extractTextFromTxt(fileUrl);
        } else {
            // Default/Fallback
            console.warn(`[ADMIN] Unsupported file type for extraction: ${fileUrl}. Returning empty text.`);
            return "";
        }
    }


    static async extractTextFromPdf(pdfUrl: string): Promise<string> {
        try {
            console.log('📄 [ADMIN] Starting PDF extraction from URL:', pdfUrl);
            const pdfBuffer = await this.downloadFile(pdfUrl);

            // PDF Validation
            if (!pdfBuffer.toString('utf8', 0, 5).startsWith('%PDF')) {
                // Warning only, sometimes signatures vary
                console.warn('⚠️ [ADMIN] Document header does not match %PDF');
            }

            let parser = pdfParse;
            console.log('   - [DEBUG] parser type:', typeof parser);

            // Handle ES Module / CommonJS interop issues manually
            if (typeof parser !== 'function') {
                if (parser.default && typeof parser.default === 'function') {
                    console.log('   - [DEBUG] Using parser.default');
                    parser = parser.default;
                } else {
                    console.log('   - [DEBUG] parser is object but no .default function. Keys:', Object.keys(parser));
                }
            }

            if (typeof parser !== 'function') {
                throw new Error(`pdf-parse library is not a function. Type: ${typeof parser}`);
            }

            const data = await parser(pdfBuffer);
            return this.cleanText(data.text);
        } catch (error: any) {
            console.error('❌ [ADMIN] PDF extraction error:', error.message);
            throw new Error(`Failed to process PDF: ${error.message}`);
        }
    }

    static async extractTextFromExcel(url: string): Promise<string> {
        try {
            const XLSX: any = require('xlsx');
            console.log('📊 [ADMIN] Starting Excel extraction from URL:', url);
            const buffer = await this.downloadFile(url);

            const workbook = XLSX.read(buffer, { type: 'buffer' });
            let fullText = "";

            workbook.SheetNames.forEach((sheetName: string) => {
                const sheet = workbook.Sheets[sheetName];
                // Convert to CSV to preserve structure (Row1,Col1,Col2...)
                const csv = XLSX.utils.sheet_to_csv(sheet);
                if (csv && csv.trim().length > 0) {
                    fullText += `\n--- Sheet: ${sheetName} ---\n${csv}`;
                }
            });

            return fullText.trim();
        } catch (error: any) {
            console.error("❌ [ADMIN] Excel extraction failed:", error);
            return "";
        }
    }

    static async extractTextFromTxt(url: string): Promise<string> {
        try {
            const buffer = await this.downloadFile(url);
            return buffer.toString('utf-8');
        } catch (e) { return ""; }
    }

    private static async downloadFile(url: string): Promise<Buffer> {
        // Only allow HTTP/HTTPS URLs (Strict S3/Web enforcement)
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        throw new Error('Invalid input: URL required.');
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

    static isValidDocument(fileInput: string): boolean {
        const p = fileInput.toLowerCase();
        return (p.startsWith('http')) &&
            (p.endsWith('.pdf') || p.endsWith('.xlsx') || p.endsWith('.xls') || p.endsWith('.txt'));
    }

    // Kept for backward compatibility if needed, but redirects to isValidDocument logical check
    static isValidPdf(pdfInput: string): boolean {
        return this.isValidDocument(pdfInput);
    }

}
