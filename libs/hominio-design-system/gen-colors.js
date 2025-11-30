import chroma from 'chroma-js';

const colors = {
    primary: '#12234a',
    secondary: '#47C8CA',
    success: '#508F49',
    warning: '#CD8629',
    alert: '#c64d32',
    info: '#4F928F',
    accent: '#eece5b',
    slate: '#E8F0F5' // Slate bluish base (used for UI elements like borders, backgrounds)
};

// Configure spread for each color (brighten/darken amounts)
// Higher values = wider spread between lightest and darkest
const colorSpreadConfig = {
    primary: { brighten: 4.5, darken: 4.5 },    // Wide spread for primary
    secondary: { brighten: 4.0, darken: 4.0 },  // Wide spread for secondary
    success: { brighten: 2.5, darken: 2.5 },
    warning: { brighten: 2.5, darken: 2.5 },
    alert: { brighten: 2.5, darken: 2.5 },
    info: { brighten: 2.5, darken: 2.5 },
    accent: { brighten: 4.0, darken: 4.0 },    // Wide spread for accent
    slate: { brighten: 4.0, darken: 4.0 },     // Wide spread for slate
    // slate has special handling, so no config needed
};

const generateScale = (hex, name) => {
    // Special handling for 'slate' to ensure cream/white to ochre
    if (name === 'slate') {
        return generateSlateScale(hex);
    }

    // Get spread configuration (defaults to 2.5 if not specified)
    const config = colorSpreadConfig[name] || { brighten: 2.5, darken: 2.5 };
    
    const scaleGenerator = chroma.scale([
        chroma(hex).brighten(config.brighten), // 50 - lighter
        hex,                                  // 500 - base
        chroma(hex).darken(config.darken)     // 950 - darker
    ]).domain([0, 500, 1000]).mode('lch');
    
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    const palette = {};
    
    steps.forEach(step => {
        palette[step] = { value: scaleGenerator(step).hex() };
    });
    
    // Ensure 500 is exact
    palette[500] = { value: hex };
    
    return palette;
};

const generateSlateScale = (baseHex) => {
    // 50: Almost white (very subtle bluish tint)
    // 100-400: Very light, gradual progression
    // 500: Base light blue
    // 600-950: Gradual darker progression, but staying relatively light
    const scaleGenerator = chroma.scale([
        '#FFFFFF', // Pure white (50) - almost indistinguishable from white
        '#FCFDFE', // Almost white with very subtle blue tint (100)
        '#F8FAFC', // Very light blue-white (200)
        '#F4F7FA', // Light blue-white (300)
        '#F0F5F8', // Light blue (400)
        baseHex,   // Base light blue (500)
        chroma(baseHex).darken(0.8) // Slightly darker but still light (950)
    ]).domain([0, 100, 200, 300, 400, 500, 1000]).mode('lch');

    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    const palette = {};
    
    steps.forEach(step => {
        palette[step] = { value: scaleGenerator(step).hex() };
    });
    return palette;
}

const fullPalette = {};
Object.entries(colors).forEach(([name, hex]) => {
    fullPalette[name] = generateScale(hex, name);
});

console.log(JSON.stringify(fullPalette, null, 2));
