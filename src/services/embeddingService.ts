import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const EmbeddingService = {
    /**
     * Generates a text embedding using Gemini 'text-embedding-004'.
     * Dimensions: 768
     */
    generateEmbedding: async (text: string): Promise<number[]> => {
        try {
            if (!text || !text.trim()) {
                console.log("ℹ️ [EMBEDDING] No text to embed");
                return [];
            }

            if (!genAI) {
                console.error("❌ [EMBEDDING] GEMINI_API_KEY is missing in Admin Backend. Check .env");
                return [];
            }

            const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
            const result = await model.embedContent(text);
            const embedding = result.embedding.values;

            console.log(`✅ [EMBEDDING] Generated Gemini embedding (${embedding.length} dims)`);
            return embedding;
        } catch (error) {
            console.error("❌ [EMBEDDING] Error generating Gemini embedding:", error);
            return [];
        }
    },

    createUserProfileText: (user: any): string => {
        const parts = [
            user.interests?.join(", "),
            user.skills?.join(", "),
            user.role,
            user.primaryGoal,
            user.location,
            user.company,
            user.oneLiner
        ].filter(Boolean);
        return parts.join(". ");
    },

    createEventMetadataText: (event: any): string => {
        const parts = [
            event.name,
            event.headline,
            event.description,
            event.tags?.join(", "),
            event.location
        ].filter(Boolean);
        return parts.join(". ");
    },

    createEventText: (event: any): string => {
        const parts = [
            event.name,
            event.headline,
            event.description,
            event.tags?.join(", "),
            event.location,
            ...(event.pdfExtractedTexts || [])
        ].filter(Boolean);
        return parts.join(". ");
    }
};
