// AINaming.js - AI-powered filename and description generation
/* global SillyTavern */

import axios from 'axios';

class AINaming {
  constructor() {
    this.providers = {
      openai: {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
      },
      nanogpt: {
        name: 'NanoGPT',
        baseUrl: 'https://nanoGPT.com/api/v1',
        models: ['gpt-4', 'gpt-3.5-turbo']
      },
      local: {
        name: 'Local LLM',
        baseUrl: 'http://localhost:1234/v1',
        models: ['local-model']
      },
      oobabooga: {
        name: 'Oobabooga',
        baseUrl: 'http://localhost:5000/api/v1',
        models: ['ooba-model']
      }
    };

    this.settings = {
      provider: 'openai',
      apiKey: '',
      baseUrl: '',
      model: 'gpt-4o-mini',
      maxTokens: 150,
      temperature: 0.7,
      enabled: false
    };
  }

  /**
   * Load settings from extension storage
   */
  loadSettings(storageSettings) {
    if (storageSettings) {
      this.settings = { ...this.settings, ...storageSettings.aiNaming };
    }
  }

  /**
   * Save settings to extension storage
   */
  saveSettings(context) {
    if (context && context.extensionSettings) {
      const settings = context.extensionSettings['HentaiLocal'];
      if (settings) {
        settings.aiNaming = this.settings;
        context.saveSettingsDebounced();
      }
    }
  }

  /**
   * Get request headers for API calls
   */
  getRequestHeaders() {
    try {
      const context = SillyTavern?.getContext?.();
      if (!context || typeof context.getRequestHeaders !== 'function') {
        return { 'Content-Type': 'application/json' };
      }
      return context.getRequestHeaders();
    } catch (e) {
      console.warn('[AINaming] Failed to get request headers:', e);
      return { 'Content-Type': 'application/json' };
    }
  }

  /**
   * Generate filename for an image based on tags/character
   */
  async generateName(tags, character = null, style = 'descriptive') {
    if (!this.settings.enabled || !this.settings.apiKey) {
      return this.fallbackName(tags, character);
    }

    const prompt = this.buildNamePrompt(tags, character, style);
    
    try {
      const response = await this.callAI(prompt);
      const name = this.cleanName(response.trim());
      return name;
    } catch (error) {
      console.error('[AINaming] Name generation failed:', error);
      return this.fallbackName(tags, character);
    }
  }

  /**
   * Generate description for an image
   */
  async generateDescription(tags, character = null) {
    if (!this.settings.enabled || !this.settings.apiKey) {
      return this.fallbackDescription(tags, character);
    }

    const prompt = this.buildDescriptionPrompt(tags, character);
    
    try {
      const response = await this.callAI(prompt);
      return response.trim();
    } catch (error) {
      console.error('[AINaming] Description generation failed:', error);
      return this.fallbackDescription(tags, character);
    }
  }

  /**
   * Build prompt for filename generation
   */
  buildNamePrompt(tags, character, style) {
    const tagList = Array.isArray(tags) ? tags.join(', ') : tags;
    const charInfo = character ? ` for ${character}` : '';
    
    return `Generate a short, descriptive filename (2-4 words, no special characters) for an anime-style image with these tags: ${tagList}.${charInfo}

Style: ${style} - use descriptive, searchable terms. Return only the filename.

Examples:
- "blonde_hair_smiling"
- "red_dress_beach_scene"  
- "cat_ears_playful_pose"

Filename:`;
  }

  /**
   * Build prompt for description generation
   */
  buildDescriptionPrompt(tags, character) {
    const tagList = Array.isArray(tags) ? tags.join(', ') : tags;
    const charInfo = character ? ` featuring ${character}` : '';
    
    return `Write a brief, descriptive phrase (5-10 words) describing an anime image for use as a tooltip/help text. Include key visual elements from: ${tagList}.${charInfo}

Keep it neutral and descriptive. Return only the description phrase.

Examples:
- "Smiling girl with long blonde hair in school uniform"
- "Red-haired character in formal dress pose"

Description:`;
  }

  /**
   * Call AI API with compatible interface
   */
  async callAI(prompt) {
    const provider = this.settings.provider || 'openai';
    const baseUrl = this.settings.baseUrl || this.providers[provider]?.baseUrl || 'https://api.openai.com/v1';
    const model = this.settings.model || 'gpt-4o-mini';

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.settings.apiKey}`
    };

    const body = {
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      max_tokens: this.settings.maxTokens || 150,
      temperature: this.settings.temperature || 0.7
    };

    // Try OpenAI-compatible API first
    try {
      const response = await axios.post(`${baseUrl}/chat/completions`, body, {
        headers,
        timeout: 30000
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      // Fallback to completion API for older APIs
      try {
        const response = await axios.post(`${baseUrl}/completions`, {
          ...body,
          prompt: prompt
        }, { headers, timeout: 30000 });

        return response.data.choices[0].text;
      } catch (fallbackError) {
        throw error;
      }
    }
  }

  /**
   * Clean and format the generated name
   */
  cleanName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50); // Limit length
  }

  /**
   * Fallback name generation without AI
   */
  fallbackName(tags, character) {
    const tagList = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(/[\s,]+/) : []);
    
    // Pick 2-3 most relevant tags
    const relevant = tagList
      .filter(t => t.length > 2 && !['the', 'and', 'with'].includes(t.toLowerCase()))
      .slice(0, 3)
      .map(t => t.replace(/[^a-z0-9_-]/gi, ''))
      .join('_')
      .toLowerCase();

    const charPart = character ? character.replace(/\s+/g, '_').toLowerCase() + '_' : '';
    
    return (charPart + relevant || 'image').replace(/[^a-z0-9_-]/g, '');
  }

  /**
   * Fallback description without AI
   */
  fallbackDescription(tags, character) {
    const tagList = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(/[\s,]+/) : []);
    const mainTags = tagList.slice(0, 5).join(', ');
    const charInfo = character ? ` featuring ${character}` : '';
    
    return `Image with: ${mainTags}${charInfo}`;
  }

  /**
   * Batch generate names and descriptions
   */
  async batchGenerate(posts, character = null) {
    const results = [];
    
    for (const post of posts) {
      try {
        const [name, description] = await Promise.all([
          this.generateName(post.tags, character || post.character, 'descriptive'),
          this.generateDescription(post.tags, character || post.character)
        ]);
        
        results.push({
          ...post,
          generatedName: name,
          generatedDescription: description
        });
      } catch (error) {
        console.error('[AINaming] Batch error for post:', error);
        results.push({
          ...post,
          generatedName: this.fallbackName(post.tags, character),
          generatedDescription: this.fallbackDescription(post.tags, character)
        });
      }
    }
    
    return results;
  }

  /**
   * Check if AI naming is available
   */
  isAvailable() {
    return this.settings.enabled && !!this.settings.apiKey;
  }

  /**
   * Get available providers
   */
  getProviders() {
    return Object.entries(this.providers).map(([key, config]) => ({
      key,
      name: config.name,
      defaultUrl: config.baseUrl
    }));
  }
}

// Export singleton instance
export default new AINaming();