import { mountDocument } from '../src/index.js'
import { landingDoc } from '../src/landing.doc.js'

document.documentElement.style.margin = '0'
document.documentElement.style.minHeight = '100%'
document.body.style.margin = '0'
document.body.style.minHeight = '100%'
document.body.style.overflowX = 'hidden'

const canvas = document.createElement('canvas')
canvas.style.display = 'block'
canvas.style.width = '100%'
document.body.appendChild(canvas)

const run = mountDocument(canvas, landingDoc)
void globalThis.document.fonts.ready.then(() => {
	run.redraw()
})
