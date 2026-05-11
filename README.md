# HentaiLocal 🔥

**Search, scrape, and organize images from booru sites directly inside SillyTavern — with AI-powered naming and full LocalImage compatibility.**

HentaiLocal combines the full functionality of the [LocalImage](https://github.com/mechamarmot/SillyTavern-LocalImage) extension with a powerful built-in booru image scraper. Search for images on Rule34, Gelbooru, Danbooru, and more, then save them directly into your character's image gallery with AI-generated names.

## Features

### 🖼️ Full LocalImage Compatibility
- **Per-Character Image Galleries** — Each character has their own image library
- **Persona/User Images** — Your persona can also have images (`::img {{user}} pic::`)
- **Quick Image Send** — Floating button for instant image sending
- **AI-Driven Image Display** — Inject image lists into prompts so the AI can choose
- **Simple Tag Syntax** — `::img CharacterName imagename::` or `::img {{user}} imagename::`
- **Hidden from AI** — Image tags are automatically stripped from messages sent to the AI
- **Drag & Drop Upload** — Easy batch image management
- **Group Chat Gallery** — Full support for group chats
- **Custom Prompt Templates** — Configure how image lists are injected

### 🔥 Booru Scraper
- **10+ Booru Sites Supported** — Rule34, Gelbooru, Danbooru, Yande.re, Konachan, Paheal, Sankaku, Zerochan, Lolibooru, Safebooru
- **Tag Autocomplete** — Get tag suggestions as you type
- **Thumbnail Gallery** — Preview results before saving
- **Rating Filter** — Filter by safe/questionable/explicit
- **Preview Lightbox** — View full-size images with tag info
- **Pagination** — Browse through pages of results

### 🤖 AI Naming System
- **One-Click AI Naming** — Click the magic wand to auto-name any image
- **Uses Your API** — Works with OpenAI, NanoGPT, local LLMs, or any OpenAI-compatible API
- **Smart Names** — Generates clean, memorable names in snake_case or kebab-case
- **Auto Descriptions** — Also generates short descriptions for AI context
- **Batch Processing** — Select multiple images and AI-name them all at once
- **Fallback Naming** — If AI is unavailable, generates names from tags

### 💾 Saving & Organization
- **One-Click Save** — Save images directly to any character or persona
- **Subfolder Support** — Organize with Outfits, Expressions, Locations, etc.
- **Batch Save** — Save multiple images with AI naming in one action
- **Auto-Assignment** — Saved images are automatically registered in LocalImage

## Installation

### From URL (Recommended)
1. Open SillyTavern
2. Go to **Extensions** → **Install Extension**
3. Enter your repository URL
4. Click Install
5. Reload SillyTavern

### Manual Installation
1. Clone or download this repository
2. Copy the `HentaiLocal` folder to `SillyTavern/data/<user>/extensions/`
3. Restart SillyTavern

### Building from Source
```bash
cd HentaiLocal
npm install
npm run build
```
The compiled output goes to `dist/`. The `manifest.json` points to `dist/index.js`.

## Quick Start

### 1. Browse & Save from Booru Sites

1. Select a character in SillyTavern
2. Click the **🔥 fire icon** next to the gallery button in the character panel
3. The Booru Scraper drawer opens on the right side
4. Select a booru site (Rule34, Gelbooru, etc.)
5. Enter tags (e.g. `1girl blue_hair weapon`) and press Enter or click Search
6. Browse results — click any thumbnail to preview full size
7. Click **💾 Save** to save with a tag-derived name, or **✨ AI Name & Save** to use AI naming

### 2. Use the AI Naming System

AI naming uses an OpenAI-compatible API to generate descriptive names for images.

**Setup:**
1. Go to **Extensions Settings** → scroll to **HentaiLocal Settings**
2. Enter your **API Base URL** (e.g. `https://api.openai.com/v1` or your local LLM endpoint)
3. Enter your **API Key**
4. Choose a **Model** (e.g. `gpt-4o-mini`)
5. Select **Naming Style** (snake_case or kebab-case)

**If you leave the API fields empty**, HentaiLocal will try to use SillyTavern's configured OpenAI-compatible API automatically.

### 3. Use Images in Chats

The tag syntax is identical to LocalImage:

```
::img CharacterName imagename::
```

| Tag | Description |
|-----|-------------|
| `::img Seraphina bedroom::` | Shows Seraphina's bedroom |
| `::img Seraphina sword::` | Shows Seraphina's sword |
| `::img {{char}} angry::` | Uses the current character's name |
| `::img {{user}} photo::` | Shows the user/persona's image |

### 4. Let the AI Choose Images

In your character card, add instructions like:

```
You can display images using ::img {{char}} imagename:: tags.

Available images:
- bedroom: my private chambers with canopy bed
- sword: my enchanted blade, Moonfire
- happy: bright smile
- angry: fierce battle-ready glare

Use these naturally when the scene or mood matches.
```

Then enable **"Inject image list into prompt"** in the gallery settings.

## Scraper Panel Details

### Supported Sites

| Site | API | Autocomplete | Notes |
|------|-----|-------------|-------|
| Rule34 | ✅ | ✅ | Largest for anime/hentai |
| Gelbooru | ✅ | ✅ | Large, well-organized |
| Danbooru | ✅ | ✅ | High quality, curated |
| Yande.re | ✅ | ✅ | High-res anime art |
| Konachan | ✅ | ✅ | Anime wallpapers |
| Paheal | ✅ | ❌ | Legacy booru |
| Sankaku | ✅ | ✅ | Mixed content |
| Zerochan | ✅ | ❌ | Anime art community |
| Lolibooru | ✅ | ✅ | Niche content |
| Safebooru | ✅ | ❌ | SFW only |

### Search Tips

- Separate tags with spaces: `1girl blue_hair sword`
- Use underscores for multi-word tags: `blue_hair` (the autocomplete helps with this)
- Add rating filters from the dropdown
- Use the **Save To** field to choose which character's gallery to save into
- Use the **Subfolder** field to organize images into categories

### Batch Operations

1. Click the **Batch** button to enable batch mode
2. Check the images you want to save
3. Click **Save N images (AI named)** to batch-save with AI-generated names

## Settings Reference

### AI Naming API

| Setting | Description | Default |
|---------|-------------|---------|
| API Base URL | OpenAI-compatible API endpoint | *(uses ST's API if empty)* |
| API Key | Your API key | *(uses ST's API if empty)* |
| Model | Model to use for naming | `gpt-4o-mini` |
| Naming Style | `snake_case` or `kebab-case` | `snake_case` |
| Auto-generate descriptions | Generate descriptions when batch saving | `true` |

### Scraper Defaults

| Setting | Description | Default |
|---------|-------------|---------|
| Default Site | Which booru site to start with | `rule34` |

## Tag Syntax (Full Reference)

```
::img EntityName imagename::
```

- **EntityName** — The exact character name (can include spaces), or use `{{char}}`, `{{user}}`, `{{group}}` macros
- **imagename** — The assigned name (no spaces — use underscores)

### Entity Resolution

| Tag | Resolves To |
|-----|-------------|
| `::img Alice sword::` | Character named Alice, image "sword" |
| `::img John Smith car::` | Character "John Smith", image "car" |
| `::img {{char}} battle::` | Current character, image "battle" |
| `::img {{user}} room::` | Current persona, image "room" |
| `::img {{group}} map::` | Current group, image "map" |

## Troubleshooting

### Images not displaying?
1. Ensure **"Forbid External Media"** is unchecked in User Settings
2. Verify the image name matches exactly (case-sensitive)
3. Check the character name matches exactly
4. Use underscores instead of spaces in image names
5. Try refreshing the page

### Scraper search fails?
1. Some booru sites may block requests — try a different site
2. Check your network connection
3. CORS issues are handled via SillyTavern's proxy — make sure your ST server is running
4. Some sites have rate limits — wait a moment between searches

### AI naming not working?
1. Ensure your API Base URL is correct and ends with `/v1`
2. Verify your API key is valid
3. Try using a different model (e.g. `gpt-4o-mini` instead of `gpt-4`)
4. Check the browser console (F12) for error messages
5. If no API is configured, HentaiLocal will try to use SillyTavern's configured API

### Gallery button not appearing?
- Make sure you have a character selected
- Try refreshing the page
- Check the browser console for errors

## Architecture

```
HentaiLocal/
├── manifest.json          # SillyTavern extension manifest
├── style.css              # Complete stylesheet (LocalImage + scraper)
├── package.json           # Node.js dependencies
├── webpack.config.js      # Build configuration
├── dist/
│   └── index.js           # Compiled bundle (after build)
├── src/
│   ├── index.js           # Main entry point — settings, events, tag processing
│   ├── Gallery.js         # Character gallery modal (React)
│   ├── GroupGallery.js    # Group chat gallery modal (React)
│   ├── ScraperPanel.js    # Booru scraper UI (React)
│   ├── booru.js           # Booru API integration module
│   └── ai-naming.js       # AI-powered image naming module
└── README.md
```

## Compatibility

- **SillyTavern**: 1.12.0+
- **Works with**: Most other extensions (STLE, quick-reply, etc.)
- **Mobile**: Fully functional via web browser
- **API**: Any OpenAI-compatible API (OpenAI, NanoGPT, local models via Ollama/vLLM/LM Studio)

## Credits

- **LocalImage** by [mechamarmot](https://github.com/mechamarmot/SillyTavern-LocalImage) — Original extension
- **HentaiLocal** — Merged extension with booru scraper and AI naming

## License

MIT License — Feel free to modify and share!
