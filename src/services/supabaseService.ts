import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Ensure env is loaded
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Singleton Supabase Client
class SupabaseService {
    private static instance: any = null;

    private static getClient() {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
            console.warn("⚠️ Supabase credentials missing. RAG storage will fail.");
            return null;
        }

        if (!this.instance) {
            this.instance = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        }
        return this.instance;
    }

    /**
     * Store Event Document Chunk Embeddings
     */
    static async storeEventDocChunk(eventId: string, text: string, embedding: number[], chunkIndex: number) {
        const client = this.getClient();
        if (!client) return;

        const { error } = await client
            .from('event_embeddings')
            .insert({
                event_id: eventId,
                category: 'doc',
                content: text,
                embedding: embedding,
                chunk_index: chunkIndex,
                extra_metadata: { chunk_index: chunkIndex }
            });

        if (error) console.error("❌ [Supabase] Failed to store Doc Chunk:", error);
    }

    /**
     * Store Event Metadata Embedding
     */
    static async storeEventMetadata(eventId: string, text: string, embedding: number[], metadata: any) {
        const client = this.getClient();
        if (!client) return;

        // Metadata is usually singular per event, so we might want to upsert or just insert
        const { error } = await client
            .from('event_embeddings')
            .insert({
                event_id: eventId,
                category: 'meta',
                content: text,
                embedding: embedding,
                extra_metadata: metadata
            });

        if (error) console.error("❌ [Supabase] Failed to store Metadata:", error);
    }

    /**
     * Store Member Profile Embedding
     */
    static async storeMemberProfile(eventId: string, userId: string, text: string, embedding: number[], profileData: any) {
        const client = this.getClient();
        if (!client) return;

        const { error } = await client
            .from('event_embeddings')
            .insert({
                event_id: eventId,
                category: 'member',
                content: text,
                embedding: embedding,
                extra_metadata: { user_id: userId, ...profileData }
            });

        if (error) console.error("❌ [Supabase] Failed to store Member Profile:", error);
    }

    /**
     * Delete all embeddings for an event (Clean up)
     */
    static async deleteEventEmbeddings(eventId: string) {
        const client = this.getClient();
        if (!client) return;

        const { error } = await client
            .from('event_embeddings')
            .delete()
            .eq('event_id', eventId);

        if (error) console.error("❌ [Supabase] Failed to delete event embeddings:", error);
    }
}

export { SupabaseService };
