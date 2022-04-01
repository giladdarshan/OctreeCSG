// import { Capsule } from '/js/threejs/math/Capsule.js';
import { CSG } from "/js/three-csg/csg-lib.js";
const { Vector2, Vector3, Box3, BackSide, DoubleSide, FrontSide, Matrix3, Matrix4, Ray, Triangle, BufferGeometry, BufferAttribute, Mesh, Raycaster } = THREE;
const _v1 = new Vector3();
const _v2 = new Vector3();
const tv0 = new Vector3();
const tv1 = new Vector3();
const _raycaster1 = new Raycaster();
// const maxTreeLevel = 16;
// const octreeDirection = [
//     new Vector3(1, 1, -1),   // 0
//     new Vector3(-1, 1, -1),  // 1
//     new Vector3(-1, -1, -1), // 2
//     new Vector3(1, -1, -1),  // 3
//     new Vector3(1, 1, 1),    // 4
//     new Vector3(-1, 1, 1),   // 5
//     new Vector3(-1, -1, 1),  // 6
//     new Vector3(1, -1, 1)    // 7
// ];

const octreeDirection = [
    new Vector3(-1, -1, -1), // 0
    new Vector3(-1, -1, 1),  // 1
    new Vector3(-1, 1, -1),  // 2
    new Vector3(-1, 1, 1),   // 3
    new Vector3(1, -1, -1),  // 4
    new Vector3(1, -1, 1),   // 5
    new Vector3(1, 1, -1),   // 6
    new Vector3(1, 1, 1),    // 7
];

// for (let x = 0; x < 2; x++) {

//     for (let y = 0; y < 2; y++) {

//         for (let z = 0; z < 2; z++) {

let _octreeID = 0;
let _triangleID = 0;
let _polygonID = 0;
const EPSILON = 1e-5;
const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;
let testvar = 0;
// const trianglesMap = new Map();
const polygonMaps = new Map();

const octreeMap = new Map();
class OctreeCSG {
    constructor(box, parent) {
        this.isOctree = true;
        // this.triangles = [];
        this.polygons = [];
        this.polygonMap;
        this.bspNode;
        this.box = box;
        this.subTrees = [];
        this.parent = parent;
        this.level = 0;
        this.aPolygons = [];
        this.bPolygons = [];
        Object.defineProperty(this, 'id', {
            value: _octreeID++
        });

    }
    testget() {
        return testvar;
    }
    testset() {
        testvar++;
    }
    isEmpty() {
        return this.polygons.length === 0;
    }
    addPolygon(polygon) {
        if (!this.bounds) {
            this.bounds = new Box3();
        }
        let triangle = polygon.triangle;
        this.bounds.min.x = Math.min(this.bounds.min.x, triangle.a.x, triangle.b.x, triangle.c.x);
        this.bounds.min.y = Math.min(this.bounds.min.y, triangle.a.y, triangle.b.y, triangle.c.y);
        this.bounds.min.z = Math.min(this.bounds.min.z, triangle.a.z, triangle.b.z, triangle.c.z);
        this.bounds.max.x = Math.max(this.bounds.max.x, triangle.a.x, triangle.b.x, triangle.c.x);
        this.bounds.max.y = Math.max(this.bounds.max.y, triangle.a.y, triangle.b.y, triangle.c.y);
        this.bounds.max.z = Math.max(this.bounds.max.z, triangle.a.z, triangle.b.z, triangle.c.z);

        this.polygons.push(polygon);
        return this;
    }

    calcBox() {

        this.box = this.bounds.clone();

        // offset small ammount to account for regular grid
        this.box.min.x -= 0.01;
        this.box.min.y -= 0.01;
        this.box.min.z -= 0.01;

        return this;

    }

    split(level) {

        if (!this.box) return;

        const subTrees = [];
        const halfsize = _v2.copy(this.box.max).sub(this.box.min).multiplyScalar(0.5);
        let directionX = -1;
        for (let x = 0; x < 2; x++) {
            let directionY = -1;
            for (let y = 0; y < 2; y++) {
                let directionZ = -1;
                for (let z = 0; z < 2; z++) {
                    const box = new Box3();
                    const v = _v1.set(x, y, z);

                    box.min.copy(this.box.min).add(v.multiply(halfsize));
                    box.max.copy(box.min).add(halfsize);
                    box.expandByScalar(EPSILON);
                    // box.min.x -= 0.01;
                    // box.min.y -= 0.01;
                    // box.min.z -= 0.01;
                    // console.log(directionX, directionY, directionZ, "box:", JSON.stringify(box));
                    subTrees.push(new OctreeCSG(box, this));
                    directionZ += 2;
                }
                directionY += 2;
            }
            directionX += 2;
        }
        // console.log(`Octree (${this.id}) suggested subTrees:`, subTrees);
        // let triangle;
        let polygon;
        // while (triangle = this.triangles.pop()) {
        while (polygon = this.polygons.pop()) {
            let triangle = polygon.triangle;
            let found = false;
            for (let i = 0; i < subTrees.length; i++) {
                // let triangleMidPoint = Vector3();
                if (subTrees[i].box.containsPoint(triangle.getMidpoint(_v1))) {
                    // if (subTrees[i].box.intersectsTriangle(triangle)) {

                    // subTrees[i].triangles.push(triangle);
                    subTrees[i].polygons.push(polygon);
                    found = true;
                }

            }
            if (!found) {
                console.error("ERROR: unable to find subtree for:", triangle, triangle.getMidpoint(_v1), this, subTrees);
                throw new Error(`Unable to find subtree for triangle at level ${level}`);
            }

        }
        // if (level >= OctreeCSG.maxLevel) {
        //     console.log(`Warning: Octree reached max level (${level})`);
        // }
        for (let i = 0; i < subTrees.length; i++) {
            subTrees[i].level = level + 1;
            const len = subTrees[i].polygons.length;

            if (len > OctreeCSG.polygonsPerTree && level < OctreeCSG.maxLevel) {

                subTrees[i].split(level + 1);

            }

            // if (len !== 0) {

            this.subTrees.push(subTrees[i]);

            // }

        }

        return this;

    }

    buildTree() {
        this.setPolygonMap(new Map());
        // octree.setPolygonMap();
        this.calcBox();
        this.split(0);
        this.processTree();
        // console.log("trianglesMap", trianglesMap);
        return this;

    }
    buildBSP() {
        this.polygons.length && (this.bspNode = new Node(this.polygons.map(p => p.clone())));
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].buildBSP();
        }
    }
    processTree() {
        octreeMap.set(this.id, this);
        if (!this.isEmpty()) {
            // console.log("triangles in level", this.level, "Octree ID:", this.id);
            // let currentBox = this.box.clone();
            // for (let i = 0; i < this.triangles.length; i++) {
            for (let i = 0; i < this.polygons.length; i++) {
                OctreeCSG.addPolygonToMap(this.polygonMap, this.polygons[i], this);
                // OctreeCSG.addTriangleToMap(trianglesMap, this.triangles[i], this);
                this.box.expandByPoint(this.polygons[i].triangle.a);
                this.box.expandByPoint(this.polygons[i].triangle.b);
                this.box.expandByPoint(this.polygons[i].triangle.c);
                // currentBox.expandByPoint(this.triangles[i].a);
                // currentBox.expandByPoint(this.triangles[i].b);
                // currentBox.expandByPoint(this.triangles[i].c);

                if (this.polygons[i].source === "a") {
                    this.aPolygons.push(this.polygons[i]);
                }
                else if (this.polygons[i].source === "b") {
                    this.bPolygons.push(this.polygons[i]);
                }
            }
            // if (!this.box.equals(currentBox)) {
            //     console.log("bound box changed in tree id", this.id, this.box, currentBox);
            // }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].setPolygonMap(this.polygonMap);
            this.subTrees[i].processTree();
        }
    }
    setPolygonMap(map) {
        this.polygonMap = map;
    }
    getRayTriangles(ray, triangles) {
        // console.log("triangles:", triangles);
        for (let i = 0; i < this.subTrees.length; i++) {

            const subTree = this.subTrees[i];
            if (!ray.intersectsBox(subTree.box)) {
                // console.log(i, "ray not intersecting", subTree.box);
                continue;
            }
            // console.log(i, "poly count:", subTree.polygons.length);
            // if (subTree.triangles.length > 0) {
            if (subTree.polygons.length > 0) {
                // for (let j = 0; j < subTree.triangles.length; j++) {
                for (let j = 0; j < subTree.polygons.length; j++) {

                    // if (triangles.indexOf(subTree.triangles[j]) === - 1) triangles.push(subTree.triangles[j]);
                    if (triangles.indexOf(subTree.polygons[j].triangle) === - 1) {
                        // console.log("adding triangle", subTree.polygons[j].triangle);
                        triangles.push(subTree.polygons[j].triangle);
                    }
                    // else {
                    //     console.log("skipping triangle", subTree.polygons[j].triangle, "all triangles:", triangles);
                    // }

                }

            } else {

                subTree.getRayTriangles(ray, triangles);

            }

        }

        return triangles;

    }





    getPolygonsIntersectingBox(box, polygons = []) {
        for (let i = 0; i < this.subTrees.length; i++) {
            let subTree = this.subTrees[i];
            if (!subTree.box.intersectsBox(box)) {
                continue;
            }
            if (subTree.polygons.length > 0) {
                for (let j = 0; j < subTree.polygons.length; j++) {
                    let polygon = subTree.polygons[j];
                    // if (polygon.box.intersectsBox(box)) {
                    if (box.intersectsTriangle(polygon.triangle)) {
                        polygons.push(polygon);
                    }
                }
            }
            else {
                subTree.getPolygonsIntersectingBox(box, polygons);
            }
        }

        return polygons;
    }
    getRayPolygons(ray, polygons) {
        // console.log("triangles:", triangles);
        for (let i = 0; i < this.subTrees.length; i++) {
            const subTree = this.subTrees[i];
            // if (!ray.intersectsBox(subTree.box)) {
            if (!subTree.box.containsPoint(ray.origin)) {
                // console.log(i, "ray not intersecting", subTree.box);
                continue;
            }
            // console.log(i, "poly count:", subTree.polygons.length);
            // if (subTree.triangles.length > 0) {
            if (subTree.polygons.length > 0) {
                // for (let j = 0; j < subTree.triangles.length; j++) {
                for (let j = 0; j < subTree.polygons.length; j++) {

                    // if (triangles.indexOf(subTree.triangles[j]) === - 1) triangles.push(subTree.triangles[j]);
                    if (polygons.indexOf(subTree.polygons[j]) === - 1) {
                        // console.log("adding triangle", subTree.polygons[j].triangle);
                        polygons.push(subTree.polygons[j]);
                    }
                    // else {
                    //     console.log("skipping triangle", subTree.polygons[j].triangle, "all triangles:", triangles);
                    // }

                }

            } else {

                subTree.getRayPolygons(ray, polygons);

            }

        }

        return polygons;

    }

    rayIntersect(ray, intersects = []) {

        if (ray.direction.length() === 0) return;

        const polygons = [];
        let polygon, position, distance = 1e100;

        // this.getRayTriangles(ray, triangles);
        this.getRayPolygons(ray, polygons);
        // console.log("polygons", polygons);
        for (let i = 0; i < polygons.length; i++) {

            // if (material.side === BackSide) {
            //     intersect = ray.intersectTriangle(pC, pB, pA, true, point);
            // } else {
            //     intersect = ray.intersectTriangle(pA, pB, pC, material.side !== DoubleSide, point);
            // }
            let result;
            // ray.direction = polygons[i].vertices[0].normal;

            if (OctreeCSG.testSide == BackSide) { // backside
                // console.log("ray testing back");
                result = ray.intersectTriangle(polygons[i].triangle.c, polygons[i].triangle.b, polygons[i].triangle.a, true, _v1);
            }
            else if (OctreeCSG.testSide == DoubleSide) { // doubleside
                // console.log("ray testing double");
                // console.log("OctreeCSG.testSide !== DoubleSide", OctreeCSG.testSide !== DoubleSide, OctreeCSG.testSide);
                result = ray.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, false, _v1);
            }
            else if (OctreeCSG.testSide == FrontSide) { // frontside
                // console.log("ray testing front");
                // console.log("OctreeCSG.testSide !== DoubleSide", OctreeCSG.testSide !== DoubleSide, OctreeCSG.testSide);
                result = ray.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, true, _v1);
            }
            // result = ray.intersectTriangle(triangles[i].a, triangles[i].b, triangles[i].c, false, _v1);

            // const result = ray.intersectTriangle(triangles[i].a, triangles[i].b, triangles[i].c, true, _v1);
            // console.log(i, result);
            if (result) {

                const newdistance = result.sub(ray.origin).length();

                if (distance > newdistance) {

                    position = result.clone().add(ray.origin);
                    distance = newdistance;
                    polygon = polygons[i];

                }
                if (distance < 1e100) {
                    intersects.push({ distance: newdistance, polygon: polygons[i], position: result.clone().add(ray.origin) });
                }
                else {
                    console.log("BIG DISTANCE:", { distance: distance, polygon: polygon, position: position });
                }

            }
            // else {
            //     console.log(i, "nope", result);
            // }

        }
        // intersectObject(object, recursive = true, intersects = []) {
        // 	intersectObject(object, this, intersects, recursive);
        // 	intersects.sort(ascSort);
        // 	return intersects;
        // }
        intersects.length && intersects.sort(raycastIntersectAscSort);
        return intersects;
        // return distance < 1e100 ? { distance: distance, triangle: triangle, position: position } : false;

    }

    raycastIntersect(raycaster, matrixWorld, intersects = []) {
        if (raycaster.ray.direction.length() === 0) return;
        let _inverseMatrix = (new Matrix4()).copy(matrixWorld).invert();
        let ray2 = (new Ray()).copy(raycaster.ray).applyMatrix4(_inverseMatrix);
        console.log("ray?", raycaster.ray.clone(), ray2.clone());
        // let ray2 = raycaster.ray;
        // Check boundingBox before continuing
        const polygons = [];
        let polygon, position, distance = 1e100;

        // this.getRayTriangles(ray, triangles);
        this.getRayPolygons(ray2, polygons);

        for (let i = 0; i < polygons.length; i++) {

            // if (material.side === BackSide) {
            //     intersect = ray.intersectTriangle(pC, pB, pA, true, point);
            // } else {
            //     intersect = ray.intersectTriangle(pA, pB, pC, material.side !== DoubleSide, point);
            // }
            let result;
            // ray2.direction = polygons[i].vertices[0].normal.clone();
            // ray2.direction.transformDirection(_inverseMatrix);
            // console.log("ray direction:", ray2.direction.clone());

            if (OctreeCSG.testSide == BackSide) { // backside
                // console.log("ray testing back");
                result = ray2.intersectTriangle(polygons[i].triangle.c, polygons[i].triangle.b, polygons[i].triangle.a, true, _v1);
            }
            else if (OctreeCSG.testSide == DoubleSide) { // doubleside
                // console.log("ray testing double");
                // console.log("OctreeCSG.testSide !== DoubleSide", OctreeCSG.testSide !== DoubleSide, OctreeCSG.testSide);
                result = ray2.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, false, _v1);
            }
            else if (OctreeCSG.testSide == FrontSide) { // frontside
                // console.log("ray testing front");
                // console.log("OctreeCSG.testSide !== DoubleSide", OctreeCSG.testSide !== DoubleSide, OctreeCSG.testSide);
                result = ray2.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, true, _v1);
            }
            else {
                return [];
            }
            if (result === null) {
                continue;
            }
            let _intersectionPointWorld = new Vector3();
            _intersectionPointWorld.copy(_v1);
            _intersectionPointWorld.applyMatrix4(matrixWorld);
            // console.log(i, "_intersectionPointWorld", _intersectionPointWorld, _v1, result)
            // if (result) {
            let newdistance = raycaster.ray.origin.distanceTo(_intersectionPointWorld);
            // const newdistance = result.sub(ray2.origin).length();
            if (newdistance < raycaster.near || newdistance > raycaster.far) {
                // return null;
                console.log(i, "skipping:", newdistance);
                continue;
            }
            // let ddtm = raycaster.ray.direction.dot(polygons[i].plane.normal);
            // if (ddtm <= 0) {
            //     console.log("Point is outside the object", ddtm);
            //     continue;
            // }
            // if (ddtm > 0) {
            //     console.log("Point is inside the object", ddtm);
            // }
            // else {
            //     console.log("Point is outside the object", ddtm);
            // }
            // return {
            //     distance: distance,
            //     point: _intersectionPointWorld.clone(),
            //     object: object
            // };
            let intersectObj = { distance: newdistance, polygon: polygons[i], position: _intersectionPointWorld.clone() };
            intersects.push(intersectObj);
            // result = ray.intersectTriangle(triangles[i].a, triangles[i].b, triangles[i].c, false, _v1);

            // const result = ray.intersectTriangle(triangles[i].a, triangles[i].b, triangles[i].c, true, _v1);
            console.log(i, "result:", intersectObj);
            // if (result) {

            //     const newdistance = result.sub(ray.origin).length();

            //     if (distance > newdistance) {

            //         position = result.clone().add(ray.origin);
            //         distance = newdistance;
            //         polygon = polygons[i];

            //     }
            //     if (distance < 1e100) {
            //         intersects.push({ distance: newdistance, polygon: polygons[i], position: result.clone().add(ray.origin) });
            //     }
            //     else {
            //         console.log("BIG DISTANCE:", { distance: distance, polygon: polygon, position: position });
            //     }

            // }
            // else {
            //     console.log(i, "nope", result);
            // }

        }
        // intersectObject(object, recursive = true, intersects = []) {
        // 	intersectObject(object, this, intersects, recursive);
        // 	intersects.sort(ascSort);
        // 	return intersects;
        // }
        intersects.length && intersects.sort(raycastIntersectAscSort);
        return intersects;
        // return distance < 1e100 ? { distance: distance, triangle: triangle, position: position } : false;

    }

    fromGraphNode(group) {

        group.updateWorldMatrix(true, true);

        group.traverse((obj) => {

            if (obj.isMesh === true) {

                let geometry, isTemp = false;

                if (obj.geometry.index !== null) {

                    isTemp = true;
                    geometry = obj.geometry.toNonIndexed();

                } else {

                    geometry = obj.geometry;

                }

                const positionAttribute = geometry.getAttribute('position');

                for (let i = 0; i < positionAttribute.count; i += 3) {

                    const v1 = new Vector3().fromBufferAttribute(positionAttribute, i);
                    const v2 = new Vector3().fromBufferAttribute(positionAttribute, i + 1);
                    const v3 = new Vector3().fromBufferAttribute(positionAttribute, i + 2);

                    v1.applyMatrix4(obj.matrixWorld);
                    v2.applyMatrix4(obj.matrixWorld);
                    v3.applyMatrix4(obj.matrixWorld);

                    this.addTriangle(newTriangle(v1, v2, v3));

                }

                if (isTemp) {

                    geometry.dispose();

                }

            }

        });

        this.buildTree();

        return this;

    }

    // fromMesh(obj) {
    //     obj.updateWorldMatrix(true, true);

    //     let geometry, isTemp = false;

    //     if (obj.geometry.index !== null) {

    //         isTemp = true;
    //         geometry = obj.geometry.toNonIndexed();

    //     } else {

    //         geometry = obj.geometry;

    //     }

    //     const positionAttribute = geometry.getAttribute('position');

    //     // let allTriangles = [];
    //     // trianglesSet.clear();
    //     for (let i = 0; i < positionAttribute.count; i += 3) {

    //         const v1 = new Vector3().fromBufferAttribute(positionAttribute, i);
    //         const v2 = new Vector3().fromBufferAttribute(positionAttribute, i + 1);
    //         const v3 = new Vector3().fromBufferAttribute(positionAttribute, i + 2);

    //         v1.applyMatrix4(obj.matrixWorld);
    //         v2.applyMatrix4(obj.matrixWorld);
    //         v3.applyMatrix4(obj.matrixWorld);
    //         // allTriangles.push(newTriangle(v1, v2, v3));
    //         this.addTriangle(newTriangle(v1, v2, v3));

    //     }
    //     // let dups = [];
    //     // for (let i = 0; i < allTriangles.length; i++) {
    //     //     if (!Octree.isUniqueTriangle(allTriangles[i], trianglesSet)) {
    //     //         dups.push(allTriangles[i]);
    //     //         console.log("SKIPPING DUPLICATE:", allTriangles[i]);
    //     //     }
    //     //     this.addTriangle(allTriangles[i]);
    //     // }
    //     // console.log("dups", dups.length, dups);
    //     if (isTemp) {

    //         geometry.dispose();

    //     }


    //     this.build();

    //     return this;

    // };

    getTriangles() {
        let triangles = [];
        // if (this.bspNode) {
        //     let nodePolys = this.bspNode.allPolygons();
        //     // triangles.push(...nodePolys.filter(p => p.valid));
        //     for (let i = 0; i < nodePolys.length; i++) {
        //         if (nodePolys[i].valid) {
        //             triangles.push(nodePolys[i].triangle);
        //         }
        //     }
        // }
        for (let i = 0; i < this.polygons.length; i++) {
            if (this.polygons[i].valid) {
                triangles.push(this.polygons[i].triangle);
            }
            // else {
            //     console.log(i, "polygon invalid", this.polygons[i]);
            // }
        }

        // if (this.front)
        //     polygons = polygons.concat(this.front.allPolygons());
        // if (this.back)
        //     polygons = polygons.concat(this.back.allPolygons());
        // // console.log(this.nodeNum, "polygons", polygons.length);

        for (let i = 0; i < this.subTrees.length; i++) {
            triangles.push(...this.subTrees[i].getTriangles());
        }
        return triangles;
    }
    getPolygons(polygons = []) {
        // let polygons = this.polygons.slice();
        // let polygons = [];
        if (this.bspNode) {
            polygons.push(...this.bspNode.allPolygons());
        }
        else {
            // polygons.push(...this.polygons);
            for (let i = 0; i < this.polygons.length; i++) {
                if (this.polygons[i].valid) {
                    polygons.push(this.polygons[i]);
                }
            }
        }
        // if (this.front)
        //     polygons = polygons.concat(this.front.allPolygons());
        // if (this.back)
        //     polygons = polygons.concat(this.back.allPolygons());
        // // console.log(this.nodeNum, "polygons", polygons.length);

        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getPolygons(polygons);
        }
        return polygons;
    }
    getInvalidPolygons(polygons = []) {
        polygons.push(...this.polygons.filter(p => !p.valid));
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getInvalidPolygons(polygons);
        }

        return polygons;
    }
    clipPolygons(polygons) {
        let newPolys = [];
        if (this.bspNode) {
            newPolys.push(...this.bspNode.clipPolygons(polygons));
        }

        for (let i = 0; i < this.subTrees.length; i++) {
            newPolys.push(...this.subTrees[i].clipPolygons(polygons));
        }
        return newPolys;
    }

    invert() {
        if (this.bspNode) {
            this.bspNode.invert();
        }
        else {
            this.polygons.forEach(p => p.flip());
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].invert();
        }
    }
    clipTo(bsp) {
        if (this.bspNode) {
            this.bspNode.clipTo(bsp);
        }

        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].clipTo(bsp);
        }
    }

    getBSP() {
        let bspArray = [];
        this.bspNode && bspArray.push(this.bspNode);
        for (let i = 0; i < this.subTrees.length; i++) {
            bspArray.push(...this.subTrees[i].getBSP());
        }
        return bspArray;
    }
    parseBSP() {
        if (this.bspNode) {
            this.polygons = this.bspNode.allPolygons();
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].parseBSP();
        }
    }

    getMesh() {
        if (this.parent) {
            return this.parent.getMesh();
        }
        return this.mesh;
    }

    replacePolygon(polygon, newPolygons, firstRun = true) {
        if (!Array.isArray(newPolygons)) {
            newPolygons = [newPolygons];
        }
        if (this.polygons.length > 0) {
            let polygonIndex = this.polygons.indexOf(polygon);
            if (polygonIndex > -1) {
                // console.log("replacing polygons in tree id", this.id, "old polygon:", polygon, "new polygons:", newPolygons);
                polygon.setInvalid();
                this.polygons.splice(polygonIndex, 1, ...newPolygons);
                // polygon.delete();
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].replacePolygon(polygon, newPolygons, false);
        }
        if (firstRun) {
            polygon.delete();
        }
    }
    invalidatePolygonsByState(state = "back", strict = false) {
        if (this.polygons.length > 0) {
            this.polygons.forEach(polygon => {
                if (polygon.valid) {
                    // if (strict) {
                    //     if (polygon.checkAllStates(state)) {
                    //         // console.log("Invalidating", polygon);
                    //         polygon.setInvalid();
                    //     }
                    // }
                    // else {
                    //     if (polygon.state == state) {
                    //         polygon.setInvalid();
                    //     }
                    // }
                    if ((strict && polygon.checkAllStates(state)) || (!strict && polygon.state == state)) {
                        // console.log("Invalidating", polygon);
                        polygon.setInvalid();
                    }
                }
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].invalidatePolygonsByState(state, strict);
        }
    }
    invalidatePolygonsByStates(states = ["back"], strict = false) {
        if (!Array.isArray(states)) {
            states = [states];
        }
        if (this.polygons.length > 0) {
            this.polygons.forEach(polygon => {
                if (polygon.valid) {
                    let allTrue = true;
                    for (let i = 0; i < states.length; i++) {
                        let state = states[i];
                        if ((strict && !polygon.checkAllStates(state)) || (!strict && polygon.state != state)) {
                            allTrue = false;
                            break;
                        }
                    }
                    // if (strict) {
                    //     if (polygon.checkAllStates(state)) {
                    //         // console.log("Invalidating", polygon);
                    //         polygon.setInvalid();
                    //     }
                    // }
                    // else {
                    //     if (polygon.state == state) {
                    //         polygon.setInvalid();
                    //     }
                    // }
                    if (allTrue) {
                        // console.log("Invalidating", polygon);
                        polygon.setInvalid();
                    }
                }
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].invalidatePolygonsByStates(states, strict);
        }
    }
    markIntesectingPolygons(boundingBox) {
        if (this.polygons.length > 0) {
            this.polygons.forEach(polygon => {
                polygon.intersects = boundingBox.intersectsTriangle(polygon.triangle);
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].markIntesectingPolygons(boundingBox);
        }

    }
    resetPolygons() {
        if (this.polygons.length > 0) {
            this.polygons.forEach(polygon => {
                polygon.reset();
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].resetPolygons();
        }
    }
    handleIntersectingPolygons(targetOctree) {
        if (this.polygons.length > 0) {
            // testvar++;
            // this.polygons.forEach(polygon => {
            //     polygon.reset();
            // });
            const polygonStack = this.polygons.filter(polygon => (polygon.intersects == true) && (polygon.state == "undecided"));
            let currentPolygon = polygonStack.pop();
            // let iteration = 0;
            while (currentPolygon) {
                // console.log("--------------------");
                if (currentPolygon.state !== "undecided") {
                    continue;
                }
                let targetPolygons = targetOctree.getPolygonsIntersectingBox(currentPolygon.box);
                // console.log(testvar, iteration++, currentPolygon, targetPolygons.length);
                // targetPolygons.length === 0 && console.log("NO TARGETS", currentPolygon);
                if (targetPolygons.length > 0) {
                    // let needsBreak = false;
                    for (let j = 0; j < targetPolygons.length; j++) {
                        let target = targetPolygons[j];
                        // console.log("needsBreak", needsBreak);
                        let splitResults = splitPolygonByPlane(currentPolygon, target.plane);
                        if (splitResults.length > 1) {
                            // let newPolygons = [];
                            for (let i = 0; i < splitResults.length; i++) {
                                let polygon = splitResults[i].polygon;
                                polygon.intersects = currentPolygon.intersects;
                                // if (currentPolygon.id === polygon.id) {
                                //     console.log("ASDSADASDSADASDASDASDSADSADSADSADASDASDASDSADSADASDASDADAS");
                                // }
                                if (splitResults[i].type == "back") {
                                    polygonStack.push(polygon);
                                }
                                else {
                                    polygon.setState(splitResults[i].type);
                                }
                                //     newPolygons.push(polygon);
                            }
                            this.replacePolygon(currentPolygon, splitResults.map(result => result.polygon));
                            // needsBreak = true;
                            break;
                        }
                        else {
                            if (currentPolygon.id !== splitResults[0].polygon.id) {
                                splitResults[0].polygon.intersects = currentPolygon.intersects;
                                if (splitResults[0].type == "back") {
                                    polygonStack.push(splitResults[0].polygon);
                                }
                                else {
                                    splitResults[0].polygon.setState(splitResults[0].type);
                                }
                                this.replacePolygon(currentPolygon, splitResults[0].polygon);
                                // needsBreak = true;
                                break;
                            }
                            else {
                                currentPolygon.setState(splitResults[0].type, "front");
                            }
                        }
                        // if (needsBreak) {
                        //     break;
                        // }
                        // console.log(j, currentPolygon, target, splitResults); 

                        // let polyType = getPolygonType(currentPolygon, target.plane);
                        // // console.log(i, currentPolygon, target, polyType);
                        // let polyType2 = getRayIntersectionType(currentPolygon, target, aMatrixWorld);
                        // console.log(i, "getRayIntersectionType", polyType2);
                    }
                }
                else {
                    let insideCount = 0;
                    // this.getRayPolygons(ray2, polygons);
                    for (let i = 0; i < currentPolygon.vertices.length; i++) {
                        let vertex = currentPolygon.vertices[i];
                        // console.log(i, j, vertex);
                        let point = vertex.pos;
                        let direction = vertex.normal.clone().normalize();
                        // let direction = new THREE.Vector3(1, 1, 1);
                        _raycaster1.set(point, direction);
                        let intersects = _raycaster1.intersectObject(targetOctree.mesh);
                        // console.log(i, "Intersects?", intersects);

                        if (intersects.length) {
                            if (direction.dot(intersects[0].face.normal) > 0) {
                                // console.log(i, "Point is inside the object", direction.dot(intersects[0].face.normal));
                                insideCount++;
                            }
                            // else {
                            // console.log(i, "Point is outside the object", direction.dot(intersects[0].face.normal));
                            // }
                        }
                    }
                    if (insideCount === currentPolygon.vertices.length) {
                        currentPolygon.setState("inside");
                    }
                    else {
                        currentPolygon.setState("outside");
                    }
                    // else if (insideCount > 0) {
                    //     currentPolygon.setState("spanning");
                    // }
                }
                // if (iteration >= 100) {
                //     break;
                // }
                // console.log("--------------------");
                currentPolygon = polygonStack.pop();
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].handleIntersectingPolygons(targetOctree);
        }
    }
    /*
    invalidatePolygonsByRay(targetOctree) {
        // return;

        if (this.polygons.length > 0) {
            // this.polygons.forEach(polygon => {
            //     polygon.reset();
            // });
            const polygonStack = this.polygons.filter(polygon => (polygon.intersects == true) && (polygon.state == "undecided"));
            let returnType = "undecided";

            let currentPolygon;
            let iteration = 0;
            while (currentPolygon = polygonStack.pop()) {
                let insideCount = 0;
                // this.getRayPolygons(ray2, polygons);
                for (let i = 0; i < currentPolygon.vertices.length; i++) {
                    let vertex = currentPolygon.vertices[i];
                    // console.log(i, j, vertex);
                    let point = vertex.pos;
                    let direction = vertex.normal.clone().normalize();
                    // let direction = new THREE.Vector3(1, 1, 1);
                    _raycaster1.set(point, direction);
                    let intersects = _raycaster1.intersectObject(targetOctree.mesh);
                    console.log(i, "Intersects?", intersects);

                    if (intersects.length) {
                        if (direction.dot(intersects[0].face.normal) > 0) {
                            console.log(i, "Point is inside the object", direction.dot(intersects[0].face.normal));
                            insideCount++;
                        }
                        else {
                            console.log(i, "Point is outside the object", direction.dot(intersects[0].face.normal));
                        }
                    }
                }
                if (insideCount === currentPolygon.vertices.length) {
                    currentPolygon.setState("inside");
                }
                else if (insideCount > 0) {
                    currentPolygon.setState("spanning");
                }
                else {
                    currentPolygon.setState("outside");
                }
                //         let polyType = getPolygonType(polygon, target.plane);
                //         console.log(i, polygon, target, polyType);
                //         let polyType2 = getRayIntersectionType(polygon, target, aMatrixWorld);
                //         console.log(i, "getRayIntersectionType", polyType2);
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].invalidatePolygonsByRay(targetOctree);
        }
    }
    */
    delete(firstRun = true) {
        if (this.polygons.length > 0) {
            this.polygons.forEach(p => p.delete());
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].delete(false);
        }
        this.subTrees.length = 0;
        if (firstRun) {
            this.polygonMap.clear();
        }
        this.polygonMap = undefined;
        this.box = undefined;
    }
    reduceDuplicatePolygons(set = new Set()) {
        if (this.polygons.length > 0) {
            this.polygons.forEach(p => {
                if (!OctreeCSG.isUniqueTriangle(p.triangle, set)) {
                    let polygonIndex = this.polygons.indexOf(p);
                    dupCount++;
                    if (polygonIndex > -1) {
                        p.setInvalid();
                        this.polygons.splice(polygonIndex, 1);
                        p.delete();
                    }
                }
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].reduceDuplicatePolygons(set);
        }
    }
    getDupCount() {
        return dupCount;
    }
}
let dupCount = 0;
function raycastIntersectAscSort(a, b) {
    return a.distance - b.distance;
}

OctreeCSG.bla = false;
OctreeCSG.testSide = DoubleSide;

// TODO: test max level 10 and polys per tree 50
OctreeCSG.maxLevel = 16;
OctreeCSG.polygonsPerTree = 8;

function newTriangle(v1, v2, v3) {
    let triangle = new Triangle(v1, v2, v3);
    Object.defineProperty(triangle, 'id', {
        value: _triangleID++
    });
    return triangle;
}


function splitPolygonByPlane(polygon, plane, result = []) {
    let returnPolygon = {
        polygon: polygon,
        type: "undecided"
    };
    let polygonType = 0;
    let types = [];
    for (let i = 0; i < polygon.vertices.length; i++) {
        let t = plane.normal.dot(polygon.vertices[i].pos) - plane.w;
        let type = (t < -EPSILON) ? BACK : (t > EPSILON) ? FRONT : COPLANAR;
        polygonType |= type;
        types.push(type);
    }
    switch (polygonType) {
        case COPLANAR:
            returnPolygon.type = plane.normal.dot(polygon.plane.normal) > 0 ? "coplanar-front" : "coplanar-back";
            result.push(returnPolygon);
            break;
        case FRONT:
            returnPolygon.type = "front";
            result.push(returnPolygon);
            break;
        case BACK:
            returnPolygon.type = "back";
            result.push(returnPolygon);
            break;
        case SPANNING:
            // returnType = "spanning";
            let f = [];
            let b = [];
            for (let i = 0; i < polygon.vertices.length; i++) {
                let j = (i + 1) % polygon.vertices.length;
                let ti = types[i];
                let tj = types[j];
                let vi = polygon.vertices[i];
                let vj = polygon.vertices[j];
                if (ti != BACK) {
                    f.push(vi);
                }
                if (ti != FRONT) {
                    b.push(ti != BACK ? vi.clone() : vi);
                }
                if ((ti | tj) == SPANNING) {
                    let t = (plane.w - plane.normal.dot(vi.pos)) / plane.normal.dot(tv0.copy(vj.pos).sub(vi.pos));
                    let v = vi.interpolate(vj, t);
                    f.push(v);
                    b.push(v.clone());
                }
            }
            if (f.length >= 3) {
                if (f.length > 3) {
                    let newPolys = splitPolygonArr(f);
                    for (let npI = 0; npI < newPolys.length; npI++) {
                        result.push({
                            polygon: new Polygon(newPolys[npI], polygon.shared),
                            type: "front"
                        });
                        // front.push(new Polygon(newPolys[npI], polygon.shared));
                    }
                }
                else {
                    result.push({
                        polygon: new Polygon(f, polygon.shared),
                        type: "front"
                    });
                    // front.push(new Polygon(f, polygon.shared));
                }
            }
            if (b.length >= 3) {
                if (b.length > 3) {
                    let newPolys = splitPolygonArr(b);
                    for (let npI = 0; npI < newPolys.length; npI++) {
                        // back.push(new Polygon(newPolys[npI], polygon.shared));
                        result.push({
                            polygon: new Polygon(newPolys[npI], polygon.shared),
                            type: "back"
                        });
                    }
                }
                else {
                    result.push({
                        polygon: new Polygon(b, polygon.shared),
                        type: "back"
                    });
                    // back.push(new Polygon(b, polygon.shared));
                }
            }
            break;
    }
    if (result.length == 0) {
        result.push(returnPolygon);
    }
    // console.log("polygon type", returnType, polygonType, types);
    return result;
}
let splitCounter = 0;
function splitPolygonArr(arr) {
    let resultArr = [];
    /*
    console.log('---------');
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].newlySplit) {
            console.log("newly split:", `${i}/${arr.length - 1}`, arr[i]);
            arr[i].newlySplit = false;
        }
    }
    let a = arr[0].pos.clone();
    let b = arr[1].pos.clone(); // j - 2
    let c = arr[2].pos.clone(); // j - 1
    let d = arr[3].pos.clone();

    // triangle 1
    let ab = b.clone().sub(a);
    let ac = c.clone().sub(a);
    let angleA = THREE.MathUtils.radToDeg(Math.acos((ab.dot(ac) / (ab.length() * ac.length()))));
    let ba = a.clone().sub(b);
    let bc = c.clone().sub(b);
    let angleB = THREE.MathUtils.radToDeg(Math.acos((ba.dot(bc) / (ba.length() * bc.length()))));
    let cb = b.clone().sub(c);
    let ca = a.clone().sub(c);
    let angleC = THREE.MathUtils.radToDeg(Math.acos((cb.dot(ca) / (cb.length() * ca.length()))));
    console.log("splitTest triangle 1", a, b, c, angleA, angleB, angleC, angleA + angleB + angleC);

    // triangle 2
    // let ac = c.clone().sub(a);
    let ad = d.clone().sub(a);
    let angleA2 = THREE.MathUtils.radToDeg(Math.acos((ac.dot(ad) / (ac.length() * ad.length()))));
    // let ca = a.clone().sub(c);
    let cd = d.clone().sub(c);
    let angleC2 = THREE.MathUtils.radToDeg(Math.acos((ca.dot(cd) / (ca.length() * cd.length()))));
    let dc = c.clone().sub(d);
    let da = a.clone().sub(d);
    let angleD = THREE.MathUtils.radToDeg(Math.acos((dc.dot(da) / (dc.length() * da.length()))));
    console.log("splitTest triangle 1", a, b, c, angleA2, angleC2, angleD, angleA2 + angleC2 + angleD);
    console.log('---------');
    */
    /*
    j = 3: 0,1,2 = a,b,c
    0
    j-2 = 3-2 = 1
    j-1 = 3-1 = 2

    j = 4: 0,2,3 = a,c,d
    0
    j-2 = 4-2 = 2
    j-1 = 4-1 = 3
    */
    for (let j = 3; j <= arr.length; j++) {
        let result = [];
        result.push(arr[0].clone());
        result.push(arr[j - 2].clone());
        result.push(arr[j - 1].clone());
        resultArr.push(result);
    }
    return resultArr;
}

OctreeCSG.union = function (octreeA, octreeB) {
    let polys = [];
    let octree = new OctreeCSG();
    // let aPolygons = octreeA.getPolygons();
    // let bPolygons = octreeB.getPolygons();
    // let filterResults;
    if (octreeA.box.intersectsBox(octreeB.box)) {
        let trianglesSet = new Set();
        let currentMeshSideA = octreeA.mesh.material.side;
        let currentMeshSideB = octreeB.mesh.material.side;
        octreeA.mesh.material.side = OctreeCSG.testSide;
        octreeB.mesh.material.side = OctreeCSG.testSide;

        octreeA.resetPolygons();
        octreeB.resetPolygons();
        // console.log(1);
        octreeA.markIntesectingPolygons(octreeB.box);
        // console.log(2);
        octreeB.markIntesectingPolygons(octreeA.box);
        // console.log(3);
        // console.log("octreeA", octreeA);
        octreeA.handleIntersectingPolygons(octreeB);
        // console.log(4);
        octreeB.handleIntersectingPolygons(octreeA);
        // console.log(5);
        //         let polyType = getPolygonType(polygon, target.plane);
        //         console.log(i, polygon, target, polyType);
        //         let polyType2 = getRayIntersectionType(polygon, target, aMatrixWorld);
        //         console.log(i, "getRayIntersectionType", polyType2);
        octreeA.invalidatePolygonsByState("back", true);
        // console.log(6);
        octreeB.invalidatePolygonsByState("back", true);
        // console.log(7);
        // octreeB.invalidatePolygonsByRay(octreeA);
        // octreeA.invalidatePolygonsByRay(octreeB);
        // octreeB.invalidatePolygonsByStates(["back", "inside"], false);
        octreeB.invalidatePolygonsByState("back", false);
        octreeA.invalidatePolygonsByState("inside", false);
        octreeB.invalidatePolygonsByState("inside", false);
        // console.log(8);
        // console.log("octreeB.getPolygons() After", octreeB.getPolygons().length);

        // console.log("...octreeA.getInvalidPolygons()", octreeA.getInvalidPolygons());
        // console.log("...octreeB.getInvalidPolygons()", octreeB.getInvalidPolygons());
        // let b = octreeB.getPolygons().filter(p => (p.intersects === true) && (p.state == "undecided"));
        // console.log("b", b);
        // octreeB.invalidatePolygonsByState("inside", false);

        // polys.push(...octreeA.getPolygons(), ...octreeB.getPolygons());
        // polys = octreeA.getPolygons().concat(octreeB.getPolygons());
        // polys.push(...octreeA.getPolygons());
        // polys.push(...octreeB.getPolygons());

        let polysA = octreeA.getPolygons();
        let polysB = octreeB.getPolygons();
        let limit = Math.min(polysA.length, 210);
        // for (let i = 205; i < limit; i++) {
        //     octree.addPolygon(polysA[i]);
        // }
        polysA.forEach(poly => octree.addPolygon(poly));
        polysB.forEach(poly => octree.addPolygon(poly));

        octree.buildTree();

        // console.log(9);
        if (octreeA.mesh.material.side !== currentMeshSideA) {
            octreeA.mesh.material.side = currentMeshSideA;
        }
        if (octreeB.mesh.material.side !== currentMeshSideB) {
            octreeB.mesh.material.side = currentMeshSideB;
        }
        // TODO: Function to invalidate non-intersecting polygons for subtract/intersects operations

    }
    else {
        polys.push(...octreeA.getPolygons(), ...octreeB.getPolygons());
        if (polys.length) {
            for (let i = 0; i < polys.length; i++) {
                octree.addPolygon(polys[i]);
            }
            octree.buildTree();
        }
    }

    // OctreeCSG.testSide = THREE.BackSide;
    // OctreeCSG.testSide = THREE.FrontSide;

    // OctreeCSG.testSide = THREE.DoubleSide;

    // if (polys.length) {
    //     for (let i = 0; i < polys.length; i++) {
    //         octree.addPolygon(polys[i]);
    //     }
    //     octree.buildTree();
    // }
    return octree;
}


/*
// OctreeCSG.union = function (octreeA, octreeB) {
OctreeCSG.union = function (octreeA, polygonsB) {
    // console.log("CSG?", CSG);
    let polys = [];
    let octree = new OctreeCSG();
    // let aPolygons = octreeA.getPolygons();
    // let bPolygons = octreeB.getPolygons();
    let aPolygons = [];
    let bPolygons = [];
    let { intersectingPolygons, nonIntersectingPolygons } = filterIntersectingPolygons(polygonsB, octreeA.box);
    console.log("intersectionResult", { intersectingPolygons, nonIntersectingPolygons });
    if (intersectingPolygons.length) {
        let bPolys = intersectingPolygons.map(p => p.clone());
        console.log("bPolys", bPolys);
        let b = new Node(bPolys);
        // console.log("bspB", b);
        // return octree;
        octreeA.clipTo(b);
        b.clipTo(octreeA);
        b.invert();
        b.clipTo(octreeA);
        b.invert();
        polys.push(...octreeA.getPolygons(), ...nonIntersectingPolygons, ...b.allPolygons());
    }
    else {
        polys.push(...octreeA.getPolygons(), ...nonIntersectingPolygons);
    }
    // if (octreeA.box.intersectsBox(octreeB.box)) {
    //     let current;
    //     let targetBox = octreeB.box;
    //     let intersectingOctree = new OctreeCSG();
    //     aPolygons.push(...filterIntersectingPolygons(octreeA, octreeB.box));
    //     aPolygons.forEach(p => {
    //         p.source = "a";
    //         intersectingOctree.addPolygon(p);
    //     });
    //     console.log("aPolygons", aPolygons);
    //     bPolygons.push(...filterIntersectingPolygons(octreeB, octreeA.box));
    //     bPolygons.forEach(p => {
    //         p.source = "b";
    //         intersectingOctree.addPolygon(p);
    //     });
    //     console.log("bPolygons", bPolygons);
    //     intersectingOctree.buildTree();
    //     console.log("intersectingOctree", intersectingOctree);
    //     // CSG.check
    //     let csgA = CSG.fromPolygons(aPolygons);
    //     let csgB = CSG.fromPolygons(bPolygons);
    //     let resultCSG = csgA.union(csgB);
    //     console.log("resultCSG", resultCSG);
    //     polys.push(...octreeA.getPolygons(), ...octreeB.getPolygons(), ...resultCSG.toPolygons());
    //     console.log("polys", polys);
    // }
    // else {
    //     polys.push(...octreeA.getPolygons(), ...octreeB.getPolygons());
    // }
    if (polys.length) {
        for (let i = 0; i < polys.length; i++) {
            octree.addPolygon(polys[i]);
        }
        octree.buildTree();
    }
    return octree;
}




function filterIntersectingPolygons(octree, boundingBox) {
    let stack = [octree];
    let current;
    let intersectingPolygons = [];
    while (current = stack.pop()) {
        if (!current.isEmpty()) {
            for (let i = 0; i < current.polygons.length; i++) {
                let polygon = current.polygons[i];
                if (polygon.box.intersectsBox(boundingBox)) {
                    intersectingPolygons.push(polygon);
                }
            }
            intersectingPolygons.forEach(p => {
                let idx = current.polygons.indexOf(p);
                idx > -1 && current.polygons.splice(idx, 1);
            });
        }
        current.subTrees.forEach(tree => stack.push(tree));                
    }
    return intersectingPolygons;
}

OctreeCSG.union = function (octreeA, octreeB) {
    // console.log("CSG?", CSG);
    let polys = [];
    let octree = new OctreeCSG();
    // let aPolygons = octreeA.getPolygons();
    // let bPolygons = octreeB.getPolygons();
    let aPolygons = [];
    let bPolygons = [];
    if (octreeA.box.intersectsBox(octreeB.box)) {
        let current;
        let targetBox = octreeB.box;
        let intersectingOctree = new OctreeCSG();
        aPolygons.push(...filterIntersectingPolygons(octreeA, octreeB.box));
        aPolygons.forEach(p => {
            p.source = "a";
            intersectingOctree.addPolygon(p);
        });
        console.log("aPolygons", aPolygons);
        bPolygons.push(...filterIntersectingPolygons(octreeB, octreeA.box));
        bPolygons.forEach(p => {
            p.source = "b";
            intersectingOctree.addPolygon(p);
        });
        console.log("bPolygons", bPolygons);
        intersectingOctree.buildTree();
        console.log("intersectingOctree", intersectingOctree);
        // CSG.check
        let csgA = CSG.fromPolygons(aPolygons);
        let csgB = CSG.fromPolygons(bPolygons);
        let resultCSG = csgA.union(csgB);
        console.log("resultCSG", resultCSG);
        polys.push(...octreeA.getPolygons(), ...octreeB.getPolygons(), ...resultCSG.toPolygons());
        console.log("polys", polys);
    }
    else {
        polys.push(...octreeA.getPolygons(), ...octreeB.getPolygons());
    }
    if (polys.length) {
        for (let i = 0; i < polys.length; i++) {
            octree.addPolygon(polys[i]);
        }
        octree.buildTree();
    }
    return octree;
}
*/
OctreeCSG.isUniqueTriangle = function (triangle, set) {
    const hash1 = `{${triangle.a.x},${triangle.a.y},${triangle.a.z}}-{${triangle.b.x},${triangle.b.y},${triangle.b.z}}-{${triangle.c.x},${triangle.c.y},${triangle.c.z}}`;
    
    if (set.has(hash1) === true) {
        return false;
    }
    else {
        set.add(hash1);
        return true;
    }
}
// CSG.toMesh = function(csg, toMatrix, toMaterial) {
const _normal1 = new Vector3();
const tmpm3 = new Matrix3();
const ttvv0 = new Vector3()
OctreeCSG.toGeometry = function (octree) {
    let triangles = octree.getTriangles();
    // console.log(triangles.length);

    let positions = [];
    let normals = [];
    let uvs = [];
    let trianglesSet = new Set();
    let duplicateCount = 0;
    // console.log(triangles[0].a);
    for (let i = 0; i < triangles.length; i++) {
        if (OctreeCSG.isUniqueTriangle(triangles[i], trianglesSet)) {
            positions.push(triangles[i].a.x, triangles[i].a.y, triangles[i].a.z);
            positions.push(triangles[i].b.x, triangles[i].b.y, triangles[i].b.z);
            positions.push(triangles[i].c.x, triangles[i].c.y, triangles[i].c.z);

            // let normal = new Vector3();
            triangles[i].getNormal(_normal1);
            normals.push(_normal1.x, _normal1.y, _normal1.z);
            normals.push(_normal1.x, _normal1.y, _normal1.z);
            normals.push(_normal1.x, _normal1.y, _normal1.z);
        }
        else {
            duplicateCount++;
        }
    }
    console.log("[toGeometry] duplicate count", duplicateCount);

    let geometry = new BufferGeometry();
    const positionNumComponents = 3;
    const normalNumComponents = 3;
    const uvNumComponents = 2;
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), positionNumComponents));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), normalNumComponents));
    // geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), uvNumComponents));
    // geometry.computeVertexNormals();
    return geometry;
}

OctreeCSG.toMesh = function (octree, toMaterial) {
    let geometry = OctreeCSG.toGeometry(octree);
    // geometry = BufferGeometryUtils.mergeVertices(geometry);
    // geometry = geometry.toNonIndexed();
    return new Mesh(geometry, toMaterial);
}

OctreeCSG.fromMesh = function (obj, objectIndex) {
    obj.updateWorldMatrix(true, true);
    let octree = new OctreeCSG();
    let geometry = obj.geometry;
    tmpm3.getNormalMatrix(obj.matrix);
    let posattr = geometry.attributes.position;
    let normalattr = geometry.attributes.normal;
    let uvattr = geometry.attributes.uv;
    let colorattr = geometry.attributes.color;
    let groups = geometry.groups;
    let index;
    if (geometry.index)
        index = geometry.index.array;
    else {
        index = new Array((posattr.array.length / posattr.itemSize) | 0);
        for (let i = 0; i < index.length; i++)
            index[i] = i;
    }
    // let triCount = (index.length / 3) | 0;
    let polys = [];
    // polys = new Array(triCount)
    for (let i = 0, pli = 0, l = index.length; i < l; i += 3, pli++) {
        let vertices = [];
        for (let j = 0; j < 3; j++) {
            let vi = index[i + j]
            let vp = vi * 3;
            let vt = vi * 2;
            let pos = new Vector3(posattr.array[vp], posattr.array[vp + 1], posattr.array[vp + 2]);
            let normal = new Vector3(normalattr.array[vp], normalattr.array[vp + 1], normalattr.array[vp + 2]);
            pos.applyMatrix4(obj.matrix);
            normal.applyMatrix3(tmpm3);
            // console.log("AA:", i, j, JSON.stringify({ a: posattr.array[vp], b: posattr.array[vp + 1], c: posattr.array[vp + 2] }), "pos:", JSON.stringify(pos));
            // console.log("BB:", i, j, JSON.stringify({ a: normalattr.array[vp], b: normalattr.array[vp + 1], c: normalattr.array[vp + 2]}), "normal:", JSON.stringify(normal));

            // v.applyMatrix4(obj.matrixWorld);
            // vertices.push(v);
            //     v2.applyMatrix4(obj.matrixWorld);
            //     v3.applyMatrix4(obj.matrixWorld);
            vertices.push(new Vertex(pos, normal, uvattr && { // uv
                x: uvattr.array[vt],
                y: uvattr.array[vt + 1]
            }, colorattr && { x: colorattr.array[vt], y: colorattr.array[vt + 1], z: colorattr.array[vt + 2] }));
        }
        if ((objectIndex === undefined) && groups && groups.length > 0) {
            let polygon;
            for (let group of groups) {
                if ((index[i] >= group.start) && (index[i] < (group.start + group.count))) {
                    polygon = new Polygon(vertices, group.materialIndex);
                }
            }
            if (polygon) {
                polys.push(polygon);
            }

        }
        else {
            polys.push(new Polygon(vertices, objectIndex));
        }
    }

    for (let i = 0; i < polys.length; i++) {
        if (isNaN(polys[i].plane.normal.x)) {
            console.log("polygon", i, "is NaN!!!!");
        }
        octree.addPolygon(polys[i]);
    }
    // octree.addTriangle(newTriangle(v1, v2, v3));


    octree.buildTree();
    // return CSG.fromPolygons(polys.filter(p => !isNaN(p.plane.normal.x)));
    octree.mesh = obj;
    return octree;

};

OctreeCSG.meshToPolygons = function (obj, objectIndex) {
    obj.updateWorldMatrix(true, true);
    // let octree = new OctreeCSG();
    let geometry = obj.geometry;
    tmpm3.getNormalMatrix(obj.matrix);
    let posattr = geometry.attributes.position;
    let normalattr = geometry.attributes.normal;
    let uvattr = geometry.attributes.uv;
    let colorattr = geometry.attributes.color;
    let groups = geometry.groups;
    let index;
    if (geometry.index)
        index = geometry.index.array;
    else {
        index = new Array((posattr.array.length / posattr.itemSize) | 0);
        for (let i = 0; i < index.length; i++)
            index[i] = i;
    }
    // let triCount = (index.length / 3) | 0;
    let polys = [];
    // polys = new Array(triCount)
    for (let i = 0, pli = 0, l = index.length; i < l; i += 3, pli++) {
        let vertices = [];
        for (let j = 0; j < 3; j++) {
            let vi = index[i + j]
            let vp = vi * 3;
            let vt = vi * 2;
            let pos = new Vector3(posattr.array[vp], posattr.array[vp + 1], posattr.array[vp + 2]);
            let normal = new Vector3(normalattr.array[vp], normalattr.array[vp + 1], normalattr.array[vp + 2]);
            pos.applyMatrix4(obj.matrix);
            normal.applyMatrix3(tmpm3);
            // v.applyMatrix4(obj.matrixWorld);
            // vertices.push(v);
            //     v2.applyMatrix4(obj.matrixWorld);
            //     v3.applyMatrix4(obj.matrixWorld);
            vertices.push(new Vertex(pos, normal, uvattr && { // uv
                x: uvattr.array[vt],
                y: uvattr.array[vt + 1]
            }, colorattr && { x: colorattr.array[vt], y: colorattr.array[vt + 1], z: colorattr.array[vt + 2] }));
        }
        if ((objectIndex === undefined) && groups && groups.length > 0) {
            let polygon;
            for (let group of groups) {
                if ((index[i] >= group.start) && (index[i] < (group.start + group.count))) {
                    polygon = new Polygon(vertices, group.materialIndex);
                }
            }
            if (polygon) {
                polys.push(polygon);
            }

        }
        else {
            polys.push(new Polygon(vertices, objectIndex));
        }
    }
    return polys;
    // for (let i = 0; i < polys.length; i++) {
    //     octree.addPolygon(polys[i]);
    // }
    // // octree.addTriangle(newTriangle(v1, v2, v3));

    // octree.buildTree();
    // // return CSG.fromPolygons(polys.filter(p => !isNaN(p.plane.normal.x)));
    // return octree;

};


// CSG.fromMesh = function (mesh, objectIndex) {
//     let csg = CSG.fromGeometry(mesh.geometry, objectIndex)
//     tmpm3.getNormalMatrix(mesh.matrix);
//     for (let i = 0; i < csg.polygons.length; i++) {
//         let p = csg.polygons[i]
//         for (let j = 0; j < p.vertices.length; j++) {
//             let v = p.vertices[j]
//             v.pos.copy(ttvv0.copy(v.pos).applyMatrix4(mesh.matrix));
//             v.normal.copy(ttvv0.copy(v.normal).applyMatrix3(tmpm3))
//         }
//     }
//     return csg;
// }

// CSG.fromGeometry = function (geom, objectIndex) {
//     let polys = []
//     if (geom.isGeometry) {
//         let fs = geom.faces;
//         let vs = geom.vertices;
//         let fm = ['a', 'b', 'c']
//         for (let i = 0; i < fs.length; i++) {
//             let f = fs[i];
//             let vertices = []
//             for (let j = 0; j < 3; j++)
//                 vertices.push(new Vertex(vs[f[fm[j]]], f.vertexNormals[j], geom.faceVertexUvs[0][i][j]))
//             polys.push(new Polygon(vertices, objectIndex))
//         }
//     } else if (geom.isBufferGeometry) {
//         let vertices, normals, uvs
//         let posattr = geom.attributes.position
//         let normalattr = geom.attributes.normal
//         let uvattr = geom.attributes.uv
//         let colorattr = geom.attributes.color
//         let groups = geom.groups;
//         let index;
//         if (geom.index)
//             index = geom.index.array;
//         else {
//             index = new Array((posattr.array.length / posattr.itemSize) | 0);
//             for (let i = 0; i < index.length; i++)
//                 index[i] = i
//         }
//         let triCount = (index.length / 3) | 0
//         polys = new Array(triCount)
//         for (let i = 0, pli = 0, l = index.length; i < l; i += 3,
//             pli++) {
//             let vertices = new Array(3)
//             for (let j = 0; j < 3; j++) {
//                 let vi = index[i + j]
//                 let vp = vi * 3;
//                 let vt = vi * 2;
//                 let x = posattr.array[vp]
//                 let y = posattr.array[vp + 1]
//                 let z = posattr.array[vp + 2]
//                 let nx = normalattr.array[vp]
//                 let ny = normalattr.array[vp + 1]
//                 let nz = normalattr.array[vp + 2]
//                 //let u = uvattr.array[vt]
//                 //let v = uvattr.array[vt + 1]
//                 vertices[j] = new Vertex({
//                     x,
//                     y,
//                     z
//                 }, {
//                     x: nx,
//                     y: ny,
//                     z: nz
//                 }, uvattr && {
//                     x: uvattr.array[vt],
//                     y: uvattr.array[vt + 1],
//                     z: 0
//                 }, colorattr && { x: colorattr.array[vt], y: colorattr.array[vt + 1], z: colorattr.array[vt + 2] });
//             }
//             if ((objectIndex === undefined) && groups && groups.length > 0) {
//                 for (let group of groups) {
//                     if ((index[i] >= group.start) && (index[i] < (group.start + group.count))) {
//                         polys[pli] = new Polygon(vertices, group.materialIndex);
//                     }
//                 }
//             }
//             else {
//                 polys[pli] = new Polygon(vertices, objectIndex)
//             }
//         }
//     } else
//         console.error("Unsupported CSG input type:" + geom.type)
//     return CSG.fromPolygons(polys.filter(p => !isNaN(p.plane.normal.x)));
// }



// OctreeCSG.replacePolygon = function(octree, polygon, newPolygons) {
//     let polygonTrees = octree.polygonMap.get(polygon);
//     if (polygonTrees) {
//         polygonTrees.forEach(tree => {
//             let polygonIndex = tree.polygons.indexOf(polygon);
//             if (polygonIndex > -1) {
//                 console.log("replacing polygons in tree id", tree.id, "old polygon:", polygon, "new polygons:", newPolygons);
//                 tree.polygons.splice(polygonIndex, 1, ...newPolygons);
//             }
//         });
//     }
// }
OctreeCSG.addPolygonToMap = function (map, polygon, value) {
    let mapValue = map.get(polygon) || [];
    mapValue.push(value);
    map.set(polygon, mapValue);
}

// OctreeCSG.addTriangleToMap = function (map, triangle, value) {
//     let mapValue = map.get(triangle) || [];
//     mapValue.push(value);
//     map.set(triangle, mapValue);
// }


///////////////////
//////  CSG  //////
///////////////////
// class CSG {
//     constructor() {
//         this.polygons = [];
//         this.leftOverPolygons = [];
//         this.boundingBox = new Box3();
//     }
//     clone() {
//         let csg = new CSG();
//         csg.polygons = this.polygons.map(p => p.clone())
//         return csg;
//     }

//     toPolygons() {
//         return this.polygons;
//     }

//     union(csg, checkBounds = CSG.checkBounds) {
//         if (checkBounds) {
//             if (!csg.boundingBox.isEmpty()) {
//                 this.reducePolygons(csg.boundingBox);
//             }
//             if (!this.boundingBox.isEmpty()) {
//                 csg.reducePolygons(this.boundingBox);
//             }
//         }
//         let a = new Node(this.clone().polygons);
//         let b = new Node(csg.clone().polygons);
//         a.clipTo(b);
//         b.clipTo(a);
//         b.invert();
//         b.clipTo(a);
//         b.invert();
//         a.build(b.allPolygons());
//         return CSG.fromPolygons(checkBounds ? [...a.allPolygons(), ...this.leftOverPolygons, ...csg.leftOverPolygons] : a.allPolygons());
//     }

//     subtract(csg, checkBounds = CSG.checkBounds) {
//         if (checkBounds) {
//             if (!csg.boundingBox.isEmpty()) {
//                 this.reducePolygons(csg.boundingBox);
//             }
//             if (!this.boundingBox.isEmpty()) {
//                 csg.reducePolygons(this.boundingBox);
//             }
//         }
//         let a = new Node(this.clone().polygons);
//         let b = new Node(csg.clone().polygons);
//         a.invert();
//         a.clipTo(b);
//         b.clipTo(a);
//         b.invert();
//         b.clipTo(a);
//         b.invert();
//         a.build(b.allPolygons());
//         a.invert();
//         return CSG.fromPolygons(checkBounds ? [...a.allPolygons(), ...this.leftOverPolygons] : a.allPolygons());
//     }

//     intersect(csg, checkBounds = CSG.checkBounds) {
//         if (checkBounds) {
//             if (!csg.boundingBox.isEmpty()) {
//                 this.reducePolygons(csg.boundingBox);
//             }
//             if (!this.boundingBox.isEmpty()) {
//                 csg.reducePolygons(this.boundingBox);
//             }
//         }
//         let a = new Node(this.clone().polygons);
//         let b = new Node(csg.clone().polygons);
//         a.invert();
//         b.clipTo(a);
//         b.invert();
//         a.clipTo(b);
//         b.clipTo(a);
//         a.build(b.allPolygons());
//         a.invert();
//         return CSG.fromPolygons(a.allPolygons());
//     }

//     // Return a new CSG solid with solid and empty space switched. This solid is
//     // not modified.
//     inverse() {
//         let csg = this.clone();
//         csg.polygons.forEach(p => p.flip());
//         return csg;
//     }

//     reducePolygons(boundingBox) {
//         let newPolyArr = [];
//         let usedPoly = {};
//         for (let i = 0; i < this.polygons.length; i++) {
//             if (usedPoly[i] && usedPoly[i] === true) {
//                 continue;
//             }
//             usedPoly[i] = false;
//             let triangle = new Triangle(this.polygons[i].vertices[0].pos, this.polygons[i].vertices[1].pos, this.polygons[i].vertices[2].pos);
//             // if (!Array.isArray(boundingBox)) {
//             if (boundingBox.intersectsTriangle(triangle)) {
//                 newPolyArr.push(this.polygons[i]);
//             }
//             else {
//                 this.leftOverPolygons.push(this.polygons[i]);
//             }
//             // }
//             // else {
//             //     for (let j = 0; j < boundingBox.length; j++) {
//             //         if (boundingBox[j].intersectsTriangle(triangle)) {
//             //             newPolyArr.push(this.polygons[i]);
//             //             usedPoly[i] = true;
//             //             break;
//             //         }
//             //     }
//             //     if (usedPoly[i] === false) {
//             //         this.leftOverPolygons.push(this.polygons[i]);
//             //     }
//             // }
//         }
//         this.polygons = newPolyArr.slice();
//     }
// }

// // Construct a CSG solid from a list of `Polygon` instances.
// CSG.fromPolygons = function (polygons) {
//     let csg = new CSG();
//     csg.polygons = polygons;
//     return csg;
// }

// CSG.checkBounds = false;

//Temporaries used to avoid internal allocation..


// # class Vertex

// Represents a vertex of a polygon. Use your own vertex class instead of this
// one to provide additional features like texture coordinates and vertex
// colors. Custom vertex classes need to provide a `pos` property and `clone()`,
// `flip()`, and `interpolate()` methods that behave analogous to the ones
// defined by `CSG.Vertex`. This class provides `normal` so convenience
// functions like `CSG.sphere()` can return a smooth vertex normal, but `normal`
// is not used anywhere else.
class Vertex {

    constructor(pos, normal, uv, color) {
        this.pos = new Vector3().copy(pos);
        this.normal = new Vector3().copy(normal);
        uv && (this.uv = new Vector2().copy(uv));
        color && (this.color = new Vector3().copy(color));
    }

    clone() {
        return new Vertex(this.pos.clone(), this.normal.clone(), this.uv && this.uv.clone(), this.color && this.color.clone());
    }

    // Invert all orientation-specific data (e.g. vertex normal). Called when the
    // orientation of a polygon is flipped.
    flip() {
        this.normal.negate();
    }
    delete() {
        this.pos = undefined;
        this.normal = undefined;
        this.uv && (this.uv = undefined);
        this.color && (this.color = undefined);
    }
    // Create a new vertex between this vertex and `other` by linearly
    // interpolating all properties using a parameter of `t`. Subclasses should
    // override this to interpolate additional properties.
    interpolate(other, t) {
        return new Vertex(this.pos.clone().lerp(other.pos, t), this.normal.clone().lerp(other.normal, t), this.uv && other.uv && this.uv.clone().lerp(other.uv, t), this.color && other.color && this.color.clone().lerp(other.color, t));
    }
}

// # class Plane

// Represents a plane in 3D space.

class Plane {
    constructor(normal, w) {
        this.normal = normal;
        this.w = w;
    }

    clone() {
        return new Plane(this.normal.clone(), this.w);
    }

    flip() {
        this.normal.negate();
        this.w = -this.w;
    }
    delete() {
        this.normal = undefined;
        this.w = undefined;
    }

    // Split `polygon` by this plane if needed, then put the polygon or polygon
    // fragments in the appropriate lists. Coplanar polygons go into either
    // `coplanarFront` or `coplanarBack` depending on their orientation with
    // respect to this plane. Polygons in front or in back of this plane go into
    // either `front` or `back`.
    splitPolygon(polygon, coplanarFront, coplanarBack, front, back) {
        const COPLANAR = 0;
        const FRONT = 1;
        const BACK = 2;
        const SPANNING = 3;

        // Classify each point as well as the entire polygon into one of the above
        // four classes.
        let polygonType = 0;
        let types = [];
        for (let i = 0; i < polygon.vertices.length; i++) {
            let t = this.normal.dot(polygon.vertices[i].pos) - this.w;
            let type = (t < -Plane.EPSILON) ? BACK : (t > Plane.EPSILON) ? FRONT : COPLANAR;
            polygonType |= type;
            types.push(type);
        }
        // console.log(`Polygon ID ${polygon.id} type: ${polygonType}`);
        // Put the polygon in the correct list, splitting it when necessary.
        let polygonReplaced = false;
        let newPolygons = [];
        switch (polygonType) {
            case COPLANAR:
                (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
                break;
            case FRONT:
                front.push(polygon);
                break;
            case BACK:
                back.push(polygon);
                break;
            case SPANNING:
                // console.log(`Polygon ID ${polygon.id} SPANNING`);
                let f = []
                    , b = [];
                for (let i = 0; i < polygon.vertices.length; i++) {
                    let j = (i + 1) % polygon.vertices.length;
                    let ti = types[i]
                        , tj = types[j];
                    let vi = polygon.vertices[i]
                        , vj = polygon.vertices[j];
                    if (ti != BACK)
                        f.push(vi);
                    if (ti != FRONT)
                        b.push(ti != BACK ? vi.clone() : vi);
                    if ((ti | tj) == SPANNING) {
                        let t = (this.w - this.normal.dot(vi.pos)) / this.normal.dot(tv0.copy(vj.pos).sub(vi.pos));
                        let v = vi.interpolate(vj, t);
                        f.push(v);
                        b.push(v.clone());
                    }
                }
                if (f.length >= 3) {
                    if (f.length > 3) {
                        let newPolys = this.split(f);
                        for (let npI = 0; npI < newPolys.length; npI++) {
                            // let newPolygon = new Polygon(newPolys[npI], polygon.shared);
                            // front.push(newPolygon);
                            // newPolygons.push(newPolygon);
                            // polygonReplaced = true;
                            front.push(new Polygon(newPolys[npI], polygon.shared));
                        }
                    }
                    else {
                        // let newPolygon = new Polygon(f, polygon.shared);
                        // front.push(newPolygon);
                        // newPolygons.push(newPolygon);
                        // polygonReplaced = true;
                        front.push(new Polygon(f, polygon.shared));
                    }
                }
                if (b.length >= 3) {
                    if (b.length > 3) {
                        let newPolys = this.split(b);
                        for (let npI = 0; npI < newPolys.length; npI++) {
                            // let newPolygon = new Polygon(newPolys[npI], polygon.shared);
                            // back.push(newPolygon);
                            // newPolygons.push(newPolygon);
                            // polygonReplaced = true;
                            back.push(new Polygon(newPolys[npI], polygon.shared));
                        }
                    }
                    else {
                        // let newPolygon = new Polygon(b, polygon.shared);
                        // back.push(newPolygon);
                        // newPolygons.push(newPolygon);
                        // polygonReplaced = true;
                        back.push(new Polygon(b, polygon.shared));
                    }
                }
                break;
        }

        // if (polygonReplaced) {
        //     console.log("replaced");
        //     let polygonOctrees = polygonMaps.get(polygon).slice() || [];
        //     // let newOctrees = [];
        //     for (let i = 0; i < polygonOctrees.length; i++) {
        //         console.log("replacing polygon in octree ", polygonOctrees[i]);
        //         let polyIndex = polygonOctrees[i].polygons.indexOf(polygon);
        //         if (polyIndex > -1) {
        //             polygonOctrees[i].polygons.splice(polyIndex, 1);
        //             for (let j = 0; j < newPolygons.length; j++) {
        //                 polygonOctrees[i].polygons.push(newPolygons[j]);
        //                 OctreeCSG.addPolygonToMap(polygonOctrees[i].polygonMap, newPolygons[j], polygonOctrees[i])
        //             }
        //             // newOctrees.push(polygonOctrees[i]);

        //         }
        //         // polygonOctrees[i].
        //     }
        //     polygonMaps.delete(polygon);
        //     polygon.valid = false;
        //     // polygon.delete();
        // }
    }
    split(arr) {
        let resultArr = [];
        for (let j = 3; j <= arr.length; j++) {
            let result = [];
            result.push(arr[0].clone());
            result.push(arr[j - 2].clone());
            result.push(arr[j - 1].clone());
            resultArr.push(result);
        }
        return resultArr;
    }
    equals(p) {
        if (this.normal.equals(p.normal) && this.w === p.w) {
            return true;
        }
        return false;
    }

}

// `Plane.EPSILON` is the tolerance used by `splitPolygon()` to decide if a
// point is on the plane.
Plane.EPSILON = 1e-5;

Plane.fromPoints = function (a, b, c) {
    let n = tv0.copy(b).sub(a).cross(tv1.copy(c).sub(a)).normalize().clone();
    return new Plane(n, n.dot(a));
}


// # class Polygon

// Represents a convex polygon. The vertices used to initialize a polygon must
// be coplanar and form a convex loop. They do not have to be `Vertex`
// instances but they must behave similarly (duck typing can be used for
// customization).
// 
// Each convex polygon has a `shared` property, which is shared between all
// polygons that are clones of each other or were split from the same polygon.
// This can be used to define per-polygon properties (such as surface color).

class Polygon {
    constructor(vertices, shared) {
        this.vertices = vertices.map(v=>v.clone());
        this.shared = shared;
        this.plane = Plane.fromPoints(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        // this.plane = Plane.fromPoints(vertices[0], vertices[1], vertices[2]);
        this.triangle = new Triangle(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        this.box = new Box3();
        this.box.expandByPoint(this.triangle.a);
        this.box.expandByPoint(this.triangle.b);
        this.box.expandByPoint(this.triangle.c);
        this.box.expandByScalar(EPSILON);
        this.source = "new";
        this.intersects = false;
        this.state = "undecided";
        this.previousState = "undecided";
        this.previousStates = [];
        this.valid = true;
        Object.defineProperty(this, 'id', {
            value: _polygonID++
        });
    }
    reset() {
        this.intersects = false;
        this.state = "undecided";
        this.previousState = "undecided";
        this.previousStates.length = 0;
        this.valid = true;
    }
    setState(state, keepState) {
        if (this.state === keepState) {
            return;
        }
        this.previousState = this.state;
        this.state !== "undecided" && this.previousStates.push(this.state);
        this.state = state;
    }
    checkAllStates(state) {
        if ((this.state !== state) || ((this.previousState !== state) && (this.previousState !== "undecided"))) {
        // if ( || ) {
            return false;
        }
        for (let i = 0; i < this.previousStates.length; i++) {
            if (this.previousStates[i] !== state) {
                return false;
            }
        }
        return true;
    }
    setInvalid() {
        this.valid = false;
    }
    setValid() {
        this.valid = true;
    }
    clone() {
        return new Polygon(this.vertices.map(v => v.clone()), this.shared);
    }
    flip() {
        this.vertices.reverse().forEach(v => v.flip());
        this.plane.flip();
    }
    delete() {
        this.vertices.forEach(v => v.delete());
        this.vertices.length = 0;
        // this.plane.delete();
        this.plane = undefined;
        this.triangle = undefined;
        this.shared = undefined;
        this.valid = false;
    }
}

// # class Node

// Holds a node in a BSP tree. A BSP tree is built from a collection of polygons
// by picking a polygon to split along. That polygon (and all other coplanar
// polygons) are added directly to that node and the other polygons are added to
// the front and/or back subtrees. This is not a leafy BSP tree since there is
// no distinction between internal and leaf nodes.

class Node {
    constructor(polygons) {
        this.isNode = true;
        this.plane = null;
        this.front = null;
        this.back = null;
        this.polygons = [];
        if (polygons)
            this.build(polygons);
    }
    clone() {
        let node = new Node();
        node.plane = this.plane && this.plane.clone();
        node.front = this.front && this.front.clone();
        node.back = this.back && this.back.clone();
        node.polygons = this.polygons.map(p => p.clone());
        return node;
    }
    // delete() {
    //     if (this.plane) {
    //         this.plane.delete();
    //         this.plane = undefined;
    //     }
    //     if (this.polygons.length > 0) {
    //         this.polygons.forEach(p => p.delete());
    //         this.polygons.length = 0;
    //     }
    //     if (this.front) {
    //         this.front.delete();
    //         this.front = undefined;
    //     }
    //     if (this.back) {
    //         this.back.delete();
    //         this.back = undefined;
    //     }
    // }

    // Convert solid space to empty space and empty space to solid space.
    invert() {
        for (let i = 0; i < this.polygons.length; i++)
            this.polygons[i].flip();

        this.plane && this.plane.flip();
        this.front && this.front.invert();
        this.back && this.back.invert();
        let temp = this.front;
        this.front = this.back;
        this.back = temp;
    }

    // Recursively remove all polygons in `polygons` that are inside this BSP
    // tree.
    clipPolygons(polygons) {
        if (!this.plane)
            return polygons.slice();
        let front = []
            , back = [];
        for (let i = 0; i < polygons.length; i++) {
            this.plane.splitPolygon(polygons[i], front, back, front, back);
        }
        if (this.front)
            front = this.front.clipPolygons(front);
        if (this.back)
            back = this.back.clipPolygons(back);
        else {
            // for (let i = 0; i < back.length; i++) {
            //     let polygon = back[i];
            //     let polygonOctrees = polygonMaps.get(polygon).slice() || [];
            //     // let newOctrees = [];
            //     for (let i = 0; i < polygonOctrees.length; i++) {
            //         console.log("deleting polygon in octree ", polygonOctrees[i]);
            //         let polyIndex = polygonOctrees[i].polygons.indexOf(polygon);
            //         if (polyIndex > -1) {
            //             polygonOctrees[i].polygons.splice(polyIndex, 1);
            //             // for (let j = 0; j < newPolygons.length; j++) {
            //             //     polygonOctrees[i].polygons.push(newPolygons[j]);
            //             //     OctreeCSG.addPolygonToMap(polygonOctrees[i].polygonMap, newPolygons[j], polygonOctrees[i])
            //             // }
            //             // newOctrees.push(polygonOctrees[i]);

            //         }
            //         // polygonOctrees[i].
            //     }
            //     polygonMaps.delete(polygon);
            //     polygon.valid = false;

            //     // polygonOctrees[i].polygons.splice(polyIndex, 1);
            // }
            back = [];
        }
        //return front;
        return front.concat(back);
    }

    // Remove all polygons in this BSP tree that are inside the other BSP tree
    // `bsp`.
    clipTo(bsp) {
        this.polygons = bsp.clipPolygons(this.polygons);
        if (this.front)
            this.front.clipTo(bsp);
        if (this.back)
            this.back.clipTo(bsp);
    }

    // Return a list of all polygons in this BSP tree.
    allPolygons() {
        let polygons = this.polygons.slice();
        if (this.front)
            polygons = polygons.concat(this.front.allPolygons());
        if (this.back)
            polygons = polygons.concat(this.back.allPolygons());
        return polygons;
    }

    // Build a BSP tree out of `polygons`. When called on an existing tree, the
    // new polygons are filtered down to the bottom of the tree and become new
    // nodes there. Each set of polygons is partitioned using the first polygon
    // (no heuristic is used to pick a good split).
    build(polygons, parent) {
        if (!polygons.length)
            return;
        this.polygons.push(polygons[0]);
        if (!this.plane)
            this.plane = polygons[0].plane.clone();
        let front = []
            , back = [];
        for (let i = 1; i < polygons.length; i++) {
            this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
        }
        if (front.length) {
            if (!this.front)
                this.front = new Node();

            if ((polygons.length === front.length) && (back.length === 0)) {
                this.frontArr = front;
                if (parent && parent.frontArr) {
                    if (this.polygonArrRepeating(parent.frontArr, front)) {
                        this.front.polygons = front;
                        console.error("Front polygons looping during node build, stopping to prevent recursion errors");
                    }
                    else {
                        this.front.build(front, this);
                    }
                }
                else {
                    this.front.build(front, this);
                }

            }
            else {
                this.front.build(front);
            }
        }
        if (back.length) {
            if (!this.back)
                this.back = new Node();

            if ((polygons.length === back.length) && (front.length === 0)) {
                this.backArr = back;
                if (parent && parent.backArr) {
                    if (this.polygonArrRepeating(parent.backArr, back)) {
                        this.back.polygons = back;
                        console.error("Back polygons looping during node build, stopping to prevent recursion errors");
                    }
                    else {
                        this.back.build(back, this);
                    }
                }
                else {
                    this.back.build(back, this);
                }

            }
            else {
                this.back.build(back);
            }
        }
    }

    polygonArrRepeating(parentPolygons, polygons) {
        if (polygons.length !== parentPolygons.length) {
            return false;
        }
        let repeating = false;
        for (let i = 0; i < polygons.length; i++) {
            if (polygons[i].vertices.length !== parentPolygons[i].vertices.length) {
                return false;
            }
            if (!polygons[i].plane.equals(parentPolygons[i].plane)) {
                return false;
            }
            for (let j = 0; j < polygons[i].vertices.length; j++) {
                let childVertex = polygons[i].vertices[j];
                let parentVertex = parentPolygons[i].vertices[j];
                if (!childVertex.pos.equals(parentVertex.pos) || !childVertex.normal.equals(parentVertex.normal)) {
                    return false;
                }
                if (childVertex.uv && parentVertex.uv) {
                    if (childVertex.uv.equals(parentVertex.uv)) {
                        repeating = true;
                    }
                    else {
                        return false;
                    }
                }
                else {
                    repeating = true;
                }
            }
        }

        return repeating;

    }
}

OctreeCSG.Polygon = Polygon;
export default OctreeCSG;