import { $ } from './modules/common.js'
import Scene from './modules/scene.js'
import { svg, path, svg2points } from './modules/svg-lib.js'
import { triangle, invertedTriangle, arrangement } from './modules/gates.js'
import {
	extrudePoints,
	createTetrahedrons,
	drawModel,
	centerScene,
} from './modules/model-utils.js'

const scene = new Scene()
	.project(2, $('canvas').width / $('canvas').height)

const triangles =
	svg()
	.shapes([
		arrangement({
			positionGrid: [
				[1],
			],
			/*
			positionGrid: [
				[0, 1, 0, 1, 0, 1],
				[0, 1, 0, 1, 0, 1],
				[1, 0, 1, 0, 1, 0],
				[1, 0, 1, 0, 1, 0],
			],
			*/
			spacing: 10,
			triangleSpecs: {
				width: 200,
				vertexRad: 10,
				sideRad: 50,
				extrusion: 70,
			},
		}),
	])
	.renderTo($('#svg-target'))
	.fitContent()

let points = await svg2points(triangles)

console.log(points)

points = extrudePoints(points, 2)

const tetrahedrons = createTetrahedrons(points)

centerScene(scene, tetrahedrons)

drawModel(scene, tetrahedrons)

// Tranformation controls

$('main').onmousedown = () => $('main').isClicked = true
$('main').onmouseup = () => $('main').isClicked = false
$('main').onmouseout = () => $('main').isClicked = false

$('main').onmousemove = e => {
	if (!$('main').isClicked) return

	scene.clear()

	// Click and drag to rotate
	!e.shiftKey && scene.rotate(
		Math.PI * e.movementY / 100,
		Math.PI * e.movementX / 100,
		0,
	)

	// Shift-Click and drag to translate
	e.shiftKey && scene.translate(
		4.5 * e.movementX / $('main').clientWidth,
		-4.5 * e.movementY / $('main').clientHeight,
		0,
	)

	drawModel(scene, tetrahedrons)
}

// Mouse-wheel to scale
$('main').onwheel = e => {
	scene.clear()
	scene.scale(e.deltaY > 0 ? 1.15 : 0.85)
	drawModel(scene, tetrahedrons)
}

// Resize canvas when it's containers size changes
setInterval(() => {
	if (
		$('canvas').width == $('main').clientWidth
		&& $('canvas').height == $('main').clientHeight
	) return

	scene
		.resizeCanvas($('main').clientWidth, $('main').clientHeight)
		.project(2, $('canvas').width / $('canvas').height)
	drawModel(scene, tetrahedrons)
}, 100)
