import { Vector2, Vector3, Box3, BackSide, DoubleSide, FrontSide, Matrix3, Matrix4, Ray, Triangle, BufferGeometry, BufferAttribute, Mesh, Raycaster } from 'three';
import { triangleIntersectsTriangle, checkTrianglesIntersection } from './three-triangle-intersection.js';

const _v1 = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();

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
//const polygonMaps = new Map();

class OctreeCSG {
    constructor(box, parent) {
this.octreeMap = new Map();
        this.isOctree = true;
        // this.triangles = [];
        this.polygons = [];
        this.polygonMap;
        // this.bspNode;
        this.box = box;
        this.subTrees = [];
        this.parent = parent;
        this.level = 0;
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
        if (!this.bounds) {
            this.bounds = new Box3();
        }
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
        for (let x = 0; x < 2; x++) {
            for (let y = 0; y < 2; y++) {
                for (let z = 0; z < 2; z++) {
                    const box = new Box3();
                    const v = _v1.set(x, y, z);

                    box.min.copy(this.box.min).add(v.multiply(halfsize));
                    box.max.copy(box.min).add(halfsize);
                    box.expandByScalar(EPSILON);
                    subTrees.push(new OctreeCSG(box, this));
                }
            }
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
    processTree() {
        this.octreeMap.set(this.id, this);
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

                // if (this.polygons[i].source === "a") {
                //     this.aPolygons.push(this.polygons[i]);
                // }
                // else if (this.polygons[i].source === "b") {
                //     this.bPolygons.push(this.polygons[i]);
                // }
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

    // Not used
    // getRayTriangles(ray, triangles) {
    //     // console.log("triangles:", triangles);
    //     for (let i = 0; i < this.subTrees.length; i++) {

    //         const subTree = this.subTrees[i];
    //         if (!ray.intersectsBox(subTree.box)) {
    //             // console.log(i, "ray not intersecting", subTree.box);
    //             continue;
    //         }
    //         // console.log(i, "poly count:", subTree.polygons.length);
    //         // if (subTree.triangles.length > 0) {
    //         if (subTree.polygons.length > 0) {
    //             // for (let j = 0; j < subTree.triangles.length; j++) {
    //             for (let j = 0; j < subTree.polygons.length; j++) {

    //                 // if (triangles.indexOf(subTree.triangles[j]) === - 1) triangles.push(subTree.triangles[j]);
    //                 if (triangles.indexOf(subTree.polygons[j].triangle) === - 1) {
    //                     // console.log("adding triangle", subTree.polygons[j].triangle);
    //                     triangles.push(subTree.polygons[j].triangle);
    //                 }
    //                 // else {
    //                 //     console.log("skipping triangle", subTree.polygons[j].triangle, "all triangles:", triangles);
    //                 // }

    //             }

    //         } else {

    //             subTree.getRayTriangles(ray, triangles);

    //         }

    //     }

    //     return triangles;

    // }


    // Not used
    // increaseTriangleSize(triangle, targetTriangle = new Triangle()) {
    //     let EPSILON = 0;
    //     targetTriangle.copy(triangle);
    //     targetTriangle.a.x += triangle.a.x < 0 ? -EPSILON : EPSILON;
    //     targetTriangle.a.y += triangle.a.y < 0 ? -EPSILON : EPSILON;
    //     targetTriangle.a.z += triangle.a.z < 0 ? -EPSILON : EPSILON;
    //     targetTriangle.b.x += triangle.b.x < 0 ? -EPSILON : EPSILON;
    //     targetTriangle.b.y += triangle.b.y < 0 ? -EPSILON : EPSILON;
    //     targetTriangle.b.z += triangle.b.z < 0 ? -EPSILON : EPSILON;
    //     targetTriangle.c.x += triangle.c.x < 0 ? -EPSILON : EPSILON;
    //     targetTriangle.c.y += triangle.c.y < 0 ? -EPSILON : EPSILON;
    //     targetTriangle.c.z += triangle.c.z < 0 ? -EPSILON : EPSILON;
    //     return targetTriangle;
    // }
    getPolygonsIntersectingPolygon(targetPolygon, debug = false, polygons = []) {
        if (this.polygons.length > 0) {
            if (targetPolygon.triangle === undefined) {
                console.log("UNDEFINED", targetPolygon);
            }
            // let targetTriangle = this.increaseTriangleSize(targetPolygon.triangle);
            let targetTriangle = targetPolygon.triangle;
            if (this.box.intersectsTriangle(targetTriangle)) {
                for (let i = 0; i < this.polygons.length; i++) {
                    let polygon = this.polygons[i];
                    // }
                    // this.polygons.forEach(polygon => {
                    if (!polygon.valid || !polygon.intersects) {
                        continue;
                    }
                    if (debug) {
                        // if (((polygon.triangle.a.z == 5) || (polygon.triangle.b.z == 5) || (polygon.triangle.c.z == 5)) && ((polygon.triangle.a.x >= 1) || (polygon.triangle.b.x >= 1) || (polygon.triangle.c.x >= 1))) {
                        let additionsObj = {
                            coplanar: false,
                            source: new Vector3(),
                            target: new Vector3()
                        };
                        console.log("Testing intersection with polygon:", targetPolygon.id, targetPolygon, polygon, polygon.triangle);
                        if ((targetTriangle === undefined) || (polygon.triangle === undefined)) {
                            console.log("UNDEFINED!!!!!", targetPolygon, polygon);
                        }
                        // if (triangleIntersectsTriangle(targetTriangle, polygon.triangle, additionsObj)) {
                        if (checkTrianglesIntersection(targetTriangle, polygon.triangle, additionsObj)) {
                            console.log("intersects", additionsObj.triangleCheck, additionsObj);
                            polygons.push(polygon);
                        }
                        else {
                            console.log("nope", additionsObj.triangleCheck);
                        }
                        
                    }
                    else {
                        if ((targetTriangle === undefined) || (polygon.triangle === undefined)) {
                            console.log("UNDEFINED!!!!!", targetPolygon, polygon);
                        }
                        // if (triangleIntersectsTriangle(targetTriangle, polygon.triangle)) {
                        if (checkTrianglesIntersection(targetTriangle, polygon.triangle)) {
                            polygons.push(polygon);
                        }
                        
                    }
                };
            }
        }

        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getPolygonsIntersectingPolygon(targetPolygon, debug, polygons);
        }

        return polygons;
    }

    getPolygonsIntersectingBox(box, polygons = []) {
        if (this.polygons.length > 0) {
            // if (targetPolygon.triangle === undefined) {
            //     console.log("UNDEFINED", targetPolygon);
            // }
            if (this.box.intersectsBox(box)) {
                for (let j = 0; j < this.polygons.length; j++) {
                    let polygon = this.polygons[j];
                    // if (polygon.box.intersectsBox(box)) {
                    if (box.intersectsTriangle(polygon.triangle)) {
                        polygons.push(polygon);
                    }
                }
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            // if (!this.subTrees[i].box.intersectsBox(box)) {
            //     continue;
            // }
            this.subTrees[i].getPolygonsIntersectingBox(box, polygons);
        }

        return polygons;
    }
    // Not used
    // getRayPolygons(ray, polygons) {
    //     // console.log("triangles:", triangles);
    //     for (let i = 0; i < this.subTrees.length; i++) {
    //         const subTree = this.subTrees[i];
    //         // if (!ray.intersectsBox(subTree.box)) {
    //         if (!subTree.box.containsPoint(ray.origin)) {
    //             // console.log(i, "ray not intersecting", subTree.box);
    //             continue;
    //         }
    //         // console.log(i, "poly count:", subTree.polygons.length);
    //         // if (subTree.triangles.length > 0) {
    //         if (subTree.polygons.length > 0) {
    //             // for (let j = 0; j < subTree.triangles.length; j++) {
    //             for (let j = 0; j < subTree.polygons.length; j++) {

    //                 // if (triangles.indexOf(subTree.triangles[j]) === - 1) triangles.push(subTree.triangles[j]);
    //                 if (polygons.indexOf(subTree.polygons[j]) === - 1) {
    //                     // console.log("adding triangle", subTree.polygons[j].triangle);
    //                     polygons.push(subTree.polygons[j]);
    //                 }
    //                 // else {
    //                 //     console.log("skipping triangle", subTree.polygons[j].triangle, "all triangles:", triangles);
    //                 // }

    //             }

    //         } else {

    //             subTree.getRayPolygons(ray, polygons);

    //         }

    //     }

    //     return polygons;

    // }

    // Not used
    // rayIntersect(ray, intersects = []) {

    //     if (ray.direction.length() === 0) return;

    //     const polygons = [];
    //     let polygon, position, distance = 1e100;

    //     // this.getRayTriangles(ray, triangles);
    //     this.getRayPolygons(ray, polygons);
    //     // console.log("polygons", polygons);
    //     for (let i = 0; i < polygons.length; i++) {

    //         // if (material.side === BackSide) {
    //         //     intersect = ray.intersectTriangle(pC, pB, pA, true, point);
    //         // } else {
    //         //     intersect = ray.intersectTriangle(pA, pB, pC, material.side !== DoubleSide, point);
    //         // }
    //         let result;
    //         // ray.direction = polygons[i].vertices[0].normal;

    //         if (OctreeCSG.testSide == BackSide) { // backside
    //             // console.log("ray testing back");
    //             result = ray.intersectTriangle(polygons[i].triangle.c, polygons[i].triangle.b, polygons[i].triangle.a, true, _v1);
    //         }
    //         else if (OctreeCSG.testSide == DoubleSide) { // doubleside
    //             // console.log("ray testing double");
    //             // console.log("OctreeCSG.testSide !== DoubleSide", OctreeCSG.testSide !== DoubleSide, OctreeCSG.testSide);
    //             result = ray.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, false, _v1);
    //         }
    //         else if (OctreeCSG.testSide == FrontSide) { // frontside
    //             // console.log("ray testing front");
    //             // console.log("OctreeCSG.testSide !== DoubleSide", OctreeCSG.testSide !== DoubleSide, OctreeCSG.testSide);
    //             result = ray.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, true, _v1);
    //         }
    //         // result = ray.intersectTriangle(triangles[i].a, triangles[i].b, triangles[i].c, false, _v1);

    //         // const result = ray.intersectTriangle(triangles[i].a, triangles[i].b, triangles[i].c, true, _v1);
    //         // console.log(i, result);
    //         if (result) {

    //             const newdistance = result.sub(ray.origin).length();

    //             if (distance > newdistance) {

    //                 position = result.clone().add(ray.origin);
    //                 distance = newdistance;
    //                 polygon = polygons[i];

    //             }
    //             if (distance < 1e100) {
    //                 intersects.push({ distance: newdistance, polygon: polygons[i], position: result.clone().add(ray.origin) });
    //             }
    //             else {
    //                 console.log("BIG DISTANCE:", { distance: distance, polygon: polygon, position: position });
    //             }

    //         }
    //         // else {
    //         //     console.log(i, "nope", result);
    //         // }

    //     }
    //     // intersectObject(object, recursive = true, intersects = []) {
    //     // 	intersectObject(object, this, intersects, recursive);
    //     // 	intersects.sort(ascSort);
    //     // 	return intersects;
    //     // }
    //     intersects.length && intersects.sort(raycastIntersectAscSort);
    //     return intersects;
    //     // return distance < 1e100 ? { distance: distance, triangle: triangle, position: position } : false;

    // }
    // Not used
    // raycastIntersect(raycaster, matrixWorld, intersects = []) {
    //     if (raycaster.ray.direction.length() === 0) return;
    //     let _inverseMatrix = (new Matrix4()).copy(matrixWorld).invert();
    //     let ray2 = (new Ray()).copy(raycaster.ray).applyMatrix4(_inverseMatrix);
    //     console.log("ray?", raycaster.ray.clone(), ray2.clone());
    //     // let ray2 = raycaster.ray;
    //     // Check boundingBox before continuing
    //     const polygons = [];
    //     let polygon, position, distance = 1e100;

    //     // this.getRayTriangles(ray, triangles);
    //     this.getRayPolygons(ray2, polygons);

    //     for (let i = 0; i < polygons.length; i++) {

    //         // if (material.side === BackSide) {
    //         //     intersect = ray.intersectTriangle(pC, pB, pA, true, point);
    //         // } else {
    //         //     intersect = ray.intersectTriangle(pA, pB, pC, material.side !== DoubleSide, point);
    //         // }
    //         let result;
    //         // ray2.direction = polygons[i].vertices[0].normal.clone();
    //         // ray2.direction.transformDirection(_inverseMatrix);
    //         // console.log("ray direction:", ray2.direction.clone());

    //         if (OctreeCSG.testSide == BackSide) { // backside
    //             // console.log("ray testing back");
    //             result = ray2.intersectTriangle(polygons[i].triangle.c, polygons[i].triangle.b, polygons[i].triangle.a, true, _v1);
    //         }
    //         else if (OctreeCSG.testSide == DoubleSide) { // doubleside
    //             // console.log("ray testing double");
    //             // console.log("OctreeCSG.testSide !== DoubleSide", OctreeCSG.testSide !== DoubleSide, OctreeCSG.testSide);
    //             result = ray2.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, false, _v1);
    //         }
    //         else if (OctreeCSG.testSide == FrontSide) { // frontside
    //             // console.log("ray testing front");
    //             // console.log("OctreeCSG.testSide !== DoubleSide", OctreeCSG.testSide !== DoubleSide, OctreeCSG.testSide);
    //             result = ray2.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, true, _v1);
    //         }
    //         else {
    //             return [];
    //         }
    //         if (result === null) {
    //             continue;
    //         }
    //         let _intersectionPointWorld = new Vector3();
    //         _intersectionPointWorld.copy(_v1);
    //         _intersectionPointWorld.applyMatrix4(matrixWorld);
    //         // console.log(i, "_intersectionPointWorld", _intersectionPointWorld, _v1, result)
    //         // if (result) {
    //         let newdistance = raycaster.ray.origin.distanceTo(_intersectionPointWorld);
    //         // const newdistance = result.sub(ray2.origin).length();
    //         if (newdistance < raycaster.near || newdistance > raycaster.far) {
    //             // return null;
    //             console.log(i, "skipping:", newdistance);
    //             continue;
    //         }
    //         // let ddtm = raycaster.ray.direction.dot(polygons[i].plane.normal);
    //         // if (ddtm <= 0) {
    //         //     console.log("Point is outside the object", ddtm);
    //         //     continue;
    //         // }
    //         // if (ddtm > 0) {
    //         //     console.log("Point is inside the object", ddtm);
    //         // }
    //         // else {
    //         //     console.log("Point is outside the object", ddtm);
    //         // }
    //         // return {
    //         //     distance: distance,
    //         //     point: _intersectionPointWorld.clone(),
    //         //     object: object
    //         // };
    //         let intersectObj = { distance: newdistance, polygon: polygons[i], position: _intersectionPointWorld.clone() };
    //         intersects.push(intersectObj);
    //         // result = ray.intersectTriangle(triangles[i].a, triangles[i].b, triangles[i].c, false, _v1);

    //         // const result = ray.intersectTriangle(triangles[i].a, triangles[i].b, triangles[i].c, true, _v1);
    //         console.log(i, "result:", intersectObj);
    //         // if (result) {

    //         //     const newdistance = result.sub(ray.origin).length();

    //         //     if (distance > newdistance) {

    //         //         position = result.clone().add(ray.origin);
    //         //         distance = newdistance;
    //         //         polygon = polygons[i];

    //         //     }
    //         //     if (distance < 1e100) {
    //         //         intersects.push({ distance: newdistance, polygon: polygons[i], position: result.clone().add(ray.origin) });
    //         //     }
    //         //     else {
    //         //         console.log("BIG DISTANCE:", { distance: distance, polygon: polygon, position: position });
    //         //     }

    //         // }
    //         // else {
    //         //     console.log(i, "nope", result);
    //         // }

    //     }
    //     // intersectObject(object, recursive = true, intersects = []) {
    //     // 	intersectObject(object, this, intersects, recursive);
    //     // 	intersects.sort(ascSort);
    //     // 	return intersects;
    //     // }
    //     intersects.length && intersects.sort(raycastIntersectAscSort);
    //     return intersects;
    //     // return distance < 1e100 ? { distance: distance, triangle: triangle, position: position } : false;

    // }

    // Not used
    // getTriangles(triangles = []) {

    //     // if (this.bspNode) {
    //     //     let nodePolys = this.bspNode.allPolygons();
    //     //     // triangles.push(...nodePolys.filter(p => p.valid));
    //     //     for (let i = 0; i < nodePolys.length; i++) {
    //     //         if (nodePolys[i].valid) {
    //     //             triangles.push(nodePolys[i].triangle);
    //     //         }
    //     //     }
    //     // }
    //     for (let i = 0; i < this.polygons.length; i++) {
    //         if (this.polygons[i].valid) {
    //             triangles.push(this.polygons[i].triangle);
    //         }
    //         // else {
    //         //     console.log(i, "polygon invalid", this.polygons[i]);
    //         // }
    //     }

    //     // if (this.front)
    //     //     polygons = polygons.concat(this.front.allPolygons());
    //     // if (this.back)
    //     //     polygons = polygons.concat(this.back.allPolygons());
    //     // // console.log(this.nodeNum, "polygons", polygons.length);

    //     for (let i = 0; i < this.subTrees.length; i++) {
    //         this.subTrees[i].getTriangles(triangles);
    //     }
    //     return triangles;
    // }
    getIntersectingPolygons(polygons = []) {
        // let polygons = this.polygons.slice();
        // let polygons = [];
        // if (this.bspNode) {
        //     polygons.push(...this.bspNode.allPolygons());
        // }
        // else {
        // polygons.push(...this.polygons);
        for (let i = 0; i < this.polygons.length; i++) {
            if (this.polygons[i].valid && this.polygons[i].intersects) {
                polygons.push(this.polygons[i]);
            }
        }
        // }
        // if (this.front)
        //     polygons = polygons.concat(this.front.allPolygons());
        // if (this.back)
        //     polygons = polygons.concat(this.back.allPolygons());
        // // console.log(this.nodeNum, "polygons", polygons.length);

        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getIntersectingPolygons(polygons);
        }
        return polygons;
    }
    getPolygons(polygons = []) {
        // let polygons = this.polygons.slice();
        // let polygons = [];
        // if (this.bspNode) {
        //     polygons.push(...this.bspNode.allPolygons());
        // }
        // else {
        // polygons.push(...this.polygons);
        for (let i = 0; i < this.polygons.length; i++) {
            if (this.polygons[i].valid) {
                polygons.push(this.polygons[i]);
            }
        }
        // }
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
    // clipPolygons(polygons) {
    //     let newPolys = [];
    //     if (this.bspNode) {
    //         newPolys.push(...this.bspNode.clipPolygons(polygons));
    //     }

    //     for (let i = 0; i < this.subTrees.length; i++) {
    //         newPolys.push(...this.subTrees[i].clipPolygons(polygons));
    //     }
    //     return newPolys;
    // }

    invert() {
        // if (this.bspNode) {
        //     this.bspNode.invert();
        // }
        // else {
        this.polygons.forEach(p => p.flip());
        // }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].invert();
        }
    }
    // clipTo(bsp) {
    //     if (this.bspNode) {
    //         this.bspNode.clipTo(bsp);
    //     }

    //     for (let i = 0; i < this.subTrees.length; i++) {
    //         this.subTrees[i].clipTo(bsp);
    //     }
    // }

    // getBSP() {
    //     let bspArray = [];
    //     this.bspNode && bspArray.push(this.bspNode);
    //     for (let i = 0; i < this.subTrees.length; i++) {
    //         bspArray.push(...this.subTrees[i].getBSP());
    //     }
    //     return bspArray;
    // }
    // parseBSP() {
    //     if (this.bspNode) {
    //         this.polygons = this.bspNode.allPolygons();
    //     }
    //     for (let i = 0; i < this.subTrees.length; i++) {
    //         this.subTrees[i].parseBSP();
    //     }
    // }

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
    deletePolygonsByState(state = "back", strict = false) {
        if (this.polygons.length > 0) {
            let polygonArr = this.polygons.slice();
            polygonArr.forEach(polygon => {
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
                        // if (state == "coplanar-back") {
                        //     console.log("Deleting", strict, polygon);
                        // }
                        let polygonIndex = this.polygons.indexOf(polygon);
                        if (polygonIndex > -1) {
                            // polygon.setInvalid();
                            this.polygons.splice(polygonIndex, 1);
                            polygon.delete();
                        }
                        else {
                            polygon.setInvalid();
                        }
                        // polygon.delete();
                    }
                }
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].deletePolygonsByState(state, strict);
        }
    }
    deletePolygonsByStates(states = ["back"], strict = false, debug = false) {
        if (this.polygons.length > 0) {
            let polygonArr = this.polygons.slice();
            if (!Array.isArray(states)) {
                states = [states];
            }
            // let aVector = new Vector3(1, -5, 5);
            // let bVector = new Vector3(1, -5, 1);
            // let cVector = new Vector3(5, -5, 5);
            // // console.log("debug?", debug, states);

            polygonArr.forEach(polygon => {
                // states.forEach(state => {
                // if (polygon.thisone) {
                //     console.log("FOUND? 1", polygon)
                //     debug = true;
                // }
                // else {
                //     // console.log("AAAAAAAA", polygon);
                //     debug = false;
                // }
                // debug = true;
                /*
                Check all previous states of the polygon for several states
                * strict:
                    loop over polygons
                    if previous state not one of provided states (not included in states array), break

                */
                if (polygon.valid) {
                    let found = false;
                    let t = polygon.triangle;
                    // if ((t.a.x == 4.267949104309084) && (t.a.y == -5) && (t.a.z == 5) && (t.b.x == 5) && (t.b.y == -5) && (t.b.z == 5) && (t.c.x == 5) && (t.c.y == -4.154700479631228) && (t.c.z == 5)) {
                    //     debug = true;
                    // }
                    if (strict) {
                        if ((states.includes(polygon.state)) && (((polygon.previousState !== "undecided") && (states.includes(polygon.previousState))) || (polygon.previousState == "undecided"))) {
                            debug && console.log("deletePolygonsByStates A");
                            found = true;
                            let foundCounter = 0;
                            let statesObj = {};
                            let mainStatesObj = {};
                            let mainSatisfied = true;
                            states.forEach(state => statesObj[state] = false);
                            states.forEach(state => mainStatesObj[state] = false);
                            // mainStatesObj[polygon.state] = true; // needed?
                            // if (polygon.previousState !== "undecided") {
                            //     mainStatesObj[polygon.previousState] = true;
                            //     for (let state in mainStatesObj) {
                            //         if (mainStatesObj[state] === false) {
                            //             mainSatisfied = false;
                            //             break;
                            //         }
                            //     }
                            // }

                            for (let i = 0; i < polygon.previousStates.length; i++) {
                                // let foundArr = states.map(() => false);                                
                                if (!states.includes(polygon.previousStates[i])) { // if previous state not one of provided states (not included in states array), break
                                    debug && console.log("deletePolygonsByStates B", polygon.previousStates[i]);
                                    found = false;
                                    break;
                                }
                                else {
                                    statesObj[polygon.previousStates[i]] = true;
                                }
                            }
                            debug && console.log("deletePolygonsByStates C");
                            if (found) {
                                debug && console.log("deletePolygonsByStates D");
                                // if (polygon.previousState !== "undecided") { // <- NOT TESTED
                                for (let state in statesObj) {
                                    if (statesObj[state] === false) {
                                        // if (!mainSatisfied) {
                                        debug && console.log("deletePolygonsByStates D2");
                                        found = false;
                                        // }
                                        break;
                                    }
                                }
                                // }


                                if (found) {
                                    debug && console.log("deletePolygonsByStates E");
                                    let polygonIndex = this.polygons.indexOf(polygon);
                                    if (polygonIndex > -1) {
                                        debug && console.log("deletePolygonsByStates F", polygon);
                                        // polygon.setInvalid();
                                        this.polygons.splice(polygonIndex, 1);
                                        polygon.delete();
                                    }
                                    else {
                                        polygon.setInvalid();
                                    }
                                }
                            }
                        }
                        else {
                            debug && console.log("deletePolygonsByStates G");

                        }
                        // let polygonStates = polygon.previousStates.filter(s => ())
                        // if (polygon.checkAllStates(state)) {
                        //     // console.log("Invalidating", polygon);
                        //     polygon.setInvalid();
                        // }
                    }
                    else {
                        found = false;
                        if (states.includes(polygon.state)) {
                            found = true;
                        }
                        else if ((polygon.previousState !== "undecided") && (states.includes(polygon.previousState))) {
                            found = true;
                        }
                        else if (polygon.previousStates.length > 0) {
                            for (let i = 0; i < polygon.previousStates.length; i++) {
                                if (states.includes(polygon.previousStates[i])) {
                                    found = true;
                                    break;
                                }
                            }
                        }


                        // if ((polygon.previousState !== "undecided")) {
                        //     if (states.includes(polygon.previousState)) {

                        //     }
                        // }
                        // else {

                        // }
                    }
                    if (found) {
                        let polygonIndex = this.polygons.indexOf(polygon);
                        if (polygonIndex > -1) {
                            // polygon.setInvalid();
                            this.polygons.splice(polygonIndex, 1);
                            polygon.delete();
                        }
                        else {
                            polygon.setInvalid();
                        }
                    }
                    // else {
                    //     if (polygon.state == state) {
                    //         polygon.setInvalid();
                    //     }
                    // }
                    // if ((strict && polygon.checkAllStates(state)) || (!strict && polygon.state == state)) {
                    //     // console.log("Invalidating", polygon);
                    //     let polygonIndex = this.polygons.indexOf(polygon);
                    //     if (polygonIndex > -1) {
                    //         // polygon.setInvalid();
                    //         this.polygons.splice(polygonIndex, 1);
                    //         polygon.delete();
                    //     }
                    //     else {
                    //         polygon.setInvalid();
                    //     }
                    //     // polygon.delete();
                    // }
                }
                // });
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].deletePolygonsByStates(states, strict, debug);
        }
    }
    deletePolygonsByTwoStates(state, previousState, strict = false) {
        if (this.polygons.length > 0) {
            let polygonArr = this.polygons.slice();
            polygonArr.forEach(polygon => {
                let found = false;
                if (polygon.valid) {
                    if (strict) {
                        if ((state === polygon.state) && (polygon.previousState === previousState)) {
                            found = true;
                            for (let i = 0; i < polygon.previousStates.length; i++) {
                                if (polygon.previousStates[i] !== previousState) {
                                    found = false;
                                    break;
                                }
                            }
                            // if (found) {
                            //     let polygonIndex = this.polygons.indexOf(polygon);
                            //     if (polygonIndex > -1) {
                            //         this.polygons.splice(polygonIndex, 1);
                            //         polygon.delete();
                            //     }
                            //     else {
                            //         polygon.setInvalid();
                            //     }
                            // }
                        }
                    }
                    else {
                        found = false;
                        if ((state === polygon.state) && (((polygon.previousState !== "undecided") && (polygon.previousState === previousState)) || (polygon.previousState == "undecided"))) {
                            found = true;
                        }
                        else if (polygon.previousStates.length > 0) {
                            let states = [state, previousState];
                            for (let i = 0; i < polygon.previousStates.length; i++) {
                                if (states.includes(polygon.previousStates[i])) {
                                    found = true;
                                    break;
                                }
                            }
                        }


                        // if ((polygon.previousState !== "undecided")) {
                        //     if (states.includes(polygon.previousState)) {

                        //     }
                        // }
                        // else {

                        // }
                    }
                    if (found) {
                        // console.log("!!!twoStates found", polygon);
                        let polygonIndex = this.polygons.indexOf(polygon);
                        if (polygonIndex > -1) {
                            // polygon.setInvalid();
                            this.polygons.splice(polygonIndex, 1);
                            polygon.delete();
                        }
                        else {
                            polygon.setInvalid();
                        }
                    }
                }
                // });
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].deletePolygonsByTwoStates(state, previousState, strict);
        }
    }
    deletePolygonsByIntersection(intersects) {
        if (intersects == undefined) {
            return;
        }
        if (this.polygons.length > 0) {
            let polygonArr = this.polygons.slice();
            polygonArr.forEach(polygon => {
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
                    if (polygon.intersects === intersects) {
                        // console.log("Invalidating", polygon);
                        let polygonIndex = this.polygons.indexOf(polygon);
                        if (polygonIndex > -1) {
                            // polygon.setInvalid();
                            this.polygons.splice(polygonIndex, 1);
                            polygon.delete();
                        }
                        else {
                            polygon.setInvalid();
                        }
                        // polygon.delete();
                    }
                }
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].deletePolygonsByIntersection(intersects);
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
    isPolygonIntersecting(polygon) {
        if (!this.box.intersectsTriangle(polygon.triangle)) {
            return false;
        }

        if (this.polygons.length > 0) {
            return true;
        }
        let isIntersecting = false;
        if (this.subTrees.length > 0) {
            for (let i = 0; i < this.subTrees.length; i++) {
                isIntersecting = this.subTrees[i].isPolygonIntersecting(polygon);
                if (isIntersecting) {
                    break;
                }
            }
        }
        return isIntersecting;
    }
    markIntesectingPolygons(targetOctree) {
        if (this.polygons.length > 0) {
            this.polygons.forEach(polygon => {
                // polygon.intersects = boundingBox.intersectsTriangle(polygon.triangle);
                polygon.intersects = targetOctree.isPolygonIntersecting(polygon);
                // polygon.intersects = targetOctree.box.intersectsTriangle(polygon.triangle);
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].markIntesectingPolygons(targetOctree);
        }

    }

    resetPolygonsByState(state) {
        if (this.polygons.length > 0) {
            this.polygons.forEach(polygon => {
                if (polygon.valid && polygon.intersects) {
                    if (polygon.state == state && polygon.previousState == "undecided") {
                        polygon.state = "undecided";
                        polygon.checkAll = true;
                    }
                }
                // polygon.reset();
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].resetPolygonsByState(state);
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
            const polygonStack = this.polygons.filter(polygon => (polygon.valid == true) && (polygon.intersects == true) && (polygon.state == "undecided"));
            let currentPolygon = polygonStack.pop();
            // let iteration = 0;
            while (currentPolygon) {
                // console.log("--------------------");
                if (currentPolygon.state !== "undecided") {
                    continue;
                }
                if (!currentPolygon.valid) {
                    continue;
                }

                let debugPoly = false;
                // a: Zt
                // x: 4.768243432044983
                // y: -1.9031686782836914
                // z: 4.456537246704102
                // [[Prototype]]: Object
                // b: Zt
                // x: 5.096880674362183
                // y: -2.0465810298919678
                // z: 4.471675395965576
                // [[Prototype]]: Object
                // c: Zt
                // x: 5.070781767368317
                // y: -1.722865343093872
                // z: 4.600900650024414
                // if ((OctreeCSG.returnType == -1) && (currentPolygon.triangle.a.x == 5) && (currentPolygon.triangle.a.y == 5) && (currentPolygon.triangle.a.z == -4.422649760184385) && (currentPolygon.triangle.b.x == 5) && (currentPolygon.triangle.b.y == 5) && (currentPolygon.triangle.b.z == -5) && (currentPolygon.triangle.c.x == 3.6339747606535076) && (currentPolygon.triangle.c.y == 5) && (currentPolygon.triangle.c.z == -3.6339747606535076)) {
                //     debugPoly = true;
                // }

                // if ((currentPolygon.triangle.a.x == 11) && (currentPolygon.triangle.a.y == -1) && (currentPolygon.triangle.a.z == 1) && (currentPolygon.triangle.b.x == 11) && (currentPolygon.triangle.b.y == -5) && (currentPolygon.triangle.b.z == 1) && (currentPolygon.triangle.c.x == 5) && (currentPolygon.triangle.c.y == -5) && (currentPolygon.triangle.c.z == 1)) {
                //     debugPoly = true;
                // }
                // if ((currentPolygon.triangle.a.x == 5) && (currentPolygon.triangle.a.y == -5) && (currentPolygon.triangle.a.z == -5) && (currentPolygon.triangle.b.x == 1) && (currentPolygon.triangle.b.y == -5) && (currentPolygon.triangle.b.z == -5) && (currentPolygon.triangle.c.x == 1) && (currentPolygon.triangle.c.y == -1) && (currentPolygon.triangle.c.z == -5)) {
                //     debugPoly = true;
                // }
                // else if ((currentPolygon.triangle.a.x == 1) && (currentPolygon.triangle.a.y == 5) && (currentPolygon.triangle.a.z == -1) && (currentPolygon.triangle.b.x == 5) && (currentPolygon.triangle.b.y == 5) && (currentPolygon.triangle.b.z == -5) && (currentPolygon.triangle.c.x == 1) && (currentPolygon.triangle.c.y == 5) && (currentPolygon.triangle.c.z == -5)) {
                //     debugPoly = true;
                // }

                // let targetPolygons = targetOctree.getPolygonsIntersectingBox(currentPolygon.box);
                let targetPolygons;
                if (currentPolygon.checkAll === true) {
                    targetPolygons = targetOctree.getIntersectingPolygons();
                    // targetPolygons = targetPolygons.filter(p => p.intersects);
                }
                else {
                    targetPolygons = targetOctree.getPolygonsIntersectingPolygon(currentPolygon, debugPoly);
                }


                // console.log(testvar, iteration++, currentPolygon, targetPolygons.length);
                // targetPolygons.length === 0 && console.log("NO TARGETS", currentPolygon);
                if (targetPolygons.length > 0) {
                    if (debugPoly) {
                        console.log("BLA POLYGON TARGET COUNT", targetPolygons.length);
                    }
                    // let needsBreak = false;
                    for (let j = 0; j < targetPolygons.length; j++) {
                        let target = targetPolygons[j];
                        if (debugPoly) {
                            console.log("BLA POLYGON", currentPolygon, target);
                        }
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
                                polygon.splitState1 = splitResults[i].type;
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
                                splitResults[0].polygon.splitState2 = splitResults[0].type;
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

                        /*
                        // Test
                        let raycaster = new THREE.Raycaster(point, direction);
                        let intersects = targetOctree.raycastIntersect(raycaster, targetOctree.mesh.matrixWorld);
                        console.log("Intersects?", intersects.length ? true : false, intersects);
                        if (intersects.length) {
                            let inside = false;
                            let j = 0;
                            let ddtm = direction.dot(intersects[j].polygon.plane.normal);
                            if (ddtm > 0) {
                                debugPoly && console.log(i, j, "Point is INSIDE the object", ddtm);
                                insideCount++;
                                // break;
                            }
                            else {
                                debugPoly && console.log(i, j, "Point is OUTSIDE the object", ddtm);
                            }
                            // for (let j = 0; j < intersects.length; j++) {
                            //     // let triangleNormal = new THREE.Vector3();
                            //     // intersects[j].polygon.triangle.getNormal(triangleNormal);
                            //     // let ddtm = direction.dot(triangleNormal);
                            //     console.log(j, intersects[j].polygon.plane.normal);
                            //     let ddtm = direction.dot(intersects[j].polygon.plane.normal);
                            //     if (ddtm > 0) {
                            //         debugPoly && console.log(i, j, "Point is INSIDE the object", ddtm);
                            //         insideCount++;
                            //         break;
                            //     }
                            //     else {
                            //         debugPoly && console.log(i, j, "Point is OUTSIDE the object", ddtm);
                            //     }
                            // }
                        }
                        */
                        // CURRENT
                        // let direction = new THREE.Vector3(1, 1, 1);
                        _raycaster1.set(point, direction);
                        let intersects = _raycaster1.intersectObject(targetOctree.mesh);
                        // console.log(i, "Intersects?", intersects);
                        if (debugPoly) {
                            console.log("RAY CHECK intersects.length", intersects.length, point, direction);
                        }
                        if (intersects.length) {
                            // console.log("a", currentPolygon, intersects);
                            // for (let j = 0; j < intersects.length; j++) {
                            let j = 0;
                            if (direction.dot(intersects[j].face.normal) > 0) {
                                debugPoly && console.log(i, j, "Point is inside the object", direction.dot(intersects[j].face.normal));
                                insideCount++;
                                // break;
                            }
                            else {
                                debugPoly && console.log(i, j, "Point is outside the object", direction.dot(intersects[j].face.normal));
                            }
                            // }
                        }

                    }
                    if (debugPoly) {
                        console.log("RAY CHECK COUNT", insideCount);
                    }
                    // if (insideCount + 1 >= currentPolygon.vertices.length) {
                    if (insideCount >= currentPolygon.vertices.length) {
                        currentPolygon.setState("inside");
                    }
                    else if (insideCount > 0) {
                        currentPolygon.checkAll = true;
                        polygonStack.push(currentPolygon);
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
    getPolygonCallback(cbFunc) {
        if (this.polygons.length > 0) {
            for (let i = 0; i < this.polygons.length; i++) {
                if (this.polygons[i].valid) {
                    cbFunc(this.polygons[i]);
                }
            }
            // this.polygons.forEach(p => cbFunc(p));
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getPolygonCallback(cbFunc);
        }
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

OctreeCSG.testSide = DoubleSide;







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
OctreeCSG.returnA = true;
OctreeCSG.returnType = 0;
/*
Union:
1. Delete all polygons in A that are:
    a. back and coplanar-back (strict)
    b. current state coplanar-back and previous states back (strict)
    c. back (strict)
    d. inside
2. Delete all polygons in B that are:
    a. back and coplanar-front (strict)
    b. back and coplanar-back (strict)
    c. back (strict)
    d. inside
*/
OctreeCSG.union = function (octreeA, octreeB) {
    // let polys = [];
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

        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);



        // old
        // octreeA.invalidatePolygonsByState("back", true);
        // octreeB.invalidatePolygonsByState("back", true);
        // octreeB.invalidatePolygonsByState("back", false);
        // octreeA.invalidatePolygonsByState("inside", false);
        // octreeB.invalidatePolygonsByState("inside", false);
        // old 2
        // octreeA.deletePolygonsByStates(["back", "coplanar-back"], true);
        // octreeA.deletePolygonsByTwoStates("coplanar-back", "back", true);
        // octreeA.deletePolygonsByState("back", true);
        // octreeB.deletePolygonsByState("back", true);
        // // octreeB.deletePolygonsByState("back", false);
        // octreeA.deletePolygonsByState("inside", false);
        // octreeB.deletePolygonsByState("inside", false);

        // current
        octreeA.handleIntersectingPolygons(octreeB);
        octreeB.handleIntersectingPolygons(octreeA);
        octreeA.resetPolygonsByState("back");
        octreeB.resetPolygonsByState("back");
        octreeA.handleIntersectingPolygons(octreeB);
        octreeB.handleIntersectingPolygons(octreeA);

        octreeA.deletePolygonsByStates(["back", "coplanar-back"], true);
        octreeA.deletePolygonsByTwoStates("coplanar-back", "back", true);
        octreeA.deletePolygonsByTwoStates("back", "coplanar-back", true);
        octreeA.deletePolygonsByState("coplanar-back", true);
        octreeA.deletePolygonsByState("back", true);
        octreeA.deletePolygonsByState("inside", false);

        octreeB.deletePolygonsByStates(["back", "coplanar-front"], true);
        octreeB.deletePolygonsByStates(["back", "coplanar-back"], true);
        octreeB.deletePolygonsByTwoStates("back", "coplanar-back", true);
        octreeB.deletePolygonsByTwoStates("back", "coplanar-front", true);
        octreeB.deletePolygonsByTwoStates("coplanar-back", "back", true);
        octreeB.deletePolygonsByTwoStates("coplanar-front", "back", true);
        octreeB.deletePolygonsByState("back", true);
        octreeB.deletePolygonsByState("inside", false);



        // let polysA = octreeA.getPolygons();
        // let polysB = octreeB.getPolygons();
        // let limit = Math.min(polysB.length, 198);
        // for (let i = 195; i < limit; i++) {
        //     console.log(i, polysB[i]);
        //     octree.addPolygon(polysB[i]);
        // }
        // let testPoly = polysB[197];
        // let targetPolygons = octreeA.getPolygonsIntersectingPolygon(testPoly, true);
        // console.log("targetPolygons", targetPolygons);
        // console.log("octreeA.mesh.material.side", octreeA.mesh.material.side);
        // console.log("rayTest(testPoly, octreeA)", rayTest(testPoly, octreeA));

        // polysA.forEach(poly => octree.addPolygon(poly));
        // polysB.forEach(poly => octree.addPolygon(poly));

        if (OctreeCSG.returnType == 0) {
            octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
            octreeB.getPolygonCallback(octree.addPolygon.bind(octree));
        }
        else if (OctreeCSG.returnType == -1) {
            console.log("OctreeA");
            let polys_test = octreeA.getPolygons();
            let limit = Math.min(polys_test.length, 50000);
            console.log(`[octreeA] polys_test`, polys_test.length, limit);
            for (let i = 0; i < limit; i++) {
                if (polys_test[i].intersects) {
                    let t = polys_test[i].triangle;
                    //     // if ((t.a.x == 5) && (t.b.x == 5) && (t.c.x == 5) && ((t.a.z === 5) || (t.b.z === 5) || (t.c.z === 5))) {
                    // if (((t.a.z === 5) || (t.b.z === 5) || (t.c.z === 5))) {
                    if (((t.a.y === -5) && (t.b.y === -5) && (t.c.y === -5))) {
                        console.log("AAAA", i, t, polys_test[i]);
                        octree.addPolygon(polys_test[i]);
                    }
                }
                // else {
                // octree.addPolygon(polys_test[i]);
                // }
            }
        }
        else {
            console.log("OctreeB");
            let polys_test = octreeB.getPolygons();
            let limit = Math.min(polys_test.length, 50000);
            console.log(`[octreeB] polys_test`, polys_test.length, limit);
            for (let i = 0; i < limit; i++) {
                if (polys_test[i].intersects) {
                    // console.log(i, polys_test[i]);
                    let t = polys_test[i].triangle;
                    //     // if ((t.a.x <= 5.5) && (t.b.x <= 5.5) && (t.c.x <= 5.5)) {
                    //     //     // if (i !== 286) continue;
                    console.log("BBBB", i, t, polys_test[i]);
                    //     // }
                    octree.addPolygon(polys_test[i]);
                }
                // else {
                // octree.addPolygon(polys_test[i]);
                // }
            }
        }

        octree.buildTree();

        if (octreeA.mesh.material.side !== currentMeshSideA) {
            octreeA.mesh.material.side = currentMeshSideA;
        }
        if (octreeB.mesh.material.side !== currentMeshSideB) {
            octreeB.mesh.material.side = currentMeshSideB;
        }
        // TODO: Function to invalidate non-intersecting polygons for subtract/intersects operations

    }
    else {
        // polys.push(...octreeA.getPolygons(), ...octreeB.getPolygons());
        // if (polys.length) {
        //     for (let i = 0; i < polys.length; i++) {
        //         octree.addPolygon(polys[i]);
        //     }
        //     octree.buildTree();
        // }
        octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
        octreeB.getPolygonCallback(octree.addPolygon.bind(octree));
        octree.buildTree();
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
Subtract: TBD

*/
OctreeCSG.subtract = function (octreeA, octreeB) {
    // let polys = [];
    let octree = new OctreeCSG();
    if (octreeA.box.intersectsBox(octreeB.box)) {
        // let trianglesSet = new Set();
        let currentMeshSideA = octreeA.mesh.material.side;
        let currentMeshSideB = octreeB.mesh.material.side;
        octreeA.mesh.material.side = OctreeCSG.testSide;
        octreeB.mesh.material.side = OctreeCSG.testSide;

        octreeA.resetPolygons();
        octreeB.resetPolygons();
        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);

        // // old
        // octreeA.handleIntersectingPolygons(octreeB);
        // octreeB.handleIntersectingPolygons(octreeA);

        // octreeA.deletePolygonsByStates(["back", "coplanar-front"], true);
        // octreeA.deletePolygonsByState("back", true);
        // octreeA.deletePolygonsByState("inside", false);

        // octreeB.deletePolygonsByStates(["back", "coplanar-front"], true);
        // octreeB.deletePolygonsByState("front", true);
        // octreeB.deletePolygonsByState("front", false);
        // octreeB.deletePolygonsByState("outside", false);
        // octreeB.deletePolygonsByIntersection(false);
        // octreeB.invert();


        // test
        // octreeA.invert();
        // octreeB.invert();
        octreeA.handleIntersectingPolygons(octreeB);
        octreeB.handleIntersectingPolygons(octreeA);
        octreeA.resetPolygonsByState("back");
        octreeB.resetPolygonsByState("back");
        // console.log("SECOND ROUND");
        octreeA.handleIntersectingPolygons(octreeB);
        octreeB.handleIntersectingPolygons(octreeA);

        octreeA.deletePolygonsByStates(["back", "coplanar-front"], true);
        octreeA.deletePolygonsByStates(["back", "coplanar-back"], true);
        octreeA.deletePolygonsByTwoStates("back", "coplanar-front", true);
        octreeA.deletePolygonsByTwoStates("coplanar-front", "back", true);
        octreeA.deletePolygonsByState("back", true);
        octreeA.deletePolygonsByState("inside", false);

        octreeB.deletePolygonsByStates(["back", "coplanar-front"], true);
        octreeB.deletePolygonsByTwoStates("back", "coplanar-front", true);
        octreeB.deletePolygonsByTwoStates("coplanar-front", "back", true);
        octreeB.deletePolygonsByTwoStates("front", "back", true);
        octreeB.deletePolygonsByTwoStates("back", "front", true);
        octreeB.deletePolygonsByState("front", true);
        octreeB.deletePolygonsByState("outside", false);
        octreeB.deletePolygonsByIntersection(false);



        octreeB.invert();


        // octreeB.deletePolygonsByState("back", true);
        // octreeB.deletePolygonsByTwoStates("front", "back", true);





        // octreeA.deletePolygonsByStates(["back", "coplanar-front"], true);
        // octreeA.deletePolygonsByStates(["back", "coplanar-back"], true);
        // octreeA.deletePolygonsByState("back", true);

        // octreeB.deletePolygonsByStates(["back", "coplanar-front"], true);
        // octreeB.deletePolygonsByTwoStates("front", "back", true);
        // octreeB.deletePolygonsByState("front", true);
        // octreeB.deletePolygonsByState("outside", false);
        // octreeB.deletePolygonsByIntersection(false);
        // octreeB.invert();

        if (OctreeCSG.returnType == 0) {
            octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
            octreeB.getPolygonCallback(octree.addPolygon.bind(octree));
        }
        else if (OctreeCSG.returnType == -1) {
            console.log("OctreeA");
            let polys_test = octreeA.getPolygons();
            let limit = Math.min(polys_test.length, 50);
            console.log(`[octreeA] polys_test`, polys_test.length, limit);
            for (let i = 0; i < limit; i++) {
                if (polys_test[i].intersects) {
                    let t = polys_test[i].triangle;
                    if (((t.a.y === 5) && (t.b.y === 5) && (t.c.y === 5))) {
                        // if (((t.a.x >= 0.8) && (t.b.x >= 0.8) && (t.c.x >= 0.8))) {
                        console.log("AAAA", i, t, polys_test[i]);
                        octree.addPolygon(polys_test[i]);
                    }
                }
                // else {
                // octree.addPolygon(polys_test[i]);
                // }
            }
        }
        else {
            console.log("OctreeB");
            let polys_test = octreeB.getPolygons();
            let limit = Math.min(polys_test.length, 50);
            console.log(`[octreeB] polys_test`, polys_test.length, limit);
            for (let i = 0; i < limit; i++) {
                if (polys_test[i].intersects) {
                    let t = polys_test[i].triangle;
                    //     if (((t.a.y === -5) && (t.b.y === -5) && (t.c.y === -5))) {
                    console.log("BBBB", i, t, polys_test[i]);
                    octree.addPolygon(polys_test[i]);
                    //     }
                }
                // else {
                // octree.addPolygon(polys_test[i]);
                // }
            }
        }

        if (octreeA.mesh.material.side !== currentMeshSideA) {
            octreeA.mesh.material.side = currentMeshSideA;
        }
        if (octreeB.mesh.material.side !== currentMeshSideB) {
            octreeB.mesh.material.side = currentMeshSideB;
        }
    }
    else {
        octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
    }

    octree.buildTree();
    // octree.invert();
    return octree;
}

OctreeCSG.intersect = function (octreeA, octreeB) {
    let octree = new OctreeCSG();
    if (octreeA.box.intersectsBox(octreeB.box)) {
        let currentMeshSideA = octreeA.mesh.material.side;
        let currentMeshSideB = octreeB.mesh.material.side;
        octreeA.mesh.material.side = OctreeCSG.testSide;
        octreeB.mesh.material.side = OctreeCSG.testSide;

        octreeA.resetPolygons();
        octreeB.resetPolygons();

        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);

        octreeA.handleIntersectingPolygons(octreeB);
        octreeB.handleIntersectingPolygons(octreeA);

        octreeA.deletePolygonsByState("front", true);
        octreeA.deletePolygonsByState("front", false);
        octreeA.deletePolygonsByState("outside", false);

        octreeB.deletePolygonsByStates(["back", "coplanar-front"], true);
        octreeB.deletePolygonsByState("front", true);
        octreeB.deletePolygonsByState("front", false);
        octreeB.deletePolygonsByState("outside", false);

        octreeA.deletePolygonsByIntersection(false);
        octreeB.deletePolygonsByIntersection(false);

        // octreeA.invert();
        // octreeB.invert();

        octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
        octreeB.getPolygonCallback(octree.addPolygon.bind(octree));

        // let polys_test = octreeB.getPolygons();
        // let limit = Math.min(polys_test.length, 50);
        // for (let i = 0; i < limit; i++) {
        //     console.log(i, polys_test[i]);
        //     octree.addPolygon(polys_test[i]);
        // }

        if (octreeA.mesh.material.side !== currentMeshSideA) {
            octreeA.mesh.material.side = currentMeshSideA;
        }
        if (octreeB.mesh.material.side !== currentMeshSideB) {
            octreeB.mesh.material.side = currentMeshSideB;
        }
    }
    // else {
    //     octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
    // }
    octree.buildTree();
    // octree.invert();
    return octree;
}


function rayTest(currentPolygon, targetOctree) {
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
        return "inside";
    }
    else {
        return "outside";
    }
}


OctreeCSG.isUniqueTriangle = function (triangle, set, map) {
    const hash1 = `{${triangle.a.x},${triangle.a.y},${triangle.a.z}}-{${triangle.b.x},${triangle.b.y},${triangle.b.z}}-{${triangle.c.x},${triangle.c.y},${triangle.c.z}}`;

    if (set.has(hash1) === true) {
        return false;
    }
    else {
        set.add(hash1);
        if (map) {
            map.set(triangle, triangle);
        }
        return true;
    }
}

const nbuf3 = (ct) => {
    return {
        top: 0,
        array: new Float32Array(ct),
        write: function (v) {
            this.array[this.top++] = v.x;
            this.array[this.top++] = v.y;
            this.array[this.top++] = v.z;
        }
    }
}
const nbuf2 = (ct) => {
    return {
        top: 0,
        array: new Float32Array(ct),
        write: function (v) {
            this.array[this.top++] = v.x;
            this.array[this.top++] = v.y;
        }
    }
}
// CSG.toMesh = function(csg, toMatrix, toMaterial) {
const _normal1 = new Vector3();
const tmpm3 = new Matrix3();
const ttvv0 = new Vector3()

OctreeCSG.toGeometry = function (octree) {
    let polygons = octree.getPolygons();
    let validPolygons = [];
    let trianglesSet = new Set();
    let triangleMap = new Map();
    let duplicateCount = 0;

    let triangleCount = 0;
    polygons.forEach(polygon => {
        if (OctreeCSG.isUniqueTriangle(polygon.triangle, trianglesSet)) {
            triangleCount += (polygon.vertices.length - 2);
            validPolygons.push(polygon);
        }
        // else {
        //     duplicateCount++;
        //     let a = triangleMap.get(polygon.triangle);
        //     console.log("DUPLICATE!!", polygon.id == a.polygon.id);
        // }
    });
    let positions = nbuf3(triangleCount * 3 * 3);
    let normals = nbuf3(triangleCount * 3 * 3);
    let uvs;
    let colors;
    let groups = [];
    let defaultGroup = [];

    validPolygons.forEach(polygon => {
        let vertices = polygon.vertices;
        let verticesLen = vertices.length;
        if (polygon.shared !== undefined) {
            if (!groups[polygon.shared]) {
                groups[polygon.shared] = [];
            }
        }
        if (verticesLen > 0) {
            if (vertices[0].uv !== undefined) {
                !uvs && (uvs = nbuf2(triangleCount * 2 * 3));
            }
            if (vertices[0].color !== undefined) {
                !colors && (colors = nbuf3(triangleCount * 3 * 3));
            }
        }
        for (let i = 3; i <= verticesLen; i++) {
            (polygon.shared === undefined ? defaultGroup : groups[polygon.shared]).push(positions.top / 3, (positions.top / 3) + 1, (positions.top / 3) + 2);
            positions.write(vertices[0].pos);
            positions.write(vertices[i - 2].pos);
            positions.write(vertices[i - 1].pos);
            normals.write(vertices[0].normal);
            normals.write(vertices[i - 2].normal);
            normals.write(vertices[i - 1].normal);
            if (uvs !== undefined) {
                uvs.write(vertices[0].uv);
                uvs.write(vertices[i - 2].uv);
                uvs.write(vertices[i - 1].uv);
            }
            if (colors !== undefined) {
                colors.write(vertices[0].color);
                colors.write(vertices[i - 2].color);
                colors.write(vertices[i - 1].color);
            }
        }
    });

    let geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions.array, 3));
    geometry.setAttribute('normal', new BufferAttribute(normals.array, 3));
    uvs && geometry.setAttribute('uv', new BufferAttribute(uvs.array, 2));
    colors && geometry.setAttribute('color', new BufferAttribute(colors.array, 3));

    if (groups.length > 0) {
        let index = [];
        let groupBase = 0;
        for (let i = 0; i < groups.length; i++) {
            if (groups[i] === undefined) {
                groups[i] = [];
            }
            geometry.addGroup(groupBase, groups[i].length, i);
            groupBase += groups[i].length;
            index = index.concat(groups[i]);
        }
        if (defaultGroup.length) {
            geometry.addGroup(groupBase, defaultGroup.length, groups.length);
            index = index.concat(defaultGroup);
        }
        geometry.setIndex(index);
    }
    // console.log("duplicateCount", duplicateCount);
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
            let vi = index[i + j];
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
        // if (polys[i].triangle.a.equals(polys[i].triangle.c)) {

        // }
        // else {
        if (isValidTriangle(polys[i].triangle)) {
            if (isNaN(polys[i].plane.normal.x)) {
                console.error("polygon", i, "is NaN!!!!");
            }

            octree.addPolygon(polys[i]);
        }
        else {
            // console.log("polygon", i, "has two points at same place", polys[i]);
            polys[i].delete();
        }
    }
    // octree.addTriangle(newTriangle(v1, v2, v3));


    octree.buildTree();
    // return CSG.fromPolygons(polys.filter(p => !isNaN(p.plane.normal.x)));
    octree.mesh = obj;
    return octree;

};

function isValidTriangle(triangle) {
    if (triangle.a.equals(triangle.b)) return false;
    if (triangle.a.equals(triangle.c)) return false;
    if (triangle.b.equals(triangle.c)) return false;
    return true;
}
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






OctreeCSG.addPolygonToMap = function (map, polygon, value) {
    let mapValue = map.get(polygon) || [];
    mapValue.push(value);
    map.set(polygon, mapValue);
}



// class Vertex

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

// class Plane

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

    equals(p) {
        if (this.normal.equals(p.normal) && this.w === p.w) {
            return true;
        }
        return false;
    }

}

Plane.fromPoints = function (a, b, c) {
    let n = tv0.copy(b).sub(a).cross(tv1.copy(c).sub(a)).normalize().clone();
    return new Plane(n, n.dot(a));
}


// class Polygon

class Polygon {
    constructor(vertices, shared) {
        this.vertices = vertices.map(v => v.clone());
        this.shared = shared;
        this.plane = Plane.fromPoints(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        // this.plane = Plane.fromPoints(vertices[0], vertices[1], vertices[2]);
        this.triangle = new Triangle(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        this.triangle.polygon = this;
        let currentPolygon = this;
        // if ((OctreeCSG.returnType == -1) && (currentPolygon.triangle.a.x == -5) && (currentPolygon.triangle.a.y == -5) && (currentPolygon.triangle.a.z == 5) && (currentPolygon.triangle.b.x == 5) && (currentPolygon.triangle.b.y == -5) && (currentPolygon.triangle.b.z == 5) && (currentPolygon.triangle.c.x == 5) && (currentPolygon.triangle.c.y == 5) && (currentPolygon.triangle.c.z == 5)) {
        //     console.log("NEW POLYGON", this, JSON.stringify(this.plane));
        // }
        this.box = new Box3();
        this.box.expandByPoint(this.triangle.a);
        this.box.expandByPoint(this.triangle.b);
        this.box.expandByPoint(this.triangle.c);
        this.box.expandByScalar(EPSILON);
        // this.source = "new";
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
        let tmp = this.triangle.a;
        this.triangle.a = this.triangle.c;
        this.triangle.c = tmp;
        this.plane.flip();
    }
    delete() {
        this.vertices.forEach(v => v.delete());
        this.vertices.length = 0;
        // this.plane.delete();
        // this.plane = undefined;
        // this.triangle = undefined;
        this.shared = undefined;
        this.valid = false;
    }
}



// TODO: test max level 10 and polys per tree 50
OctreeCSG.maxLevel = 16;
OctreeCSG.polygonsPerTree = 8;

OctreeCSG.Polygon = Polygon;
export default OctreeCSG;