export const mesh = () => {

	/*
	 *	Each element is a vertex with the following schema:
	 *	{
	 *		x: <num>,
	 *		y: <num>,
	 *		z: <num>,
	 *		idx: <num>,
	 *		neighbors: [<node>, ...],
	 *		surroundingNodes: [<num, ...>],
	 *		exterior: <bool>,
	 *	}
	 */
	const graph = []

	graph.fromBitmap = (bitmap) => {
		const canvas = document.createElement('canvas')

		canvas.width = bitmap.width
		canvas.height = bitmap.height

		const ctx = canvas.getContext('2d')

		// Initialize binary image to 0
		const binaryImage =
			[...new Array(canvas.height)].map(() =>
				[...new Array(canvas.width)].map(() => 0)
			)

		ctx.drawImage(bitmap, 0, 0)

		// TODO: figure out why the binary image is inverted
		// Convert to binary image 
		ctx.getImageData(0, 0, canvas.width, canvas.height).data.forEach((byte, i) => {
			const row = Math.floor(i / (canvas.width * 4))
			const col = Math.floor(i % (canvas.width * 4) / 4)

			if (binaryImage[row][col]) return

			binaryImage[row][col] = byte > 0 ? 1 : 0
		})

		// Initialize vertex index-map values to -1 (not a vertex)
		const vertexIndexMap = 
			[...new Array(canvas.height)].map(() =>
				[...new Array(canvas.width)].map(() => -1)
			)

		// Assign each black pixel a vertex index
		binaryImage.forEach((row, i) =>
			row.forEach((col, j) => {
				if (!col) return // TODO: invert condition when binary image is fixed
				
				vertexIndexMap[i][j] = graph.length
				graph.push({x: j, y: i, z: 0, idx: graph.length, neighbors: [], exterior: true})
			})
		)

		// Connect each vertex to its neighbors
		binaryImage.forEach((row, i) =>
			row.forEach((col, j) => {
				if (!col) return // TODO: invert condition when binary image is fixed

				const node = graph[vertexIndexMap[i][j]]

				const neighborMap = {
					topLeft: vertexIndexMap[i - 1]?.[j - 1],
					top: vertexIndexMap[i - 1]?.[j],
					topRight: vertexIndexMap[i - 1]?.[j + 1],
					left: vertexIndexMap[i][j - 1],
					right: vertexIndexMap[i][j + 1],
					bottomLeft: vertexIndexMap[i + 1]?.[j - 1],
					bottom: vertexIndexMap[i + 1]?.[j],
					bottomRight: vertexIndexMap[i + 1]?.[j + 1],
				}

				node.surroundingNodes = Object.values(neighborMap)
					.filter(idx => idx != undefined && idx != -1)

				if (
					node.surroundingNodes.length == 8
					&& i % 2 != j % 2
				) return

				const { topLeft, top, topRight, left, right, bottomLeft, bottom, bottomRight } = neighborMap

				node.neighbors = [
					left,
					right,
					top,
					bottom,
				].filter(idx =>
					idx != undefined
					&& idx != false
					&& idx != -1
				).map(idx => graph[idx])
			})
		)

		// Remove redundant nodes
		binaryImage.forEach((row, i) =>
			row.forEach((col, j) => {
				if (!col) return // TODO: invert condition when binary image is fixed

				const node = graph[vertexIndexMap[i][j]]

				const neighborMap = {
					topLeft: vertexIndexMap[i - 1]?.[j - 1],
					top: vertexIndexMap[i - 1]?.[j],
					topRight: vertexIndexMap[i - 1]?.[j + 1],
					left: vertexIndexMap[i][j - 1],
					right: vertexIndexMap[i][j + 1],
					bottomLeft: vertexIndexMap[i + 1]?.[j - 1],
					bottom: vertexIndexMap[i + 1]?.[j],
					bottomRight: vertexIndexMap[i + 1]?.[j + 1],
				}

				if (i % 2 == j % 2) return

				const { topLeft, top, topRight, left, right, bottomLeft, bottom, bottomRight } = neighborMap

				const remove = {
					[left]:
						(!graph[top] || graph[left]?.neighbors.some(n => n.idx == topLeft))
						&& (!graph[bottom] || graph[left]?.neighbors.some(n => n.idx == bottomLeft)),
					[right]:
						(!graph[top] || graph[right]?.neighbors.some(n => n.idx == topRight))
						&& (!graph[bottom] || graph[right]?.neighbors.some(n => n.idx == bottomRight)),
					[top]:
						(!graph[left] || graph[top]?.neighbors.some(n => n.idx == topLeft))
						&& (!graph[right] || graph[top]?.neighbors.some(n => n.idx == topRight)),
					[bottom]:
						(!graph[left] || graph[bottom]?.neighbors.some(n => n.idx == bottomLeft))
						&& (!graph[right] || graph[bottom]?.neighbors.some(n => n.idx == bottomRight)),
				}

				node.neighbors = node.neighbors.filter(n => !remove[n.idx])
			})

		)

		return graph
	}

	graph.smooth = (maxDist = 5) => {
		const corners = graph.filter(node => node.surroundingNodes.length < 5)
		const sides = graph.filter(node => node.surroundingNodes.length == 5)

		const distance = (n1, n2) => Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2))

		const quadrant = (n1, n2) => {
			const direction = {
				x: n2.x - n1.x,
				y: n2.y - n1.y,
			}

			return direction.x > 0 && direction.y > 0 ? 1
				: direction.x > 0 && direction.y < 0 ? 2
				: direction.x < 0 && direction.y < 0 ? 3
				: 4
		}

		corners.forEach((n1, i) => {
			// Connect to the closest two corners within range

			const candidates = corners
				.filter((_, j) => j != i)
				.filter(n2 => distance(n1, n2) <= maxDist)
				.sort((n2, n3) => distance(n1, n2) - distance(n1, n3))
				.filter((n2, j, array) => j == 0 || quadrant(n1, n2) != quadrant(n1, array[0]))
				.filter((_, j) => j < 2)

			const addSurface = (n1, n2) => {
				const getNextNode = n =>
					n.surroundingNodes
						.map(n3 => graph[n3])
						.sort((n3, n4) => distance(n2, n3) - distance(n2, n4))[0]

				let newNode = getNextNode(n1)

				while (
					newNode.surroundingNodes.length == 5
					&& newNode.x != n2.x
					&& newNode.y != n2.y
				) {
					newNode = getNextNode(newNode)
				}

				graph.push({
					x: newNode.x,
					y: newNode.y,
					z: 0,
					idx: graph.length,
					neighbors: [n1, n2],
					exterior: true,
				})
			}

			candidates.forEach(n2 => addSurface(n1, n2))

			// If there are not enough corners within range, connect to the furthest side node in range

			if (candidates.length >= 2) return

			const closest = candidates.length == 1 ? distance(n1, candidates[0]) : maxDist

			sides
				.filter(n2 => distance(n1, n2) <= maxDist)
				.sort((n2, n3) => distance(n1, n3) - distance(n1, n2))
				.filter((n2, j) => candidates.length == 0 || quadrant(n1, n2) != quadrant(n1, candidates[0]))
				.filter((n2, j, array) => j == 0 || quadrant(n1, n2) != quadrant(n1, array[0]))
				.filter((_, j) => j < 2 - candidates.length)
				.forEach(n2 => addSurface(n1, n2))
		})

		return graph
	}

	graph.extrude = (thickness) => {
		for (let i = 1; i <= thickness; i++) {
			const lowerLayer = graph.filter(n => n.z == i - 1)

			lowerLayer.forEach(n => graph.push({
				...n,
				z: i,
				idx: graph.length,
				neighbors: [
					...n.neighbors.map(n1 => n1.idx),
				],
			}))

			const newLayer = graph.filter(n => n.z == i)

			newLayer.forEach(n => {
				n.neighbors = n.neighbors.map(idx => graph[idx + lowerLayer.length])
			})

			newLayer.forEach(n => n.y += i)

			lowerLayer.forEach(n => {
				if (i % 2 == 0 && n.x % 2 == n.y % 2) return
				if (i % 2 == 1 && n.x % 2 != n.y % 2) return
				if (n.neighbors.length == 0) return

				const match = newLayer.filter(n1 => n1.x == n.x && n1.y == n.y)[0]

				if (!match) return

				n.neighbors.push(match)
			})

			newLayer.forEach(n => {
				if (i % 2 == 0 && n.x % 2 != n.y % 2) return
				if (i % 2 == 1 && n.x % 2 == n.y % 2) return
				if (n.neighbors.length == 0) return

				const match = lowerLayer.filter(n1 => n1.x == n.x && n1.y == n.y)[0]

				if (!match) return

				n.neighbors.push(match)
			})
		}

		return graph
	}

	return graph
}

const _getVolumes = mesh => {
	return [] // TODO: fix function and remove line
	const result = []

	// Construct volume elements
	mesh.forEach(n => {
		if (n.neighbors.length < 3) return

		for (let i = 0; i < n.neighbors.length; i++) {
			for (let j = i + 1; j < n.neighbors.length; j++) {
				for (let k = j + 1; k < n.neighbors.length; k++) {
					const volumeElementNodes = [n, n.neighbors[i], n.neighbors[j], n.neighbors[k]]
					const volumeElement = volumeElementNodes.map(n => n.idx)

					if (volumeElementNodes.some(node => !node)) continue

					// Must be 3d to be a volume element
					if (
						volumeElementNodes.every(node => node.x == n.x)
						|| volumeElementNodes.every(node => node.y == n.y)
						|| volumeElementNodes.every(node => node.z == n.z)
					) continue

					result.push(volumeElement)
				}
			}
		}
	})

	return result
}

const _getSurfaces = mesh => {
	const result = []

	// Construct surface elements
	mesh.forEach(n => {
		if (n.neighbors.length < 2) return

		for (let i = 0; i < n.neighbors.length; i++) {
			for (let j = i + 1; j < n.neighbors.length; j++) {
				const surfaceElementNodes = [n, n.neighbors[i], n.neighbors[j]]
				const surfaceElement = surfaceElementNodes.map(n => n?.idx)

				if (surfaceElementNodes.some(node => !node)) continue

				// Must be on the exterior to be a surface element
				if (
					!surfaceElementNodes.every(node => node.exterior)
				) continue

				// Must be 2d to be a surface element
				if (
					[
						surfaceElementNodes.every(node => node.x == n.x),
						surfaceElementNodes.every(node => node.y == n.y),
						surfaceElementNodes.every(node => node.z == n.z),
					]
					.reduce((acc, isConstrainedDim) => acc + isConstrainedDim) != 1
				) continue

				result.push(surfaceElement)
			}
		}
	})

	return result
}

// Convert mesh to Nmag mesh format (PYFEM mesh file v1.0)
// https://nmag.readthedocs.io/en/latest/finite_element_mesh_generation.html#ascii-nmesh
export const mesh2nmesh = mesh => {

	// TODO: add support for different regions
	const region1 = 1
	const region2 = -1

	const nmesh = {
		nodes: mesh.map(({x, y, z}) => [x, y, z].join('\t')),
		simplices: _getVolumes(mesh).map(
			v => [region1, ...v].join('\t')
		),
		surfaces: _getSurfaces(mesh).map(
			s => [region1, region2, ...s].join('\t')
		),
		periodic: [],
	}

	// Render to text and return
	return [
		'# PYFEM mesh file version 1.0',
		`# dim = 3\tnodes = ${nmesh.nodes.length}\tsimplices = ${nmesh.simplices.length}\tsurfaces = ${nmesh.surfaces.length}\tperiodic = ${nmesh.periodic.length}`,
		nmesh.nodes.length,
		...nmesh.nodes,
		nmesh.simplices.length,
		...nmesh.simplices,
		nmesh.surfaces.length,
		...nmesh.surfaces,
		nmesh.periodic.length,
		...nmesh.periodic,
	].join('\n')
}

// Convert mesh to NGSolve/Netgen neutral mesh format
export const mesh2neutralmesh = mesh => {

	// TODO: add support for different regions
	const region = 1;

	mesh = mesh.filter(n => n)

	const neutralMesh = {
		points: mesh.map(
			({x, y, z}) => [x, y, z].join('\t')
		),
		volumeElements: _getVolumes(mesh).map(
			v => [region, ...v.map(idx => idx + 1)].join('\t')
		),
		surfaceElements: _getSurfaces(mesh).map(
			s => [region, ...s.map(idx => idx + 1)].join('\t')
		)
	}

	// Render to text and return
	return [
		neutralMesh.points.length,
		...neutralMesh.points,
		neutralMesh.volumeElements.length,
		...neutralMesh.volumeElements,
		neutralMesh.surfaceElements.length,
		...neutralMesh.surfaceElements,
	].join('\n')
}
