import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * RAG Pipeline Service (Admin Port)
 */
export class RagPipelineService {
    private static tempDir = path.join(__dirname, '../../temp');
    private static pipelineScript = path.join(__dirname, '../../ai_pipeline/rag_pipeline.py');

    /**
     * Processes multiple PDFs (Base64 or URL)
     */
    static async processMultiplePdfs(pdfInputs: string[]): Promise<any[]> {
        console.log(`🚀 [ADMIN] Starting RAG Pipeline for ${pdfInputs.length} PDFs...`);
        let allChunks: any[] = [];

        for (let i = 0; i < pdfInputs.length; i++) {
            try {
                const chunks = await this.processEventPdf(pdfInputs[i]);
                const prefixedChunks = chunks.map(c => ({
                    ...c,
                    chunkId: `pdf${i}_${c.chunkId}`
                }));
                allChunks = allChunks.concat(prefixedChunks);
            } catch (err) {
                console.error(`❌ [ADMIN] Failed to process PDF ${i + 1}:`, err);
            }
        }

        return allChunks;
    }

    static async processEventPdf(pdfInput: string): Promise<any[]> {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const inputPath = path.join(this.tempDir, `admin_event_${timestamp}.pdf`);
        const outputPath = path.join(this.tempDir, `admin_embeddings_${timestamp}.json`);

        try {
            let buffer: Buffer;

            if (pdfInput.startsWith('http')) {
                const response = await fetch(pdfInput);
                const arrayBuffer = await response.arrayBuffer();
                buffer = Buffer.from(arrayBuffer);
            } else {
                const base64Data = pdfInput.includes(',') ? pdfInput.split(',')[1] : pdfInput;
                buffer = Buffer.from(base64Data, 'base64');
            }

            fs.writeFileSync(inputPath, buffer);

            const command = `python "${this.pipelineScript}" "${inputPath}" "${outputPath}"`;
            console.log(`🐍 [ADMIN] Executing Python pipeline: ${command}`);

            const { stdout, stderr } = await execPromise(command);
            if (stderr) console.error(`[Python Stderr]: ${stderr}`);

            if (!fs.existsSync(outputPath)) {
                throw new Error("Pipeline output file was not created.");
            }

            const rawData = fs.readFileSync(outputPath, 'utf-8');
            const data = JSON.parse(rawData);

            const chunks = data.map((item: any) => ({
                chunkId: item.id,
                text: item.text,
                embedding: item.embedding
            }));

            return chunks;

        } catch (error) {
            console.error("❌ [ADMIN] RAG Pipeline failed:", error);
            throw error;
        } finally {
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (cleanupError) {
                console.error("Warning: Cleanup failed:", cleanupError);
            }
        }
    }
}
