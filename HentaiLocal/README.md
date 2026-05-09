# HentaiLocal Extension for SillyTavern

A SillyTavern extension that combines local image gallery functionality with multi-site booru scraping capabilities.

## Features

- **Local Image Gallery**: Upload and manage character-specific images with `::img::` tag support
- **Booru Scraper**: Search and import images from multiple booru sites (Rule34, Gelbooru, Danbooru, etc.)
- **AI-Powered Naming**: Automatically generate descriptive names and descriptions for uploaded images using OpenAI or local LLMs
- **Prompt Injection**: Inject image lists into character prompts for contextual usage
- **Tag-based Selection**: Use `::img CharacterName imageName::` syntax to display images in chat

## Installation

### Method 1: Manual Installation

1. Download the latest release or clone this repository
2. Extract/copy the files to your SillyTavern extensions folder:
   ```
   SillyTavern/
   └── extensions/
       └── HentaiLocal/
           ├── src/
           │   ├── index.js
           │   ├── Gallery.jsx
           │   ├── BooruScraper.js
           │   ├── AINaming.js
           │   ├── SettingsPanel.jsx
           │   └── ScraperPanel.jsx
           ├── style.css
           └── README.md
   ```

3. Restart SillyTavern or refresh the page
4. The HentaiLocal button should appear in the character panel

### Method 2: Git Clone

```bash
cd /path/to/SillyTavern/extensions/
git clone https://github.com/yourusername/HentaiLocal.git
```

## Configuration

### Basic Setup

1. Click the HentaiLocal (globe) button in the character panel to open the gallery
2. Upload images by dragging/dropping or clicking the upload button
3. Assign names to images for use in chat

### AI Naming Setup

1. Enable AI Naming in Settings
2. Configure your preferred provider:
   - **OpenAI**: Requires API key (gpt-4o-mini recommended)
   - **NanoGPT**: Alternative API
   - **Local LLM**: Self-hosted option
   - **Oobabooga**: Local API server

### Booru Scraper Setup

1. Enable desired booru sites in Settings
2. Configure:
   - Max Results per search
   - Default site
   - Safe Mode (filters NSFW content)
   - Download Quality (thumbnail/sample/original)

## Usage

### Image Tags

Use the `::img::` syntax in your messages to display images:

```
::img {{char}} happy::          # Character's specific image
::img {{user}} portrait::       # User's image
::img {{group}} location::      # Group chat image
```

### Gallery Operations

- **Upload**: Drag/drop images or use the upload button
- **Assign**: Click an image to assign a name and description
- **AI Name**: Use the magic wand button to auto-generate names
- **Scraper**: Click the globe button to search booru sites
- **Settings**: Configure AI naming, scraper options, and site preferences

### AI Naming

- **Single Image**: Click the magic wand icon on an unassigned image
- **Batch Naming**: Click "Batch AI Name" to process all unassigned images
- Generated names and descriptions help the AI understand when to use each image

## Supported Booru Sites

| Site | Category | Status |
|------|----------|--------|
| Rule34.xxx | NSFW | Enabled by default |
| Gelbooru | NSFW | Enabled by default |
| Danbooru | SFW/NSFW | Enabled by default |
| Paheal | NSFW | Disabled by default |
| Yande.re | SFW | Disabled by default |
| Konachan | SFW/NSFW | Disabled by default |
| Zerochan | SFW | Disabled by default |
| Sankaku | NSFW | Disabled by default |

## File Structure

```
HentaiLocal/
├── src/
│   ├── index.js         # Main entry point, exports
│   ├── Gallery.jsx      # Image gallery component
│   ├── BooruScraper.js   # Booru API integration
│   ├── AINaming.js      # AI naming service
│   ├── SettingsPanel.jsx # Settings UI
│   └── ScraperPanel.jsx  # Scraper modal UI
├── style.css            # Extension styles
└── README.md            # This file
```

## API Reference

### Exported Functions

```javascript
// Custom Prompt Management
addCustomPrompt(name, template)     // Add and return prompt ID
updateCustomPrompt(id, name, template)  // Update existing prompt
deleteCustomPrompt(id)              // Delete prompt by ID

// Classes
BooruScraper              // Image scraping from booru sites
AINaming                  // AI-powered image naming
SettingsPanel             // React settings component
```

### BooruScraper Methods

```javascript
// Search for images
await BooruScraper.search(tags, options)

// Download image as base64
await BooruScraper.downloadImage(url)

// Get tag suggestions
await BooruScraper.getTagSuggestions(partialTag, site)
```

## Troubleshooting

### Images not showing in chat

1. Ensure the image is assigned a name
2. Check that the tag syntax matches exactly (case-sensitive)
3. Verify the image file exists in the character's folder

### Scraper not working

1. Check your internet connection
2. Verify the booru site is enabled in settings
3. Some sites may have rate limits - wait and try again

### AI Naming fails

1. Verify your API key is correct
2. Check that you have sufficient API credits
3. Try a different model (gpt-4o-mini is recommended)

## Development

### Building

```bash
npm install
npm run build
```

### Requirements

- SillyTavern v1.11.0 or later
- Node.js 18+ (for building)
- Modern browser with ES6 support

## License

MIT License - See LICENSE file for details

## Credits

Based on SillyTavern-LocalImage extension with additional booru scraping functionality.