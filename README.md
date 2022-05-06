# OctreeCSG

Union:
```
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

Subtract:
```
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


Intersect:
```
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
