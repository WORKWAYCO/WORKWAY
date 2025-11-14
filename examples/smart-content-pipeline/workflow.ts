/**
 * Smart Content Generation Pipeline
 *
 * This workflow showcases advanced AI capabilities for content creators:
 * - Generate articles with AI
 * - Create matching images with Stable Diffusion
 * - Optimize for SEO
 * - Translate to multiple languages
 * - Post to multiple platforms
 *
 * Perfect for content agencies, marketers, and creators who need
 * to produce multilingual, multi-platform content at scale.
 *
 * Cost: ~$0.15 per piece of content (vs $50+ with traditional tools)
 */

import { defineWorkflow, schedule, manual } from '@workway/sdk';
import { createAIClient, AIModels } from '@workway/sdk/workers-ai';

export default defineWorkflow({
  name: 'Smart Content Pipeline',
  description: 'AI-powered content generation and distribution across platforms',
  version: '1.0.0',

  pricing: {
    model: 'subscription',
    tiers: [
      { name: 'starter', price: 49, executions: 30 },    // ~30 articles/month
      { name: 'pro', price: 149, executions: 100 },      // ~100 articles/month
      { name: 'agency', price: 499, executions: 500 }    // ~500 articles/month
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

  trigger: manual(), // Can also use schedule() for regular content

  async execute({ inputs, integrations, env }) {
    const ai = createAIClient(env);
    const results = {
      content: {},
      images: [],
      translations: {},
      published: {}
    };

    // Step 1: Generate the main content
    console.log('📝 Generating content...');

    const contentPrompt = inputs.contentType === 'blog-post'
      ? `Write a comprehensive 800-word blog post about "${inputs.topic}". Target audience: ${inputs.targetAudience}. Include:
         1. Engaging introduction
         2. 3-4 main sections with subheadings
         3. Practical examples
         4. Conclusion with call-to-action
         Format with markdown.`
      : inputs.contentType === 'social-media'
      ? `Create social media content about "${inputs.topic}":
         1. Twitter thread (5-7 tweets)
         2. LinkedIn post (200 words)
         3. Instagram caption (150 words)
         Include relevant hashtags and emojis.`
      : inputs.contentType === 'newsletter'
      ? `Write a newsletter about "${inputs.topic}". Include:
         1. Attention-grabbing subject line
         2. 500-word main content
         3. 3 key takeaways
         4. Links section
         Format for email.`
      : `Write a technical article about "${inputs.topic}" for ${inputs.targetAudience} audience.`;

    const content = await ai.generateText({
      model: AIModels.LLAMA_3_8B,
      prompt: contentPrompt,
      temperature: 0.7,
      max_tokens: 2000,
      cache: false // Don't cache unique content
    });

    results.content.main = content.data?.response;

    // Step 2: Generate SEO metadata
    console.log('🔍 Optimizing for SEO...');

    const seoResult = await ai.generateText({
      model: AIModels.LLAMA_2_7B, // Faster model for metadata
      prompt: `Generate SEO metadata for this content:
        ${results.content.main?.slice(0, 500)}

        Provide:
        1. Title (60 chars max)
        2. Meta description (160 chars max)
        3. 5-10 keywords
        4. Social media preview text
        Format as JSON.`,
      temperature: 0.3,
      max_tokens: 300,
      cache: true
    });

    try {
      results.content.seo = JSON.parse(seoResult.data?.response || '{}');
    } catch {
      results.content.seo = {
        title: inputs.topic,
        description: results.content.main?.slice(0, 160),
        keywords: []
      };
    }

    // Step 3: Generate images if requested
    if (inputs.generateImages) {
      console.log('🎨 Generating images...');

      // Generate hero image
      const imagePrompt = inputs.imageStyle === 'photorealistic'
        ? `Professional photograph: ${inputs.topic}, high quality, detailed, 8k`
        : inputs.imageStyle === 'illustration'
        ? `Digital illustration: ${inputs.topic}, modern style, vibrant colors`
        : inputs.imageStyle === 'abstract'
        ? `Abstract art representing: ${inputs.topic}, creative, colorful`
        : `Technical diagram: ${inputs.topic}, clean, professional, informative`;

      const heroImage = await ai.generateImage({
        prompt: imagePrompt,
        model: AIModels.STABLE_DIFFUSION_XL,
        negative_prompt: 'text, watermark, low quality, blurry',
        steps: 25,
        width: 1024,
        height: 768
      });

      results.images.push({
        type: 'hero',
        data: heroImage.data,
        prompt: imagePrompt
      });

      // Generate thumbnail
      const thumbnailImage = await ai.generateImage({
        prompt: `Thumbnail image: ${inputs.topic}, simple, eye-catching`,
        model: AIModels.DREAMSHAPER,
        steps: 15,
        width: 512,
        height: 512
      });

      results.images.push({
        type: 'thumbnail',
        data: thumbnailImage.data
      });
    }

    // Step 4: Translate content if needed
    if (inputs.languages.length > 1) {
      console.log('🌍 Translating content...');

      for (const lang of inputs.languages) {
        if (lang === 'en') continue; // Skip English (original)

        const translation = await ai.translateText({
          text: results.content.main,
          source: 'en',
          target: lang,
          model: AIModels.M2M100
        });

        results.translations[lang] = translation.data?.text;

        // Translate SEO metadata too
        const seoTranslation = await ai.translateText({
          text: results.content.seo.title + ' ' + results.content.seo.description,
          source: 'en',
          target: lang
        });

        results.translations[`${lang}_seo`] = seoTranslation.data?.text;
      }
    }

    // Step 5: Generate social media variations
    console.log('📱 Creating social variations...');

    const socialContent = await ai.chain([
      {
        type: 'text',
        options: {
          prompt: `Create a Twitter thread (5 tweets) about: ${inputs.topic}\nBase on: ${results.content.main?.slice(0, 500)}`,
          model: AIModels.LLAMA_2_7B,
          temperature: 0.8,
          max_tokens: 500
        }
      },
      {
        type: 'text',
        options: {
          prompt: `Create a LinkedIn post about: ${inputs.topic}\n200 words, professional tone`,
          model: AIModels.LLAMA_2_7B,
          temperature: 0.6,
          max_tokens: 300
        }
      },
      {
        type: 'sentiment',
        options: {
          text: results.content.main?.slice(0, 500)
        }
      }
    ]);

    results.content.twitter = socialContent[0].data?.response;
    results.content.linkedin = socialContent[1].data?.response;
    results.content.sentiment = socialContent[2].data;

    // Step 6: Publish to selected platforms
    console.log('🚀 Publishing content...');

    // Publish to Notion
    if (inputs.publishTo.includes('notion')) {
      const notionPage = await integrations.notion.pages.create({
        parent: { database_id: inputs.notionDatabaseId },
        properties: {
          'Title': {
            title: [{ text: { content: results.content.seo.title || inputs.topic } }]
          },
          'Status': {
            select: { name: 'Published' }
          },
          'Language': {
            multi_select: inputs.languages.map(lang => ({ name: lang }))
          },
          'Type': {
            select: { name: inputs.contentType }
          }
        },
        children: [
          {
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [{ text: { content: inputs.topic } }]
            }
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: results.content.main || '' } }]
            }
          },
          // Add images if generated
          ...(results.images.length > 0 ? [{
            object: 'block' as const,
            type: 'image' as const,
            image: {
              type: 'external' as const,
              external: {
                url: `data:image/png;base64,${results.images[0].data}`
              }
            }
          }] : [])
        ]
      });

      results.published.notion = notionPage.url;
    }

    // Publish to WordPress
    if (inputs.publishTo.includes('wordpress') && integrations.wordpress) {
      // Upload images first
      let featuredImageId;
      if (results.images.length > 0) {
        const imageUpload = await integrations.wordpress.media.upload({
          file: results.images[0].data,
          title: `${inputs.topic} - Hero Image`,
          alt_text: inputs.topic
        });
        featuredImageId = imageUpload.id;
      }

      const wpPost = await integrations.wordpress.posts.create({
        title: results.content.seo.title,
        content: results.content.main,
        excerpt: results.content.seo.description,
        status: 'draft', // Or 'publish' for immediate publishing
        featured_media: featuredImageId,
        tags: results.content.seo.keywords
      });

      results.published.wordpress = wpPost.link;
    }

    // Post to Twitter
    if (inputs.publishTo.includes('twitter') && integrations.twitter) {
      const tweets = results.content.twitter?.split('\n\n') || [];
      const tweetThread = [];

      for (let i = 0; i < tweets.length && i < 5; i++) {
        const tweet = await integrations.twitter.tweets.create({
          text: tweets[i],
          reply_to: i > 0 ? tweetThread[i - 1].id : undefined
        });
        tweetThread.push(tweet);
      }

      results.published.twitter = tweetThread[0]?.url;
    }

    // Post to LinkedIn
    if (inputs.publishTo.includes('linkedin') && integrations.linkedin) {
      const linkedinPost = await integrations.linkedin.posts.create({
        text: results.content.linkedin,
        visibility: 'public'
      });

      results.published.linkedin = linkedinPost.url;
    }

    // Step 7: Generate content analytics embeddings
    const contentEmbedding = await ai.generateEmbeddings({
      text: results.content.main,
      model: AIModels.BGE_BASE
    });

    // Store for content similarity analysis
    await integrations.storage?.set(`content:${Date.now()}`, {
      embedding: contentEmbedding.data,
      metadata: {
        topic: inputs.topic,
        type: inputs.contentType,
        languages: inputs.languages,
        sentiment: results.content.sentiment,
        published: results.published
      }
    });

    // Return comprehensive results
    return {
      success: true,
      content: {
        main: results.content.main,
        seo: results.content.seo,
        social: {
          twitter: results.content.twitter,
          linkedin: results.content.linkedin
        }
      },
      images: {
        count: results.images.length,
        hero: results.images[0]?.data ? 'generated' : null,
        thumbnail: results.images[1]?.data ? 'generated' : null
      },
      translations: Object.keys(results.translations),
      published: results.published,
      analytics: {
        sentiment: results.content.sentiment,
        wordCount: results.content.main?.split(' ').length || 0,
        readingTime: Math.ceil((results.content.main?.split(' ').length || 0) / 200) + ' min'
      },
      aiUsage: {
        estimatedCost: '$0.15',
        modelsUsed: [
          AIModels.LLAMA_3_8B,
          AIModels.STABLE_DIFFUSION_XL,
          AIModels.M2M100
        ]
      }
    };
  },

  onError: async ({ error }) => {
    console.error('Content pipeline failed:', error);
    // Could send notification or save draft
  }
});