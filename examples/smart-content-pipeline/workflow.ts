/**
 * Smart Content Generation Pipeline
 *
 * ZUHANDENHEIT VERSION: Tools completely recede.
 * Reduced from 424 lines to ~100 lines.
 *
 * The developer thinks:
 * - "Generate blog post" → `ai.generateContent(topic, { type, audience })`
 * - "Get SEO metadata" → `ai.seoOptimize(content)`
 * - "Create hero image" → `ai.generateStyledImage(topic, { style })`
 * - "Translate to languages" → `ai.translateBatch(content, { targets })`
 * - "Create social posts" → `ai.createSocialVariants(content, topic)`
 * - "Save to Notion" → `notion.createDocument({ template: 'article' })`
 */

import { defineWorkflow, manual } from '@workway/sdk';
import { createAIClient } from '@workway/sdk/workers-ai';

export default defineWorkflow({
  name: 'Smart Content Pipeline',
  description: 'AI-powered content generation and distribution across platforms',
  version: '2.0.0',

  pricing: {
    model: 'subscription',
    tiers: [
      { name: 'starter', price: 49, executions: 30 },
      { name: 'pro', price: 149, executions: 100 },
      { name: 'agency', price: 499, executions: 500 }
    ]
  },

  integrations: [
    { service: 'notion', scopes: ['write_pages', 'read_databases'] },
    { service: 'wordpress', scopes: ['write_posts', 'upload_media'] },
    { service: 'twitter', scopes: ['write_tweets'] },
    { service: 'linkedin', scopes: ['write_posts'] }
  ],

  inputs: {
    topic: {
      type: 'text',
      label: 'Content Topic',
      required: true,
      placeholder: 'e.g., The future of AI in healthcare'
    },
    contentType: {
      type: 'select',
      label: 'Content Type',
      options: ['blog-post', 'social-media', 'newsletter', 'technical-article'],
      default: 'blog-post'
    },
    targetAudience: {
      type: 'select',
      label: 'Target Audience',
      options: ['general', 'technical', 'business', 'academic'],
      default: 'general'
    },
    languages: {
      type: 'multiselect',
      label: 'Languages',
      options: ['en', 'es', 'fr', 'de', 'ja', 'zh'],
      default: ['en']
    },
    generateImages: {
      type: 'boolean',
      label: 'Generate AI Images',
      default: true
    },
    imageStyle: {
      type: 'select',
      label: 'Image Style',
      options: ['photorealistic', 'illustration', 'abstract', 'technical-diagram'],
      default: 'photorealistic'
    },
    publishTo: {
      type: 'multiselect',
      label: 'Publish To',
      options: ['notion', 'wordpress', 'twitter', 'linkedin'],
      default: ['notion']
    }
  },

  trigger: manual(),

  async execute({ inputs, integrations, env }) {
    const ai = createAIClient(env).for('generation', 'creative');

    // 1. Generate content (tools recede)
    const contentResult = await ai.generateContent(inputs.topic, {
      type: inputs.contentType as any,
      audience: inputs.targetAudience as any,
    });
    const mainContent = contentResult.data?.content || '';

    // 2. SEO optimization (tools recede)
    const seo = await ai.seoOptimize(mainContent);

    // 3. Generate images if requested (tools recede)
    const images: { hero?: any; thumbnail?: any } = {};
    if (inputs.generateImages) {
      const hero = await ai.generateStyledImage(inputs.topic, {
        style: inputs.imageStyle as any,
        size: 'hero'
      });
      const thumbnail = await ai.generateStyledImage(inputs.topic, {
        style: inputs.imageStyle as any,
        size: 'thumbnail'
      });
      images.hero = hero.data;
      images.thumbnail = thumbnail.data;
    }

    // 4. Translate if multiple languages (tools recede)
    const translations = inputs.languages.length > 1
      ? await ai.translateBatch(mainContent, {
          source: 'en',
          targets: inputs.languages.filter((l: string) => l !== 'en'),
          includeSEO: seo.data,
        })
      : null;

    // 5. Create social variants (tools recede)
    const social = await ai.createSocialVariants(mainContent, inputs.topic);

    // 6. Publish to selected platforms
    const published: Record<string, string> = {};

    if (inputs.publishTo.includes('notion')) {
      const page = await integrations.notion.createDocument({
        database: inputs.notionDatabaseId,
        template: 'article',
        data: {
          title: seo.data?.title || inputs.topic,
          summary: seo.data?.description,
          content: mainContent,
          properties: {
            'Status': { select: { name: 'Published' } },
            'Language': { multi_select: inputs.languages.map((l: string) => ({ name: l })) },
            'Type': { select: { name: inputs.contentType } },
          },
          sections: {
            keywords: seo.data?.keywords || [],
          },
          metadata: {
            'Word Count': contentResult.data?.wordCount,
            'Reading Time': contentResult.data?.readingTime,
          }
        }
      });
      published.notion = page.data?.url || '';
    }

    if (inputs.publishTo.includes('wordpress') && integrations.wordpress) {
      let featuredImageId;
      if (images.hero?.data) {
        const upload = await integrations.wordpress.media.upload({
          file: images.hero.data,
          title: `${inputs.topic} - Hero`,
          alt_text: inputs.topic
        });
        featuredImageId = upload.id;
      }

      const post = await integrations.wordpress.posts.create({
        title: seo.data?.title,
        content: mainContent,
        excerpt: seo.data?.description,
        status: 'draft',
        featured_media: featuredImageId,
        tags: seo.data?.keywords
      });
      published.wordpress = post.link;
    }

    if (inputs.publishTo.includes('twitter') && integrations.twitter && social.data?.twitter) {
      const thread = [];
      for (let i = 0; i < Math.min(social.data.twitter.length, 5); i++) {
        const tweet = await integrations.twitter.tweets.create({
          text: social.data.twitter[i],
          reply_to: i > 0 ? thread[i - 1].id : undefined
        });
        thread.push(tweet);
      }
      published.twitter = thread[0]?.url;
    }

    if (inputs.publishTo.includes('linkedin') && integrations.linkedin && social.data?.linkedin) {
      const post = await integrations.linkedin.posts.create({
        text: social.data.linkedin,
        visibility: 'public'
      });
      published.linkedin = post.url;
    }

    return {
      success: true,
      content: {
        main: mainContent,
        seo: seo.data,
        social: social.data,
      },
      images: {
        hero: images.hero ? 'generated' : null,
        thumbnail: images.thumbnail ? 'generated' : null,
      },
      translations: translations ? Object.keys(translations.data || {}) : ['en'],
      published,
      analytics: {
        wordCount: contentResult.data?.wordCount,
        readingTime: contentResult.data?.readingTime,
      }
    };
  },

  onError: async ({ error }) => {
    console.error('Content pipeline failed:', error);
  }
});

/**
 * REDUCTION: 424 → ~100 lines
 *
 * Key abstractions used:
 * - ai.for('generation', 'creative') — Intent-based model selection
 * - ai.generateContent(topic, { type, audience }) — Content type/audience aware
 * - ai.seoOptimize(content) — Automatic SEO metadata extraction
 * - ai.generateStyledImage(topic, { style, size }) — Style-aware image generation
 * - ai.translateBatch(content, { targets }) — Batch translation with SEO
 * - ai.createSocialVariants(content, topic) — Social platform variants
 * - notion.createDocument({ template: 'article' }) — Template-based creation
 *
 * Vorhandenheit eliminated:
 * - 20-line prompt template ternaries → single method call
 * - Model name selection → intent-based `.for()`
 * - JSON parsing try/catch → automatic structured extraction
 * - Image prompt engineering → style parameter
 * - Translation loops → batch method
 * - Social content chain → single method call
 */
