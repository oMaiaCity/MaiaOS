/**
 * maia-game — Top-down 2D grid of squares with hover highlight and click toggle
 */
import * as THREE from 'three'

const GRID_SIZE = 20
const CELL_SIZE = 1
const GAP = 0.05
const COLORS = {
	unclicked: 0x2a2a2a,
	hover: 0x4a4a4a,
	clicked: 0x3d7ea6,
}

/**
 * @param {HTMLElement} container
 * @returns {{ dispose: () => void }}
 */
export function mountGame(container) {
	const scene = new THREE.Scene()
	const aspect = container.clientWidth / container.clientHeight
	const camera = new THREE.OrthographicCamera(-aspect * 12, aspect * 12, 12, -12, 0.1, 1000)
	camera.position.set(0, 0, 20)
	camera.lookAt(0, 0, 0)

	const renderer = new THREE.WebGLRenderer({ antialias: true })
	renderer.setSize(container.clientWidth, container.clientHeight)
	renderer.setPixelRatio(window.devicePixelRatio)
	container.appendChild(renderer.domElement)

	const raycaster = new THREE.Raycaster()
	const mouse = new THREE.Vector2()
	const squares = []
	const half = (GRID_SIZE * (CELL_SIZE + GAP) - GAP) / 2

	for (let row = 0; row < GRID_SIZE; row++) {
		for (let col = 0; col < GRID_SIZE; col++) {
			const geometry = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE)
			const material = new THREE.MeshBasicMaterial({
				color: COLORS.unclicked,
				side: THREE.DoubleSide,
			})
			const mesh = new THREE.Mesh(geometry, material)
			mesh.position.x = col * (CELL_SIZE + GAP) - half + (CELL_SIZE + GAP) / 2
			mesh.position.y = row * (CELL_SIZE + GAP) - half + (CELL_SIZE + GAP) / 2
			mesh.userData = { clicked: false }
			scene.add(mesh)
			squares.push(mesh)
		}
	}

	function onMouseMove(event) {
		const rect = container.getBoundingClientRect()
		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
	}

	function onMouseClick() {
		raycaster.setFromCamera(mouse, camera)
		const hits = raycaster.intersectObjects(squares)
		if (hits.length > 0) {
			const mesh = hits[0].object
			mesh.userData.clicked = !mesh.userData.clicked
			mesh.material.color.setHex(mesh.userData.clicked ? COLORS.clicked : COLORS.unclicked)
		}
	}

	function updateHover() {
		raycaster.setFromCamera(mouse, camera)
		const hits = raycaster.intersectObjects(squares)

		for (const mesh of squares) {
			if (mesh.userData.clicked) continue
			const isHovered = hits.some((h) => h.object === mesh)
			mesh.material.color.setHex(isHovered ? COLORS.hover : COLORS.unclicked)
		}
	}

	function animate() {
		requestId = requestAnimationFrame(animate)
		updateHover()
		renderer.render(scene, camera)
	}

	let requestId = requestAnimationFrame(animate)

	container.addEventListener('mousemove', onMouseMove)
	container.addEventListener('click', onMouseClick)

	function onResize() {
		const w = container.clientWidth
		const h = container.clientHeight
		const aspect = w / h
		camera.left = -aspect * 12
		camera.right = aspect * 12
		camera.top = 12
		camera.bottom = -12
		camera.updateProjectionMatrix()
		renderer.setSize(w, h)
	}

	const resizeObserver = new ResizeObserver(onResize)
	resizeObserver.observe(container)

	function dispose() {
		cancelAnimationFrame(requestId)
		resizeObserver.disconnect()
		container.removeEventListener('mousemove', onMouseMove)
		container.removeEventListener('click', onMouseClick)
		for (const mesh of squares) {
			mesh.geometry.dispose()
			mesh.material.dispose()
		}
		renderer.dispose()
		container.removeChild(renderer.domElement)
	}

	return { dispose }
}
