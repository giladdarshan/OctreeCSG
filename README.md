# OctreeCSG

### Union:
```js
let geometry1 = new THREE.BoxGeometry( 10, 10, 10 );
let material1 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
let mesh1 = new THREE.Mesh( geometry1, material1 );
let geometry2 = new THREE.BoxGeometry( 10, 10, 10 );
let material2 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
let mesh2 = new THREE.Mesh( geometry2, material2 );
mesh2.position.set(6, -6, 6);

let octreeA = OctreeCSG.fromMesh(mesh1);
let octreeB = OctreeCSG.fromMesh(mesh2);
let resultOctree = OctreeCSG.union(octreeA, octreeB);

let resultMesh = OctreeCSG.toMesh(resultOctree, mesh1.material.clone());
scene.add(resultMesh);
```
<br/>

### Subtract:
```js
let geometry1 = new THREE.BoxGeometry( 10, 10, 10 );
let material1 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
let mesh1 = new THREE.Mesh( geometry1, material1 );
let geometry2 = new THREE.BoxGeometry( 10, 10, 10 );
let material2 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
let mesh2 = new THREE.Mesh( geometry2, material2 );
mesh2.position.set(6, -6, 6);

let octreeA = OctreeCSG.fromMesh(mesh1);
let octreeB = OctreeCSG.fromMesh(mesh2);
let resultOctree = OctreeCSG.subtract(octreeA, octreeB);

let resultMesh = OctreeCSG.toMesh(resultOctree, mesh1.material.clone());
scene.add(resultMesh);
```
<br/>

### Intersect:
```js
let geometry1 = new THREE.BoxGeometry( 10, 10, 10 );
let material1 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
let mesh1 = new THREE.Mesh( geometry1, material1 );
let geometry2 = new THREE.BoxGeometry( 10, 10, 10 );
let material2 = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
let mesh2 = new THREE.Mesh( geometry2, material2 );
mesh2.position.set(6, -6, 6);

let octreeA = OctreeCSG.fromMesh(mesh1);
let octreeB = OctreeCSG.fromMesh(mesh2);
let resultOctree = OctreeCSG.intersect(octreeA, octreeB);

let resultMesh = OctreeCSG.toMesh(resultOctree, mesh1.material.clone());
scene.add(resultMesh);
```
<br/>

### CSG Hierarchy of Operations:
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
