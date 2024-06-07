export const mesh = () => {

	/*
	 *	Each element is a vertex with the following schema:
	 *	{
	 *		x: <num>,
	 *		y: <num>,
	 *		z: <num>,
	 *		neighbors: [<num>, ...],
	 *		exterior: <bool>,
	 *	}
	 */
	const graph = []

	graph.fromBitmap = (bitmap, scale=1) => {
		const canvas = document.createElement('canvas')

		canvas.width = bitmap.width * scale
		canvas.height = bitmap.height * scale

		const ctx = canvas.getContext('2d')

		ctx.scale(scale, scale)

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

				node.surroundingNodes = [
					vertexIndexMap[i - 1]?.[j - 1],
					vertexIndexMap[i - 1]?.[j],
					vertexIndexMap[i - 1]?.[j + 1],
					vertexIndexMap[i][j - 1],
					vertexIndexMap[i][j + 1],
					vertexIndexMap[i + 1]?.[j - 1],
					vertexIndexMap[i + 1]?.[j],
					vertexIndexMap[i + 1]?.[j + 1],
				].filter(idx => idx != undefined && idx != -1)

				if (
					node.surroundingNodes.length == 8
					&& i % 2 != j % 2
				) return

				node.neighbors = [
					vertexIndexMap[i - 1]?.[j],
					vertexIndexMap[i][j - 1],
					vertexIndexMap[i][j + 1],
					vertexIndexMap[i + 1]?.[j],
				].filter(idx =>
					idx != undefined
					&& idx != -1
				)
			})
		)

		return graph
	}

	return graph
}

const _getVolumes = mesh => {
	const result = []

	// Construct volume elements
	mesh.forEach(({x, y, z, neighbors: n}, v) => {
		if (n.length < 3) return

		for (let i = 0; i < n.length; i++) {
			for (let j = i + 1; j < n.length; j++) {
				for (let k = j + 1; k < n.length; k++) {
					const volumeElement = [v, n[i], n[j], n[k]]
					const volumeElementNodes = volumeElement.map(pointIdx => mesh[pointIdx])

					// Must be 3d to be a volume element
					if (
						volumeElementNodes.every(node => node.x == x)
						|| volumeElementNodes.every(node => node.y == y)
						|| volumeElementNodes.every(node => node.z == z)
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
	mesh.forEach(({x, y, z, neighbors: n}, v) => {
		if (n.length < 2) return

		for (let i = 0; i < n.length; i++) {
			for (let j = i + 1; j < n.length; j++) {
				const surfaceElement = [v, n[i], n[j]]
				const surfaceElementNodes = surfaceElement.map(pointIdx => mesh[pointIdx])

				// Must be on the exterior to be a surface element
				if (
					!surfaceElementNodes.every(node => node.exterior)
				) continue

				// Must be 2d to be a surface element
				if (
					[
						surfaceElementNodes.every(node => node.x == x),
						surfaceElementNodes.every(node => node.y == y),
						surfaceElementNodes.every(node => node.z == z),
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
