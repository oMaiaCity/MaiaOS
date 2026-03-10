---
name: maia-image-prompting
description: Creates and refines image generation prompts for MaiaOS world visuals using Nano Banana (Gemini Image) best practices. Use when generating or editing images of the dome city, main character, indoor food forests, or related scenes.
---

# MaiaOS Image Prompting

Use this skill when writing prompts for image generation or editing (Nano Banana / Gemini Image, or similar models) for MaiaOS world visuals.

## When to Use

- User asks for image prompts for dome city, character, or interior scenes
- User wants to edit/restyle existing MaiaOS images
- User needs consistent character or world details across multiple images

## Quick Reference

For full world details, see [reference.md](reference.md).

| Element | Key Details |
|--------|-------------|
| **Main character** | Black woman, sparkling blue eyes, short curly dark hair with gold accents, rich light brown skin. Cream jumpsuit (geometric pattern), matching cape, beaded necklace (olive/brown/gold/red), woven satchel (green/brown) olive strap, gladiatorial cream sandals |
| **Clothing culture** | Futuristic flowing light-toned garments; individualized variations |
| **Dome exterior** | Geodesic domes, terraced permaculture, winding river, arched bridges |
| **Dome interior** | White stone, black steel, mango wood; Tuscany-inspired rustic-elegant |
| **Lighting** | Golden hour, cinematic, photorealistic |
| **Style** | Eco-futuristic, photorealistic, warm, hopeful |

## Nano Banana Best Practices

1. **Start with a strong verb** — "Edit", "Create", "Transform" — to define the primary operation.
2. **Be specific** — Concrete details on subject, lighting, composition, materials.
3. **Use positive framing** — Describe what you want (e.g. "empty street") not what you don't ("no cars").
4. **Control the camera** — Use photographic/cinematic terms: "low angle", "aerial view", "medium close-up".
5. **For editing** — Explicitly state what to keep and what to change.
6. **Iterate** — Refine with follow-up prompts conversationally.

Full guide: [nano-banana-guide.md](nano-banana-guide.md)

### Prompt Frameworks

**Text-to-image (no references):** `[Subject] + [Action] + [Location/context] + [Composition] + [Style]` — Describe narratively, not as keyword list.

**Multimodal (with references):** `[Reference images] + [Relationship instruction] + [New scenario]` — For character consistency, placing elements in new environments.

**Editing:** `[Operation] + [What to keep exactly] + [What to change] + [Style]` — Be explicit about what stays the same.

**Web search (real-time data):** `[Search request] + [Analytical task] + [Visual translation]` — Retrieve data, then visualize.

**Text in images:** Use quotes for words ("Happy Birthday"), specify font, translate if needed. Text-first: finalize text in conversation, then request image.

### Creative Director Controls

- **Lighting:** "three-point softbox", "Chiaroscuro with harsh contrast", "Golden hour backlighting creating long shadows".
- **Camera/lens:** "low-angle, shallow depth of field (f/1.8)", "wide-angle lens", "macro lens", "shot on Fujifilm camera".
- **Color grading:** "1980s color film, slightly grainy", "cinematic grading with muted teal tones".
- **Materiality:** Specify physical makeup — "navy blue tweed" not "suit", "ornate elven plate armor, silver leaf" not "armor".

## Photorealism Checklist

When images look "painted", add:
- Visible bark, leaf veins, organic imperfections on plants
- Fine grass, soil grain, root detail
- Cinematic contrast between lit and shadowed areas
- Volumetric light, rim light
- Shallow depth of field (f/2.0) where appropriate

## Common Scene Types

| Scene | Key elements |
|-------|--------------|
| Exterior valley | Dome city, terraces, river, bridges, golden hour |
| Woman + child (exterior) | Foreground hill, both from behind looking at city |
| Dome interior (general) | Food forest, white stone, black steel, mango wood |
| Dome interior (lively) | Multiple people, individualized clothing, natural poses |
| Close-up (woman + child) | Intimate moment, dome visible around them |
| Kitchen + garden | 1/3 open kitchen, 2/3 permaculture food forest |
| Woman on bench in dome | Medium shot, bench centered toward camera, natural stream, photorealistic. See [examples.md](examples.md) §5b |
| **Character reference extraction** | Clean studio, 1:1, cream jumpsuit. Shots: full body, medium, close-up (front/profile/45°), face only. See [examples.md](examples.md) §6a–6f |

## Template: Edit for Photorealism

```
Edit the attached image. Keep exactly: [scene elements, composition, mood].
Improve photorealism: Render [vegetation/terrain/etc] with [specific textures].
Lighting: [cinematic golden hour details].
Photorealistic, cinematic.
```

## Template: Add Characters

```
Add: [number] people—[demographics]—wearing similar [clothing style] with individual variations.
Scatter throughout: [activities, placements].
[Scale note]: correct human scale relative to [architecture].
```

## Additional Resources

- Full world reference: [reference.md](reference.md)
- Ready-to-use prompt examples: [examples.md](examples.md)
- Complete Nano Banana prompting guide: [nano-banana-guide.md](nano-banana-guide.md)
