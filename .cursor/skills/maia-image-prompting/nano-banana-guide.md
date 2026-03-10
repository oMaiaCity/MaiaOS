# Nano Banana Prompting Guide

Source: Google Cloud "The ultimate Nano Banana prompting guide" (March 6, 2026). Applied to MaiaOS image generation.

---

## Model Overview

Nano Banana models (Gemini 3 Pro Image / Gemini 3.1 Flash Image) use deep reasoning and real-world knowledge for precise image generation and editing.

**Capabilities:** Real-time web search, text rendering/translations, upscaling to 2K/4K, aspect ratios (16:9, 9:16, 2:1, etc.), up to 14 reference images per prompt.

---

## Best Practices

1. **Be specific** — Concrete details on subject, lighting, composition.
2. **Use positive framing** — Describe what you want (e.g. "empty street") not what you don't ("no cars").
3. **Control the camera** — Use photographic/cinematic terms: "low angle", "aerial view", "medium close-up".
4. **Iterate** — Refine with follow-up prompts conversationally.
5. **Start with a strong verb** — "Edit", "Create", "Transform" — to define the primary operation.

---

## Five Prompting Frameworks

### 1. Image Generation

**Text-to-image (no references)** — Describe the scene narratively, not as a keyword list.

Formula: `[Subject] + [Action] + [Location/context] + [Composition] + [Style]`

Example: *A striking fashion model wearing a tailored brown dress, sleek boots, holding a structured handbag. Posing with a confident, statuesque stance, slightly turned. A seamless, deep cherry red studio backdrop. Medium-full shot, center-framed. Fashion magazine editorial, shot on medium-format analog film, pronounced grain, high saturation, cinematic lighting.*

**Multimodal (with references)** — Combine references to guide output (character consistency, product in new environment).

Formula: `[Reference images] + [Relationship instruction] + [New scenario]`

Example: *Using the attached napkin sketch as structure and fabric sample as texture, transform this into a high-fidelity 3D armchair render. Place it in a sun-drenched, minimalist living room.*

---

### 2. Image Editing

Editing focuses on **what changes** and **what stays the same**.

**Conversational editing (no new references)** — Be explicit about what to keep exactly the same.

- Semantic masking: Define areas to edit via text ("edit only the sky").
- Example: "Remove the man from the photo" (rest stays unchanged).

**Composition and style transfer (with new references)** — Add elements or apply style:

- Adding elements: Base image + object image + "place X in Y".
- Style transfer: "Recreate this photo in Van Gogh style."

---

### 3. Real-Time Information (Web Search)

For real-world accuracy, instruct the model to retrieve data and then visualize it.

Formula: `[Source/Search request] + [Analytical task] + [Visual translation]`

Example: *Search for current weather and date in San Francisco. Use this data to modify the scene (if raining, make it grey and rainy). Visualize as a miniature city-in-a-cup concept embedded in a realistic smartphone UI.*

---

### 4. Text Rendering & Localization

For sharp, legible text in images:

- **Use quotes** — Enclose desired words: `"Happy Birthday"`, `"URBAN EXPLORER"`.
- **Specify font** — "bold, white, sans-serif" or "Century Gothic 12px font".
- **Translate** — Specify target language for text output.
- **Text-first hack** — Converse first to finalize text concepts, then ask for the image.

---

### 5. Creative Director Approach

Stop typing keywords; direct the scene like a film director.

#### 5.1 Design Lighting

- Studio: "three-point softbox setup" for even product lighting.
- Dramatic: "Chiaroscuro lighting with harsh, high contrast".
- Natural: "Golden hour backlighting creating long shadows".

#### 5.2 Camera, Lens, and Focus

- **Hardware** — "Shot on Fujifilm camera" (color science), "GoPro" (immersive action), "cheap disposable camera" (raw, nostalgic).
- **Lens** — "Low-angle shot with shallow depth of field (f/1.8)", "wide-angle lens" (scale), "macro lens" (detail).

#### 5.3 Color Grading and Film Stock

- Nostalgic: "as if on 1980s color film, slightly grainy".
- Modern: "Cinematic color grading with muted teal tones".

#### 5.4 Materiality and Texture

Define physical makeup. Not "suit jacket" → "navy blue tweed". Not "armor" → "ornate elven plate armor, etched with silver leaf patterns". For mockups: "minimalist ceramic coffee mug".

---

## Tech Specs (Summary)

| Spec | Nano Banana 2 (Flash) | Nano Banana Pro |
|------|------------------------|-----------------|
| Input tokens | 131,072 | 65,536 |
| Output tokens | 32,768 | 32,768 |
| Resolutions | 0.5K, 1K, 2K, 4K | 1K, 2K, 4K |
| Reference images | Up to 14 | Up to 14 |
| Aspect ratios | 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, 1:4, 4:1, 1:8, 8:1 | 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 |
