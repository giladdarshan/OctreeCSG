# OctreeCSG
Constructive Solid Geometry (CSG) library for use with [three.js](https://github.com/mrdoob/three.js)\
The OctreeCSG library is using the [Octree](https://en.wikipedia.org/wiki/Octree) data structure to store the geometry data for the [CSG](https://en.wikipedia.org/wiki/Constructive_solid_geometry) operations
<br />

All the code examples below can be tested live in [3dd.dev](https://3dd.dev)

### Table of Contents
- [Usage](#usage)
- [Basic Operations](#basic-operations)
  - [OctreeCSG.meshUnion](#mesh-union-octreecsgmeshunion)
  - [OctreeCSG.meshSubtract](#mesh-subtract-octreecsgmeshsubtract)
  - [OctreeCSG.meshIntersect](#mesh-intersect-octreecsgmeshintersect)
- [Advanced Operations](#advanced-operations)
  - [OctreeCSG.fromMesh](#octreecsgfrommesh)
  - [OctreeCSG.toMesh](#octreecsgtomesh)
  - [OctreeCSG.union](#octreecsgunion)
  - [OctreeCSG.subtract](#octreecsgsubtract)
  - [OctreeCSG.intersect](#octreecsgintersect)
  - [OctreeCSG.operation](#octreecsgoperation)
- [Array Operations](#array-operations)
- [Asynchronous Operations](#asynchronous-operations)
- [OctreeCSG Flags](#octreecsg-flags)
- [Examples](#examples)
- [Resources](#resources)

## Usage
OctreeCSG comes as a Javascript Module and can be imported with the following command:
```js
import OctreeCSG from './OctreeCSG/OctreeCSG.js';
```
<br/>

## Basic Operations
OctreeCSG provides basic boolean operations (union, subtract and intersect) for ease of use.
The basic operations expects the same type of parameters:
| Parameter | Description |
| --- | --- |
| mesh1 | First mesh |
| mesh2 | Second mesh |
| targetMaterial | (Optional) The material to use for the final mesh, can be a single material or an array of two materials. **Default**: A clone of the material of the first mesh |

### Mesh Union (OctreeCSG.meshUnion)
```js
const geometry = new THREE.BoxGeometry(10, 10, 10);
const material1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const material2 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const mesh1 = new THREE.Mesh(geometry, material1);
const mesh2 = new THREE.Mesh(geometry.clone(), material2);
mesh2.position.set(5, -5, 5);

const resultMesh = OctreeCSG.meshUnion(mesh1, mesh2);
scene.add(resultMesh);
```

### Mesh Subtract (OctreeCSG.meshSubtract)
```js
const geometry = new THREE.BoxGeometry(10, 10, 10);
const material1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const material2 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const mesh1 = new THREE.Mesh(geometry, material1);
const mesh2 = new THREE.Mesh(geometry.clone(), material2);
mesh2.position.set(5, -5, 5);

const resultMesh = OctreeCSG.meshSubtract(mesh1, mesh2);
scene.add(resultMesh);
```

### Mesh Intersect (OctreeCSG.meshIntersect)
```js
const geometry = new THREE.BoxGeometry(10, 10, 10);
const material1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const material2 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const mesh1 = new THREE.Mesh(geometry, material1);
const mesh2 = new THREE.Mesh(geometry.clone(), material2);
mesh2.position.set(5, -5, 5);

const resultMesh = OctreeCSG.meshIntersect(mesh1, mesh2);
scene.add(resultMesh);
```
<br/><br/>

## Advanced Operations
### OctreeCSG.fromMesh
Converts a three.js mesh to an Octree
| Parameter | Description |
| --- | --- |
| obj | three.js mesh |
| objectIndex | (Optional) Used for specifying the geometry group index in the result mesh. **Default**: Input mesh's groups if there are any |
| octree | (Optional) Target octree to use. **Default**: new Octree |
| buildTargetOctree | (Optional) Specifies if to build the target Octree tree or return a flat Octree (true / flase). **Default**: true |

### OctreeCSG.toMesh
Converts an Octree to a three.js mesh
| Parameter | Description |
| --- | --- |
| octree | Octree object |
| material | Material object or an array of materials to use for the new three.js mesh |
<br/>

### OctreeCSG.union:
Merges two Octrees (octreeA and octreeB) to one Octree

| Parameter | Description |
| --- | --- |
| octreeA | First octree object |
| octreeB | Second octree object |
| buildTargetOctree | (Optional) Specifies if to build the target Octree tree or return a flat Octree (true / flase). **Default**: true |
```js
const geometry = new THREE.BoxGeometry(10, 10, 10);
const material1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const material2 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const mesh1 = new THREE.Mesh(geometry, material1);
const mesh2 = new THREE.Mesh(geometry.clone(), material2);
mesh2.position.set(5, -5, 5);
const octreeA = OctreeCSG.fromMesh(mesh1);
const octreeB = OctreeCSG.fromMesh(mesh2);

const resultOctree = OctreeCSG.union(octreeA, octreeB);

const resultMesh = OctreeCSG.toMesh(resultOctree, mesh1.material.clone());
scene.add(resultMesh);
```
<br/>

### OctreeCSG.subtract:
Subtracts octreeB from octreeA and returns the result Octree

| Parameter | Description |
| --- | --- |
| octreeA | First octree object |
| octreeB | Second octree object |
| buildTargetOctree | (Optional) Specifies if to build the target Octree tree or return a flat Octree (true / flase). **Default**: true |
```js
const geometry = new THREE.BoxGeometry(10, 10, 10);
const material1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const material2 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const mesh1 = new THREE.Mesh(geometry, material1);
const mesh2 = new THREE.Mesh(geometry.clone(), material2);
mesh2.position.set(5, -5, 5);
const octreeA = OctreeCSG.fromMesh(mesh1);
const octreeB = OctreeCSG.fromMesh(mesh2);

const resultOctree = OctreeCSG.subtract(octreeA, octreeB);

const resultMesh = OctreeCSG.toMesh(resultOctree, mesh1.material.clone());
scene.add(resultMesh);
```
<br/>

### OctreeCSG.intersect:
Returns the intersection of octreeA and octreeB

| Parameter | Description |
| --- | --- |
| octreeA | First octree object |
| octreeB | Second octree object |
| buildTargetOctree | (Optional) Specifies if to build the target Octree tree or return a flat Octree (true / flase). **Default**: true |
```js
const geometry = new THREE.BoxGeometry(10, 10, 10);
const material1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const material2 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const mesh1 = new THREE.Mesh(geometry, material1);
const mesh2 = new THREE.Mesh(geometry.clone(), material2);
mesh2.position.set(5, -5, 5);
const octreeA = OctreeCSG.fromMesh(mesh1);
const octreeB = OctreeCSG.fromMesh(mesh2);

const resultOctree = OctreeCSG.intersect(octreeA, octreeB);

const resultMesh = OctreeCSG.toMesh(resultOctree, mesh1.material.clone());
scene.add(resultMesh);
```
<br/>



### OctreeCSG.operation
CSG Hierarchy of Operations (syntax may change), provides a simple method to combine several CSG operations into one

| Parameter | Description |
| --- | --- |
| obj | Input object with the CSG hierarchy |
| returnOctrees | (Optional) Specifies whether to return the Octrees as part of the result or not (true / false). **Default**: false |

Input object structure:
| Key | Expected Value |
| --- | --- |
| op | Type of operation to perform as string, options: union, subtract and intersect |
| material | (Optional) Used only in the root level of the object, if a material is provided the returned object will be a three.js mesh instead of an Octree. Value can be a single material or an array of materials |
| objA | First object, can be a three.js mesh, Octree or a sub-structure of the CSG operation |
| objB | Second object, can be a three.js mesh, Octree or a sub-structure of the CSG operation |
```js
let baseMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
let cubeGeometry = new THREE.BoxGeometry(10, 10, 10);
let sphereGeometry = new THREE.SphereGeometry(6.5, 64, 32);
let baseCylinderGeometry = new THREE.CylinderGeometry(3, 3, 20, 64);

let cubeMesh = new THREE.Mesh(cubeGeometry, baseMaterial.clone());
let sphereMesh = new THREE.Mesh(sphereGeometry, baseMaterial.clone());
let cylinderMesh1 = new THREE.Mesh(baseCylinderGeometry.clone(), baseMaterial.clone());
let cylinderMesh2 = new THREE.Mesh(baseCylinderGeometry.clone(), baseMaterial.clone());
let cylinderMesh3 = new THREE.Mesh(baseCylinderGeometry.clone(), baseMaterial.clone());

cubeMesh.material.color.set(0xff0000);
sphereMesh.material.color.set(0x0000ff);
cylinderMesh1.material.color.set(0x00ff00);
cylinderMesh2.material.color.set(0x00ff00);
cylinderMesh3.material.color.set(0x00ff00);
cylinderMesh2.rotation.set(0, 0, THREE.MathUtils.degToRad(90));
cylinderMesh3.rotation.set(THREE.MathUtils.degToRad(90), 0, 0);

let result = OctreeCSG.operation({
    op: "subtract",
    material: [cubeMesh.material, sphereMesh.material, cylinderMesh1.material, cylinderMesh2.material, cylinderMesh3.material],
    objA: {
        op: "intersect",
        objA: cubeMesh,
        objB: sphereMesh
    },
    objB: {
        op: "union",
        objA: {
            op: "union",
            objA: cylinderMesh1,
            objB: cylinderMesh2,
        },
        objB: cylinderMesh3
    }
});
scene.add(result);
```
<br/>

## Array Operations
OctreeCSG provides 3 methods to perform CSG operations on an array of meshes / octrees

| Parameter | Description |
| --- | --- |
| objArr | An array of meshes or octrees to perform the CSG operation on |
| materialIndexMax | (Optional) Can be used to specify the maximum number of groups in the result Octree. **Default**: Infinity |

List of Methods:
- OctreeCSG.unionArray - Union operation on an array of meshes
- OctreeCSG.subtractArray - Subtract operation on an array of meshes
- OctreeCSG.intersectArray - Intersect operation on an array of meshes
<br/>

## Asynchronous Operations
OctreeCSG provides asynchronous CSG methods for all the advanced CSG operations.

List of Methods:
- OctreeCSG.async.union
- OctreeCSG.async.subtract
- OctreeCSG.async.intersect
- OctreeCSG.async.operation
- OctreeCSG.async.unionArray
- OctreeCSG.async.subtractArray
- OctreeCSG.async.intersectArray
<br/>

## OctreeCSG Flags
The following flags and variables control how OctreeCSG operates.

| Flag / Variable | Default Value | Description |
| --- | --- | --- |
| OctreeCSG.useOctreeRay | true | Determines if to use OctreeCSG's ray intersection logic or use three.js's intersection logic (Raycaster.intersectObject). **Options**: true, false |
| OctreeCSG.rayIntersectTriangleType | MollerTrumbore | Determines which ray-triangle intersection algorithm to use. three.js's ray-triangle intersection algorithm proved to be not accurate enough for CSG operations during testing so the [Möller–Trumbore ray-triangle intersection algorithm](https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm) was implemented. **Options**: MollerTrumbore, regular (uses three.js's Ray.intersectTriangle) |
| OctreeCSG.useWindingNumber | false | Determines if to use the ray-triangle intersection algorithm or the [Winding number algorithm](https://en.wikipedia.org/wiki/Point_in_polygon#Winding_number_algorithm). The Winding number alogirthm can be more accurate than the ray-triangle algorithm on some occasions at the cost of performance. **Options**: true, false |
| OctreeCSG.maxLevel | 16 | Maximum number of sub-Octree levels in the tree |
| OctreeCSG.polygonsPerTree | 100 | Minimum number of polygons (triangles) in a sub-Octree before a split is needed |
<br/>

## Examples
Coming soon.
<br/>

## Resources
- The Polygon, Vertex and Plane classes were adapted from [THREE-CSGMesh](https://github.com/manthrax/THREE-CSGMesh)
- The Winding number algorithm is based on this [code](https://github.com/grame-cncm/faust/blob/master-dev/tools/physicalModeling/mesh2faust/vega/libraries/windingNumber/windingNumber.cpp)
- The Möller–Trumbore ray-triangle intersection algorithm is based on this [code](https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm#C++_implementation)
- The triangle-triangle intersection logic and algorithm is based on this [code](https://github.com/benardp/contours/blob/master/freestyle/view_map/triangle_triangle_intersection.c)
