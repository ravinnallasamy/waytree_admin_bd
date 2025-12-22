import { pipeline } from "@xenova/transformers";

// Type definition for the pipeline function
type FeatureExtractionPipeline = (text: string | string[], options?: any) => Promise<any>;

// Singleton to hold the pipeline instance
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

// Function to get or initialize the pipeline
const getExtractor = (): Promise<FeatureExtractionPipeline> => {
    if (!extractorPromise) {
        // We use all-mpnet-base-v2 which produces 768-dim embeddings
        // This matches our MongoDB vector index configuration.
        // The model is downloaded automatically on first use.
        console.log("Loading local embedding model (Xenova/all-mpnet-base-v2)...");
        extractorPromise = pipeline("feature-extraction", "Xenova/all-mpnet-base-v2");
    }
    return extractorPromise;
};

export const EmbeddingService = {
    /**
     * Generates a text embedding using local 'all-mpnet-base-v2' model.
     * Dimensions: 768
     */
    generateEmbedding: async (text: string): Promise<number[]> => {
        try {
            if (!text || !text.trim()) {
                console.log("ℹ️ No text to embed");
                return [];
            }

            const extractor = await getExtractor();

            // Generate embedding
            // pooling: 'mean' averages the token embeddings to get a single sentence embedding
            // normalize: true ensures the vector has length 1 (good for cosine similarity)
            const output = await extractor(text, { pooling: "mean", normalize: true });

            // Convert Tensor to plain array
            // output.data is a Float32Array
            const embedding = Array.from(output.data) as number[];

            return embedding;
        } catch (error) {
            console.error("Error generating local embedding:", error);
            throw error;
        }
    },

    /**
     * Creates a composite text string from user profile fields.
     * Semantic fields: interests, skills, role, primaryGoal, location
     */
    createUserProfileText: (user: any): string => {
        const parts = [
            user.interests?.join(", "),
            user.skills?.join(", "),
            user.role,
            user.primaryGoal,
            user.location,
        ].filter(Boolean);

        return parts.join(". ");
    },

    /**
     * Creates a composite text string from event fields.
     * Semantic fields: name, description, tags, location, headline
     */
    createEventText: (event: any): string => {
        const parts = [
            event.name,
            event.headline,
            event.description,
            event.tags?.join(", "),
            event.location
        ].filter(Boolean);

        return parts.join(". ");
    }
};
