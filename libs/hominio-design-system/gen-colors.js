import chroma from 'chroma-js';

const colors = {
    primary: '#0C2B4E',
    secondary: '#51CACF',
    success: '#AAC478',
    warning: '#DEAC5B',
    alert: '#C97769',
    info: '#7DD3C6', // Pastel turquoise (lighter, softer turquoise)
    accent: '#F4D03F', // Yellow
    light: '#E8F0F5', // Light bluish base (used for UI elements like borders, backgrounds)
    dark: '#1A1A1A'   // Standard dark
};

const generateScale = (hex, name) => {
    // Special handling for 'light' to ensure cream/white to ochre
    if (name === 'light') {
        return generateLightScale(hex);
    }

    const scaleGenerator = chroma.scale([
        chroma(hex).brighten(2.5), // 50
        hex,                       // 500
        chroma(hex).darken(2.5)    // 950
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

const generateLightScale = (baseHex) => {
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
