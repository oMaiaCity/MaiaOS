import chroma from 'chroma-js';

const colors = {
    primary: '#002455',
    secondary: '#008E89',
    accent: '#FF9F00',
    success: '#9FC87E',
    warning: '#F4631E',
    alert: '#CB0404',
    info: '#309898',
    slate: '#E8F0F5' // Slate bluish base (used for UI elements like borders, backgrounds)
};

// Configure spread for each color (brighten/darken amounts)
// Reduced spread for info, alert, success, and warning for more subtle color variations
const colorSpreadConfig = {
    primary: { brighten: 4.5, darken: 4.5 },
    secondary: { brighten: 4.5, darken: 4.5 },
    success: { brighten: 3.0, darken: 3.0 },
    warning: { brighten: 3.0, darken: 3.0 },
    alert: { brighten: 3.0, darken: 3.0 },
    info: { brighten: 3.0, darken: 3.0 },
    accent: { brighten: 4.5, darken: 4.5 },
    slate: { brighten: 4.0, darken: 4.0 },     // Slate has special handling, so config is optional
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
