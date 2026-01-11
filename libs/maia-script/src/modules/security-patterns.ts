/**
 * Tailwind CSS Class Patterns for Security Validation
 * Comprehensive allow-list for safe Tailwind utilities
 * Extracted from whitelist.ts
 */

export const TAILWIND_PATTERNS = [
  // Spacing
  /^(p|m|px|py|pt|pb|pl|pr|mt|mb|ml|mr)-(\d+(\.\d+)?|auto)$/,
  /^gap-(\d+(\.\d+)?|auto)$/,
  /^space-[xy]-(\d+(\.\d+)?|auto)$/,

  // Layout
  /^(flex|grid|block|inline|inline-block|inline-flex|hidden|contents)$/,
  /^@container$/,
  /^flex-(row|col|wrap|nowrap|grow|shrink|1|auto|none)$/,
  /^(shrink|grow)-(0|1)$/,
  /^min-w-0$/,
  /^shrink-0$/,
  /^flex-(shrink|grow)-(\d+)$/,
  /^flex-grow$/,
  /^flex-shrink$/,
  /^flex-basis-(\d+|auto|full|0)$/,
  /^grid-cols-(\d+|auto|min|max|subgrid)$/,
  /^grid-rows-(\d+|auto|min|max|subgrid)$/,
  /^col-span-(\d+|auto|full)$/,
  /^row-span-(\d+|auto|full)$/,
  /^\[grid-column:.*\]$/,
  /^\[grid-row:.*\]$/,
  /^\[grid-area:.*\]$/,
  /^\[grid-template-areas:.*\]$/,
  /^\[grid-template-columns:.*\]$/,

  // Flexbox alignment
  /^items-(start|end|center|baseline|stretch)$/,
  /^justify-(start|end|center|between|around|evenly)$/,
  /^content-(start|end|center|between|around|evenly)$/,
  /^self-(start|end|center|baseline|stretch|auto)$/,

  // Sizing
  /^(w|h|min-w|min-h|max-w|max-h)-(full|screen|auto|fit|\d+(\.\d+)?|px|rem|em|%|2xl|xl|lg|md|sm|xs)$/,
  /^(w|h|min-w|min-h|max-w|max-h)-(\d+)\/(\d+)$/,
  /^(mx|my|mt|mb|ml|mr)-(\d+|auto)$/,
  /^(mx|my)-auto$/,

  // Colors
  /^(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d+)$/,
  /^(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)-(\d+)\/(\d+)$/,
  /^(bg|text|border)-(white|black|transparent|current|inherit)$/,
  /^(bg|text|border)-(alert|success|warning|info)$/,
  /^(bg|text|border)-(white|black|transparent|current|inherit)\/(\d+)$/,
  /^(bg|text|border)-\[.*\]$/,
  /^border$/,
  /^border-none$/,
  /^border-(\d+|\[.*\])$/,
  /^border-(l|r|t|b)-(\d+|\[.*\])$/,
  /^border-(l|r|t|b)$/,
  /^border-(solid|dashed|dotted|double|none)$/,

  // Gradients
  /^(bg|text|border)-(gradient|linear)-to-(r|l|t|b|tr|tl|br|bl)$/,
  /^(from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d+)$/,
  /^(from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)-(\d+)\/(\d+)$/,
  /^(from|via|to)-(white|black|transparent|current)$/,

  // Typography
  /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
  /^text-\[.*\]$/,
  /^text-(left|center|right|justify)$/,
  /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  /^font-(sans|serif|mono)$/,
  /^leading-(none|tight|snug|normal|relaxed|loose)$/,
  /^tracking-(tighter|tight|normal|wide|wider|widest)$/,
  /^(italic|not-italic|uppercase|lowercase|capitalize|normal-case)$/,
  /^(underline|line-through|no-underline)$/,
  /^truncate(-none)?$/,
  /^whitespace-(normal|nowrap|pre|pre-line|pre-wrap|break-spaces)$/,
  /^break-(words|all|normal)$/,
  /^writing-(vertical-rl|vertical-lr|horizontal-tb)$/,
  /^\[text-orientation:.*\]$/,
  /^text-(sideways|upright|mixed|sideways-right|glyph)$/,
  /^direction-(rtl|ltr)$/,

  // Effects
  /^shadow(-(sm|md|lg|xl|2xl|inner|none)|-button-primary|-button-primary-hover)$/,
  /^shadow-\[.*\]$/,
  /^rounded(-(none|sm|md|lg|xl|2xl|3xl|full|\d+))?$/,
  /^rounded-\[.*\]$/,
  /^opacity-(\d+|0)$/,
  /^bg-opacity-(\d+|0)$/,
  /^backdrop-blur(-(sm|md|lg|xl|2xl|3xl|none))?$/,

  // Transitions
  /^transition(-(all|colors|opacity|shadow|transform))?$/,
  /^duration-(\d+|75|100|150|200|300|500|700|1000)$/,
  /^ease-(linear|in|out|in-out)$/,

  // Positioning
  /^(static|fixed|absolute|relative|sticky)$/,
  /^(top|right|bottom|left|inset|inset-x|inset-y)-(\d+|auto|full|screen|0|1\/2|1\/3|2\/3|1\/4|3\/4)$/,
  /^-(top|right|bottom|left)-(\d+|auto|full|screen|0|1\/2|1\/3|2\/3|1\/4|3\/4)$/,
  /^z-(\d+|auto|0|9|10|20|30|40|50)$/,
  /^translate-[xy]-(\d+|full|1\/2|1\/3|2\/3|1\/4|3\/4|\[.*\])$/,
  /^-translate-[xy]-(\d+|full|1\/2|1\/3|2\/3|1\/4|3\/4|\[.*\])$/,
  /^translate-(\d+|full|1\/2|1\/3|2\/3|1\/4|3\/4|\[.*\])$/,
  /^-translate-(\d+|full|1\/2|1\/3|2\/3|1\/4|3\/4|\[.*\])$/,

  // Cursor
  /^cursor-(pointer|not-allowed|wait|text|move|help|crosshair|default|grab|grabbing)$/,

  // Pointer events
  /^pointer-events-(none|auto)$/,

  // User Select
  /^select-(none|text|all|auto)$/,

  // Ring (focus rings)
  /^ring(-(\d+|offset-\d+(\.\d+)?))?$/,
  /^ring-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)-(\d+)$/,
  /^ring-\[.*\]$/,
  /^ring-offset-(\d+(\.\d+)?)$/,
  /^ring-offset-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)-(\d+)$/,

  // Outline
  /^outline-(none|0|1|2|4|8)$/,

  // Scale (transform)
  /^scale-(\d+|\[.*\])$/,

  // Rotate (transform)
  /^rotate-(\d+|\[.*\])$/,
  /^-rotate-(\d+|\[.*\])$/,

  // Transform origin
  /^origin-(center|top|top-right|right|bottom-right|bottom|bottom-left|left|top-left)$/,

  // Display
  /^(inline|block|inline-block|flex|inline-flex|grid|inline-grid|table|inline-table|contents|list-item|hidden)$/,
  /^min-w-0$/,
  /^shrink-0$/,

  // Overflow
  /^overflow(-(x|y))?-(auto|hidden|clip|visible|scroll)$/,
  /^scroll-(auto|smooth)$/,

  // Arbitrary values (safe patterns)
  /^(bg|text|border|shadow|rounded|w|h|min-w|min-h|max-w|max-h|p|m|px|py|pt|pb|pl|pr|mt|mb|ml|mr|mx|my|gap|space-[xy]|top|right|bottom|left|z|ring|scale)-\[.*\]$/,
  /^\[.*\]$/,

  // Custom patterns (for specific use cases)
  /^hover:(.+)$/,
  /^active:(.+)$/,
  /^focus:(.+)$/,
  /^disabled:(.+)$/,
  /^placeholder:(.+)$/,
]
