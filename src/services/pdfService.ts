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

            let parserLib = pdfParse;

            // Strategy 1: Standard v1 Function
            if (typeof parserLib === 'function') {
                const data = await parserLib(pdfBuffer);
                return this.cleanText(data.text);
            }

            // Strategy 2: v2 Class (PDFParse property)
            if (parserLib.PDFParse && typeof parserLib.PDFParse === 'function') {
                const dataBytes = new Uint8Array(pdfBuffer);

                try {
                    console.log('   - [RESOLVE] Found PDFParse class. Attempting v2 class-based extraction.');
                    // Strategy A: Instantiate -> Load with data object (standard pdf.js pattern)
                    const parser = new parserLib.PDFParse({ verbosity: 0 });
                    await parser.load({ data: dataBytes });

                    const text = await parser.getText();
                    const rawText = (typeof text === 'string') ? text : (text.text || "");
                    return this.cleanText(rawText);
                } catch (classErr: any) {
                    console.error("   - [WARN] Class Strategy A (load) failed:", classErr.message);

                    // Fallback Strategy B: Constructor Data directly (with Uint8Array)
                    try {
                        console.log('   - [DEBUG] Trying Strategy B (Constructor + Uint8Array)...');
                        const parser = new parserLib.PDFParse(dataBytes);

                        if (typeof parser.getText === 'function') {
                            const text = await parser.getText();
                            const rawText = (typeof text === 'string') ? text : (text.text || "");
                            return this.cleanText(rawText);
                        }
                        throw new Error("Constructor accepted data but no getText method found.");
                    } catch (classErrB: any) {
                        console.error("   - [WARN] Class Strategy B (Constructor) failed:", classErrB.message);
                        throw new Error(`All PDFParse class strategies failed. Original error: ${classErr.message}`);
                    }
                }
            }

            // Strategy 3: ESM Default
            if (parserLib.default && typeof parserLib.default === 'function') {
                const data = await parserLib.default(pdfBuffer);
                return this.cleanText(data.text);
            }

            throw new Error(`Unsupported pdf-parse library structure. Keys: ${Object.keys(parserLib).join(', ')}`);
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
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new Error("Invalid input: URL required.");
        }

        const client = url.startsWith("https") ? require("https") : require("http");

        return new Promise((resolve, reject) => {
            const req = client.get(url, {
                headers: {
                    'User-Agent': 'Waytree-Admin-Backend/1.0'
                }
            }, (res: any) => {
                // Follow redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return this.downloadFile(res.headers.location).then(resolve).catch(reject);
                }

                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`Failed to download file (${res.statusCode}): ${res.statusMessage}`));
                }

                const data: any[] = [];
                res.on("data", (chunk: any) => data.push(chunk));
                res.on("end", () => resolve(Buffer.concat(data)));
            });

            req.on("error", (err: any) => {
                reject(new Error(`Network error downloading file: ${err.message}`));
            });

            req.setTimeout(15000, () => {
                req.destroy();
                reject(new Error("Request timeout"));
            });
        });
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
