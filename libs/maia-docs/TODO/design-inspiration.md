https://kube.io/blog/liquid-glass-css-svg/
https://medium.com/ekino-france/liquid-glass-in-css-and-svg-839985fcb88d
https://github.com/archisvaze/liquid-glass?tab=readme-ov-file
https://liquid-glass-eta.vercel.app

Liquid Glass in CSS (and SVG)

Adrien Gautier

Press enter or click to view image in full size

Background Picture: Aldrin near the lunar module (Apollo 11)
TL;DR
Apple’s Liquid Glass design features complex refraction that distorts content beneath UI elements. While CSS backdrop-filter doesn’t natively support such effects, SVG filters can bridge the gap. Using <feDisplacementMap>, we can replicate similar results in Chromium-based browsers.
What is Liquid Glass ?
Liquid Glass is Apple’s new design language introduced in their next OS iteration (version 26), evolving from the simpler blur effects first seen in iOS 7.

Unlike simple blurs, Liquid Glass mimics real glass’s optical properties — most notably, refraction.
There are several variations of this effect depending on context:
Press enter or click to view image in full size

Safari App — Introducing Liquid Glass | Apple
Sometimes the element is fully transparent:
Press enter or click to view image in full size

Text magnification — Introducing Liquid Glass | Apple
Other times it blurs and distorts heavily the content beneath it:
Press enter or click to view image in full size

Apple TV+ App — Introducing Liquid Glass | Apple
A constant feature, however, is that the element’s borders create a symmetrical distortion of the inner content beyond a certain threshold.
Press enter or click to view image in full size

Answering a phone call — Introducing Liquid Glass | Apple
While Liquid Glass encompasses more than just border distortions, this article will focus primarily on that aspect.
The CSS implementation
CSS offers the backdrop-filter property, which lets you apply effects like blur or brightness to the content behind an element. These filters stack cumulatively, applied in sequence. A simple setup might look like this:
.my-element {
    backdrop-filter: blur(10px) brightness(0.8);
}
However, CSS lacks a native way to create distortion or refraction effects. To achieve those, we need to harness SVG filters. You can reference an SVG filter inside backdrop-filter by using a URL syntax like:
backdrop-filter: url(./my-svg.svg#myfilter);
Note: One limitation is that backdrop-filter only affects content within the element’s boundaries. In Apple’s Liquid Glass presentation, some elements refract content beyond their borders—something we can’t replicate using backdrop-filter alone.
The SVG implementation
The SVG specification lets you define filters that produce complex visual effects on shapes and symbols. Although SVG is a vector format, filters operate in a rasterized context — converting vector graphics into pixel-based images before applying effects. Filters are composed of building blocks called filter primitives, which fall into three main categories:
Modifiers — transform an existing graphic (e.g., <feGaussianBlur />)
Sources — generate new graphics (e.g., <feTurbulence />)
Combiners — merge multiple graphics to create a new output
The primitive we need for refraction effects belongs to this last category.
<feDisplacementMap />
The displacement filter combines two inputs to produce the distorted output. The first input, usually SourceGraphic, is the original visual we want to distort. The second input is the displacement map, which controls how each pixel of the original image is shifted. Each pixel’s offset is determined by reading the corresponding pixel in the displacement map.
Get Adrien Gautier’s stories in your inbox
Join Medium for free to get updates from this writer.

Subscribe
We can generate a random displacement map using <feTurbulence />, which creates chaotic distortion patterns.
<filter id="turbulence-displacement"
        x="0" y="0"
        width="100%" height="100%">
   <!-- Source -->
   <feTurbulence type="turbulence"
                 baseFrequency="0.05"
                 numOctaves="2"
                 result="noise" />
   <!-- Combiner -->
   <feDisplacementMap in="SourceGraphic"
                      in2="noise"
                      scale="20"
                      xChannelSelector="R"
                      yChannelSelector="G" />
</filter>
Press enter or click to view image in full size

Turbulence-based distortions with varying baseFrequency.
However, to achieve precise border distortions like in Liquid Glass, we need a dedicated displacement map image. This is where <feImage /> comes in: it allows us to use external graphics as filter inputs.
<filter id="image-displacement"
        x="0" y="0"
        width="100%" height="100%">
   <!-- Source -->
   <feImage xlink:href="displacement-map.svg"
            result="dispMap" />
   <!-- Combiner -->
   <feDisplacementMap in="SourceGraphic"
                      in2="dispMap"
                      scale="30"
                      xChannelSelector="R"
                      yChannelSelector="G" />
</filter>
While <feImage /> can load raster images like PNGs, we’ll use a second SVG file to generate the displacement map. Creating it as SVG lets us precisely match the size and border radius of the target element, which is crucial for accurate distortion. A “generic” map wouldn’t scale correctly across varying element dimensions, leading to misaligned or inconsistent refraction. And although the source is vector-based, keep in mind that all filters—including displacement—operate on a rasterized version, so there’s no inherent quality gain from using SVG.
Creating the displacement map
The xChannelSelector and yChannelSelector attributes determine which color channels (R, G, B, or A) drive the displacement along the horizontal and vertical axes. The selected channel provides a value between 0 and 255 for each pixel, which gets mapped like this:
00 → full negative offset (–1)
80 (128) → no displacement (0)
FF (255) → full positive offset (+1)
These normalized values are then scaled using the scale attribute to produce the final displacement per axis.
Press enter or click to view image in full size

Using a solid gray image results in no displacement. The red channel (#808080) is used for the x-axis and the green channel (#808080) is used for the y-axis. The blue channel value is ignored.
Press enter or click to view image in full size

In contrast, using a solid red image (#FF0000) shifts pixels to the left on the x-axis and to the bottom on the y-axis. When displaced pixels fall outside the graphic boundaries, their values are sampled from a mirrored version of the original image to avoid harsh edges.
What about gradients? Here I created a displacement map by layering two gradients, one for each axis.
Press enter or click to view image in full size

According to the scale value, the resulting picture is either zoomed in, zoomed out or even inverted.
Linear gradients across the whole axis don’t produce distortion; they only scale the image uniformly. Real distortion requires irregular gradients.
Note: In the image above, the zoom effect appears slightly skewed. Displacement rendering seems a bit off on macOS but looks correct on Windows. Fortunately, the difference is subtle and barely noticeable in the final result.
Press enter or click to view image in full size

The above example gets us closer to Liquid Glass’s effect but misses the subtle border distortions and rounded corners. To fix this, I combined the linear gradient displacement map with a solid gray mask matching the element’s shape.
Press enter or click to view image in full size

Blurring this mask creates a smooth transition between displaced and non-displaced areas, mimicking the natural bending of edges.
Result
The result is an approximate refraction effect that closely mimics Apple’s Liquid Glass aesthetic — at least visually. We can also push the idea further by simulating chromatic aberration which is a very common behaviour of real glass. You can see the result in motion on the following sandbox:

(must be opened in a Chromium-based browser)
That said, the rendering isn’t as refined. One major limitation is the lack of super-sampling in SVG displacement filters, which leads to a pixelated look. This can be softened slightly with blur, but it’s not a perfect fix.
Constraints
This proof of concept reveals several limitations when simulating refraction with SVG. Unlike Apple’s Liquid Glass, which works on arbitrary shapes — including text and icons — this approach currently only supports fixed-size rounded rectangles and circles.
Compatibility is another major constraint: the technique only works reliably in Chromium-based browsers. While the displacement effect itself should be supported across most browsers, combining it with backdrop-filter doesn't consistently work outside of Chromium.
Finally, ensuring the readability of the element’s content against unpredictable backgrounds remains a challenge, potentially introducing accessibility issues.
About computation costs: While Apple hints that Liquid Glass leverages modern hardware, there’s little to suggest it couldn’t run on much older chips — possibly even the A6. Blur filters typically sample and average multiple neighboring pixels per output pixel, making them relatively heavy. By comparison, displacement filters usually perform a single pixel lookup based on a coordinate offset, which is significantly cheaper. Given that iPhones have handled real-time blur since iOS 7, it’s reasonable to assume that a displacement effect like this was technically feasible over a decade ago.
Final Thoughts
Liquid Glass introduces a type of refraction effect largely unseen in UI design, and while SVG’s <feDisplacementMap> lets us approximate it on the web, the approach remains limited by shape constraints and inconsistent browser support. The CSS Houdini API, which can extend the rendering pipeline, offers a promising way to create these effects natively and without shape restrictions. However, due to current browser compatibility issues, any implementation remains experimental and isn’t production-ready. Still, Houdini feels like an interesting playground I’m curious to explore soon.
If you found this experiment interesting, you might also enjoy our more technical deep dives — check out other articles from ekino on Medium, and follow us on LinkedIn to stay updated on new posts and projects.