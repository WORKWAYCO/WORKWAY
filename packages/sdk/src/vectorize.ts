/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ActionResult } from './action-result';
import { IntegrationError, ErrorCode } from './integration-error';
import { WorkersAI, AIModels } from './workers-ai';

/**
 * Cloudflare Vectorize integration for WORKWAY SDK
 *
 * Enables semantic search and RAG (Retrieval Augmented Generation) workflows:
 * - Store embeddings from any AI model
 * - Semantic similarity search
 * - Build knowledge bases
 * - Power recommendation systems
 * - Enable long-term memory for AI agents
 */

export interface VectorMetadata {
  id?: string;
  text?: string;
  source?: string;
  timestamp?: number;
  [key: string]: any;
}

export interface VectorSearchOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
  includeDistances?: boolean;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata?: VectorMetadata;
}

/**
 * Vectorize client for semantic search and embeddings storage
 */
export class Vectorize {
  private vectorDB: any; // Cloudflare Vectorize binding
  private ai?: WorkersAI;
  private defaultModel: string = AIModels.BGE_BASE;

  constructor(vectorDB: any, ai?: WorkersAI) {
    this.vectorDB = vectorDB;
    this.ai = ai;
  }

  /**
   * Store embeddings with metadata
   */
  async upsert(options: {
    id: string;
    values: number[];
    metadata?: VectorMetadata;
  }): Promise<ActionResult> {
    try {
      await this.vectorDB.upsert([{
        id: options.id,
        values: options.values,
        metadata: options.metadata || {}
      }]);

      return ActionResult.success({
        id: options.id,
        dimension: options.values.length,
        stored: true
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to store vector: ${error}`,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  /**
   * Store multiple embeddings in batch
   */
  async upsertBatch(vectors: Array<{
    id: string;
    values: number[];
    metadata?: VectorMetadata;
  }>): Promise<ActionResult> {
    try {
      await this.vectorDB.upsert(vectors);

      return ActionResult.success({
        count: vectors.length,
        stored: true
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to store vectors: ${error}`,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  /**
   * Search for similar vectors
   */
  async query(options: {
    vector: number[];
    topK?: number;
    filter?: Record<string, any>;
  }): Promise<ActionResult> {
    try {
      const results = await this.vectorDB.query({
        vector: options.vector,
        topK: options.topK || 10,
        filter: options.filter
      });

      return ActionResult.success({
        matches: results.matches || [],
        count: results.matches?.length || 0
      }, {
        metadata: {
          topK: options.topK || 10,
          filtered: !!options.filter
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Vector search failed: ${error}`,
        ErrorCode.SEARCH_ERROR
      );
    }
  }

  /**
   * Store text with automatic embedding generation
   */
  async storeText(options: {
    id: string;
    text: string;
    metadata?: VectorMetadata;
    model?: string;
  }): Promise<ActionResult> {
    if (!this.ai) {
      return ActionResult.error(
        'AI client required for text embedding',
        ErrorCode.CONFIGURATION_ERROR
      );
    }

    try {
      // Generate embeddings
      const embedResult = await this.ai.generateEmbeddings({
        text: options.text,
        model: options.model || this.defaultModel
      });

      if (!embedResult.success) {
        return embedResult;
      }

      // Store with metadata including original text
      const metadata = {
        ...options.metadata,
        text: options.text,
        model: options.model || this.defaultModel,
        timestamp: Date.now()
      };

      return await this.upsert({
        id: options.id,
        values: embedResult.data[0],
        metadata
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to store text: ${error}`,
        ErrorCode.PROCESSING_ERROR
      );
    }
  }

  /**
   * Search using text query (generates embeddings automatically)
   */
  async searchText(options: {
    query: string;
    topK?: number;
    filter?: Record<string, any>;
    model?: string;
  }): Promise<ActionResult> {
    if (!this.ai) {
      return ActionResult.error(
        'AI client required for text search',
        ErrorCode.CONFIGURATION_ERROR
      );
    }

    try {
      // Generate query embeddings
      const embedResult = await this.ai.generateEmbeddings({
        text: options.query,
        model: options.model || this.defaultModel
      });

      if (!embedResult.success) {
        return embedResult;
      }

      // Search with embeddings
      const searchResult = await this.query({
        vector: embedResult.data[0],
        topK: options.topK,
        filter: options.filter
      });

      if (!searchResult.success) {
        return searchResult;
      }

      // Enhance results with original text if available
      const matches = searchResult.data.matches.map((match: any) => ({
        ...match,
        text: match.metadata?.text,
        snippet: match.metadata?.text?.slice(0, 200)
      }));

      return ActionResult.success({
        query: options.query,
        matches,
        count: matches.length
      }, {
        metadata: {
          model: options.model || this.defaultModel,
          topK: options.topK || 10
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Text search failed: ${error}`,
        ErrorCode.SEARCH_ERROR
      );
    }
  }

  /**
   * Build a knowledge base from documents
   */
  async buildKnowledgeBase(options: {
    documents: Array<{
      id: string;
      content: string;
      metadata?: any;
    }>;
    chunkSize?: number;
    overlap?: number;
    model?: string;
  }): Promise<ActionResult> {
    if (!this.ai) {
      return ActionResult.error(
        'AI client required for knowledge base',
        ErrorCode.CONFIGURATION_ERROR
      );
    }

    const chunkSize = options.chunkSize || 500;
    const overlap = options.overlap || 50;
    const chunks: Array<{
      id: string;
      text: string;
      metadata: any;
    }> = [];

    try {
      // Chunk documents
      for (const doc of options.documents) {
        const words = doc.content.split(/\s+/);
        for (let i = 0; i < words.length; i += chunkSize - overlap) {
          const chunk = words.slice(i, i + chunkSize).join(' ');
          if (chunk.trim()) {
            chunks.push({
              id: `${doc.id}_chunk_${i}`,
              text: chunk,
              metadata: {
                ...doc.metadata,
                documentId: doc.id,
                chunkIndex: Math.floor(i / (chunkSize - overlap)),
                chunkStart: i
              }
            });
          }
        }
      }

      // Generate embeddings for all chunks
      const embeddings = await this.ai.generateEmbeddings({
        text: chunks.map(c => c.text),
        model: options.model || this.defaultModel
      });

      if (!embeddings.success) {
        return embeddings;
      }

      // Store all chunks with embeddings
      const vectors = chunks.map((chunk, i) => ({
        id: chunk.id,
        values: embeddings.data[i],
        metadata: {
          ...chunk.metadata,
          text: chunk.text,
          model: options.model || this.defaultModel
        }
      }));

      await this.vectorDB.upsert(vectors);

      return ActionResult.success({
        documents: options.documents.length,
        chunks: chunks.length,
        model: options.model || this.defaultModel
      }, {
        metadata: {
          chunkSize,
          overlap,
          totalCharacters: options.documents.reduce((sum, d) => sum + d.content.length, 0)
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to build knowledge base: ${error}`,
        ErrorCode.PROCESSING_ERROR
      );
    }
  }

  /**
   * Perform RAG (Retrieval Augmented Generation)
   */
  async rag(options: {
    query: string;
    topK?: number;
    model?: string;
    generationModel?: string;
    systemPrompt?: string;
    temperature?: number;
  }): Promise<ActionResult> {
    if (!this.ai) {
      return ActionResult.error(
        'AI client required for RAG',
        ErrorCode.CONFIGURATION_ERROR
      );
    }

    try {
      // Step 1: Search for relevant context
      const searchResult = await this.searchText({
        query: options.query,
        topK: options.topK || 5,
        model: options.model
      });

      if (!searchResult.success) {
        return searchResult;
      }

      // Step 2: Build context from search results
      const context = searchResult.data.matches
        .map((match: any) => match.text || match.metadata?.text)
        .filter(Boolean)
        .join('\n\n');

      if (!context) {
        return ActionResult.error(
          'No relevant context found',
          ErrorCode.NOT_FOUND
        );
      }

      // Step 3: Generate response with context
      const systemPrompt = options.systemPrompt ||
        'You are a helpful assistant. Use the following context to answer the question. If the answer is not in the context, say so.';

      const prompt = `Context:\n${context}\n\nQuestion: ${options.query}\n\nAnswer:`;

      const response = await this.ai.generateText({
        prompt,
        system: systemPrompt,
        model: options.generationModel || AIModels.LLAMA_3_8B,
        temperature: options.temperature || 0.7,
        max_tokens: 1000
      });

      if (!response.success) {
        return response;
      }

      return ActionResult.success({
        answer: response.data.response,
        sources: searchResult.data.matches.map((m: any) => ({
          id: m.id,
          score: m.score,
          text: m.text?.slice(0, 200) + '...'
        })),
        query: options.query
      }, {
        metadata: {
          contextSize: context.length,
          sourcesUsed: searchResult.data.matches.length,
          model: options.generationModel || AIModels.LLAMA_3_8B
        }
      });
    } catch (error) {
      return ActionResult.error(
        `RAG operation failed: ${error}`,
        ErrorCode.PROCESSING_ERROR
      );
    }
  }

  /**
   * Delete vectors by ID
   */
  async delete(ids: string[]): Promise<ActionResult> {
    try {
      await this.vectorDB.deleteByIds(ids);

      return ActionResult.success({
        deleted: ids.length,
        ids
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to delete vectors: ${error}`,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  /**
   * Get vector by ID
   */
  async get(id: string): Promise<ActionResult> {
    try {
      const result = await this.vectorDB.getByIds([id]);

      if (!result || result.length === 0) {
        return ActionResult.error(
          `Vector ${id} not found`,
          ErrorCode.NOT_FOUND
        );
      }

      return ActionResult.success(result[0]);
    } catch (error) {
      return ActionResult.error(
        `Failed to get vector: ${error}`,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  /**
   * Create a recommendation system
   */
  async recommend(options: {
    userId: string;
    itemIds: string[];
    topK?: number;
    filter?: Record<string, any>;
  }): Promise<ActionResult> {
    try {
      // Get user's interaction vectors
      const userVectors = await this.vectorDB.getByIds(options.itemIds);

      if (!userVectors || userVectors.length === 0) {
        return ActionResult.error(
          'No user history found',
          ErrorCode.NOT_FOUND
        );
      }

      // Calculate average vector (user preference)
      const avgVector = new Array(userVectors[0].values.length).fill(0);
      for (const vec of userVectors) {
        for (let i = 0; i < vec.values.length; i++) {
          avgVector[i] += vec.values[i] / userVectors.length;
        }
      }

      // Find similar items
      const recommendations = await this.query({
        vector: avgVector,
        topK: (options.topK || 10) + options.itemIds.length,
        filter: options.filter
      });

      if (!recommendations.success) {
        return recommendations;
      }

      // Filter out items user already interacted with
      const filtered = recommendations.data.matches
        .filter((match: any) => !options.itemIds.includes(match.id))
        .slice(0, options.topK || 10);

      return ActionResult.success({
        recommendations: filtered,
        userId: options.userId,
        basedOn: options.itemIds.length
      }, {
        metadata: {
          method: 'collaborative_filtering',
          confidence: filtered[0]?.score || 0
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Recommendation generation failed: ${error}`,
        ErrorCode.PROCESSING_ERROR
      );
    }
  }
}

/**
 * Helper function to create a Vectorize client
 */
export function createVectorClient(env: { VECTORDB: any; AI?: any }): Vectorize {
  if (!env.VECTORDB) {
    throw new Error('Vectorize binding not found. Add [[vectorize]] binding to wrangler.toml');
  }

  const ai = env.AI ? new WorkersAI(env.AI) : undefined;
  return new Vectorize(env.VECTORDB, ai);
}