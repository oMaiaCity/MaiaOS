/**
 * Phase B — GLSL prelude for future GPU terrain coloring (height bands, then river/warp via textures or full port).
 * Not wired into the default MeshStandardMaterial path; use onBeforeCompile when replacing CPU biomes.
 */

/** Matches `heightBiomeRgb` bands in biomes.js (sand/earth/grass/snow). */
export const HEIGHT_BIOME_GLSL = /* glsl */ `
float smoothRangeT(float t, float a, float b) {
	float x = clamp((t - a) / max(b - a, 1e-6), 0.0, 1.0);
	return x * x * (3.0 - 2.0 * x);
}
vec3 lerpRgb(vec3 a, vec3 b, float t) {
	float k = clamp(t, 0.0, 1.0);
	return a + (b - a) * k;
}
vec3 heightBiomeRgb(float tn) {
	float e0 = 0.34;
	float e1 = 0.64;
	float grassBrightEnd = 0.77;
	float snowBlendStart = 0.795;
	float snowBlendEnd = 0.865;
	vec3 sand = vec3(0.86, 0.76, 0.58);
	vec3 earth = vec3(0.48, 0.34, 0.24);
	vec3 grass = vec3(0.26, 0.44, 0.2);
	vec3 grassHigh = vec3(0.28, 0.48, 0.22);
	vec3 snow = vec3(0.96, 0.97, 1.0);
	float t = clamp(tn, 0.0, 1.0);
	if (t < e0) {
		return lerpRgb(sand, earth, smoothRangeT(t, 0.06, e0));
	}
	if (t < e1) {
		return lerpRgb(earth, grass, smoothRangeT(t, e0 * 0.95, e1));
	}
	if (t < grassBrightEnd) {
		return lerpRgb(grass, grassHigh, smoothRangeT(t, e1, grassBrightEnd));
	}
	if (t < snowBlendStart) {
		return grassHigh;
	}
	if (t < snowBlendEnd) {
		return lerpRgb(grassHigh, snow, smoothRangeT(t, snowBlendStart, snowBlendEnd));
	}
	return snow;
}
`

/**
 * Placeholder for MeshStandardMaterial.onBeforeCompile: inject uniforms uVHMin, uVHSpan and sample height from world Y.
 * Call when Phase B replaces the CPU color pass; default mountGame does not use this.
 * @param {THREE.MeshStandardMaterial} _material
 * @param {{ vHMin: number, vHSpan: number }} _range
 */
export function applyTerrainBiomeShaderPatch(_material, _range) {
	// Intentionally empty: wire fragment injection + HEIGHT_BIOME_GLSL when moving biomes to GPU.
}
