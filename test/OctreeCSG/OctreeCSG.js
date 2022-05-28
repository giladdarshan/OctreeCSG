// import * as THREE from 'three';
// const { Vector2, Vector3, Box3, BackSide, DoubleSide, FrontSide, Matrix3, Matrix4, Ray, Triangle, BufferGeometry, BufferAttribute, Mesh, Raycaster } = THREE;
import { Vector2, Vector3, Box3, BackSide, DoubleSide, FrontSide, Matrix3, Matrix4, Ray, Triangle, BufferGeometry, BufferAttribute, Mesh, Raycaster } from 'three';
import { triangleIntersectsTriangle, checkTrianglesIntersection } from './three-triangle-intersection.js';
const _v1 = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();
const tmpInverseMatrix = new Matrix4();
// import * as BVH from '/js/three-mesh-bvh.module.js';
// console.log("BVH TEST:", BVH);

const tv0 = new Vector3();
const tv1 = new Vector3();
const _raycaster1 = new Raycaster();
const _ray = new Ray();
const _ray2 = new Ray();
const _rayDirection = new Vector3(0, 0, 1);

// const _raycastDirections = [
//     new Vector3(0, 0, 1),
//     new Vector3(0, 1, 0),
//     new Vector3(1, 0, 0)
// ];
// const _raycastDirectionsCount = _raycastDirections.length;


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
        // this.octreeMap = new Map();
        // this.isOctree = true;
        // this.triangles = [];
        this.polygons = [];
        // this.polygonMap;
        this.mesh;
        this.originalMatrixWorld;
        // this.bspNode;
        this.box = box;
        this.subTrees = [];
        this.parent = parent;
        this.level = 0;
        Object.defineProperties(this, {
            id: {
                value: _octreeID++
            },
            isOctree: {
                value: true
            }
        });

    }
    clone() {
        return new this.constructor().copy(this);
    }

    copy(source) {
        this.polygons = source.polygons.map(p => p.clone());
        if (source.mesh) {
            this.mesh = source.mesh;
        }
        if (source.originalMatrixWorld) {
            this.originalMatrixWorld = source.originalMatrixWorld.clone();
        }
        this.box = source.box.clone();
        this.level = source.level;

        for (let i = 0; i < source.subTrees.length; i++) {
            let subTree = new this.constructor(undefined, this).copy(source.subTrees[i]);
            this.subTrees.push(subTree);
        }

        return this;
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

                if (subTrees[i].box.containsPoint(triangle.midPoint)) {
                    // if (subTrees[i].box.containsPoint(triangle.getMidpoint(_v1))) {
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
        // this.setPolygonMap(new Map());
        // octree.setPolygonMap();
        this.calcBox();
        this.split(0);
        this.processTree();
        // console.log("trianglesMap", trianglesMap);
        return this;

    }
    processTree() {
        // this.octreeMap.set(this.id, this);
        if (!this.isEmpty()) {
            // console.log("triangles in level", this.level, "Octree ID:", this.id);
            // let currentBox = this.box.clone();
            // for (let i = 0; i < this.triangles.length; i++) {
            for (let i = 0; i < this.polygons.length; i++) {
                // OctreeCSG.addPolygonToMap(this.polygonMap, this.polygons[i], this);
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
            this.expandParentBox();
            // if (!this.box.equals(currentBox)) {
            //     console.log("bound box changed in tree id", this.id, this.box, currentBox);
            // }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            // this.subTrees[i].setPolygonMap(this.polygonMap);
            this.subTrees[i].processTree();
        }
    }
    expandParentBox() {
        if (this.parent) {
            this.parent.box.expandByPoint(this.box.min);
            this.parent.box.expandByPoint(this.box.max);
            this.parent.expandParentBox();
        }
    }
    // setPolygonMap(map) {
    //     this.polygonMap = map;
    // }

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
    getPolygonsOnlyIntersectingPolygon(targetPolygon, polygons = []) {
        if (targetPolygon.triangle === undefined) {
            console.log("UNDEFINED", targetPolygon);
            return polygons;
        }
        if (this.box.intersectsTriangle(targetPolygon.triangle)) {
            if (this.polygons.length > 0) {
                polygons.push(...this.polygons.filter(p => p.valid));
            }
            for (let i = 0; i < this.subTrees.length; i++) {
                this.subTrees[i].getPolygonsOnlyIntersectingPolygon(targetPolygon, polygons);
            }
        }

        return polygons;
    }


    getPolygonsIntersectingPolygon(targetPolygon, debug = false, polygons = []) {
        let found = false;
        if (this.polygons.length > 0) {
            if (targetPolygon.triangle === undefined) {
                console.log("UNDEFINED", targetPolygon);
            }
            // let targetTriangle = this.increaseTriangleSize(targetPolygon.triangle);
            let targetTriangle = targetPolygon.triangle;
            // let bvhTriangle1 = new BVH.SeparatingAxisTriangle(targetTriangle.a, targetTriangle.b, targetTriangle.c);
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


                        // let bvhTriangle2 = new BVH.SeparatingAxisTriangle(polygon.triangle.a, polygon.triangle.b, polygon.triangle.c);
                        // console.log("BVH Intersect", bvhTriangle1.intersectsTriangle(bvhTriangle2));
                        // if (bvhTriangle1.intersectsTriangle(bvhTriangle2)) {
                        // console.log("found intersecting polygon", polygon);
                        if (checkTrianglesIntersection(targetTriangle, polygon.triangle, additionsObj)) {
                            console.log("intersects", additionsObj.triangleCheck, additionsObj);
                            polygons.push(polygon);
                            found = true;
                        }
                        // else {
                        //     console.log("nope", additionsObj.triangleCheck);
                        // }

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
        debug && console.warn("[getPolygonsIntersectingPolygon] FOUND?", found);

        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getPolygonsIntersectingPolygon(targetPolygon, debug, polygons);
        }

        return polygons;
    }


    // Testing
    populatePolygonWithOctree() {
        if (this.polygons.length > 0) {
            this.polygons.forEach(p => p.octree = this);
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].populatePolygonWithOctree();
        }
    }
    getRayPolygons(ray, polygons = []) {
        // console.log("[getRayPolygons] checking octree", this, this.polygons.length);
        if (this.polygons.length > 0) {
            for (let i = 0; i < this.polygons.length; i++) {
                if (this.polygons[i].valid) {
                    if (polygons.indexOf(this.polygons[i]) === -1) {
                        polygons.push(this.polygons[i]);
                    }
                }
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            // if (ray.triangle ? this.subTrees[i].box.intersectsTriangle(ray.triangle) : ray.intersectsBox(this.subTrees[i].box)) {
            if (ray.intersectsBox(this.subTrees[i].box)) {
                this.subTrees[i].getRayPolygons(ray, polygons);
            }
        }

        return polygons;
    }

    // Testing
    rayIntersect(ray, matrixWorld, intersects = []) {

        if (ray.direction.length() === 0) return;
        if (matrixWorld) {
            tmpInverseMatrix.copy(matrixWorld).invert();
            _ray2.copy(ray).applyMatrix4(tmpInverseMatrix);
        }

        // three-mesh-bvh
        // const distance = ray.origin.distanceTo( point );
        // hit.point.applyMatrix4( object.matrixWorld );
        // hit.distance = hit.point.distanceTo( raycaster.ray.origin );
        // hit.object = object;
        // if ( hit.distance < raycaster.near || hit.distance > raycaster.far ) {
        //     return null;
        // } else {
        //     return hit;


        // three.js
        // _intersectionPointWorld.copy(point);
        // _intersectionPointWorld.applyMatrix4(object.matrixWorld);
        // const distance = raycaster.ray.origin.distanceTo(_intersectionPointWorld);
        // if (distance < raycaster.near || distance > raycaster.far) return null;
        // return {
        // 	distance: distance,
        // 	point: _intersectionPointWorld.clone(),
        // 	object: object
        // };




        // const polygons = [];
        let polygon, position, distance = 1e100;

        // this.getRayTriangles(ray, triangles);

        // let polygons = this.getRayPolygons(ray);
        // let polygons = this.getPolygons();
        let polygons = OctreeCSG.getRayPolys ? this.getRayPolygons(ray) : this.getPolygons();

        OctreeCSG.debugPoly && console.log("[rayIntersect] polygons", polygons, "OctreeCSG.testSide", OctreeCSG.testSide);
        for (let i = 0; i < polygons.length; i++) {
            let result;
            switch (OctreeCSG.rayIntersectTriangleType) {
                case "MollerTrumbore":
                    result = rayIntersectsTriangle(ray, polygons[i].triangle, _v1);
                    if (result) {
                        const newdistance = result.clone().sub(ray.origin).length();
                        if (distance > newdistance) {
                            distance = newdistance;
                        }
                        if (distance < 1e100) {
                            // if (distance !== newdistance) {
                            //     console.log("DISTANCE CHECK:", distance, newdistance);
                            // }
                            // intersects.push({ distance: newdistance, polygon: polygons[i], position: result.clone().add(ray.origin) });
                            intersects.push({ distance: distance, polygon: polygons[i], position: result.clone().add(ray.origin) });
                        }
                        else {
                            console.log("BIG DISTANCE:", { distance: distance, polygon: polygons[i], position: result.clone().add(ray.origin) });
                        }
                    }
                    break;
                case "regular":
                default:
                    // ray.direction = polygons[i].vertices[0].normal;
                    // let result = ray.intersectTriangle(polygons[i].triangle.c, polygons[i].triangle.b, polygons[i].triangle.a, true, _v1); // back
                    result = ray.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, false, _v1); //double


                    // let result = _ray2.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, false, _v1); //double
                    if (result) {
                        _v1.applyMatrix4(matrixWorld);
                        // distance = ray.origin.distanceTo(_v1);
                        distance = _v1.distanceTo(ray.origin);
                        // if (distance > 0 && distance < Infinity) {
                        if (distance < 0 || distance > Infinity) {
                            console.warn("[rayIntersect] Failed ray distance check", ray);
                        }
                        else {
                            intersects.push({ distance: distance, polygon: polygons[i], position: _v1.clone() });
                        }


                        // const newdistance = result.sub(ray.origin).length();
                        // if (distance > newdistance) {
                        //     position = result.clone().add(ray.origin);
                        //     distance = newdistance;
                        //     polygon = polygons[i];
                        // }
                        // if (distance < 1e100) {
                        //     intersects.push({ distance: newdistance, polygon: polygons[i], position: result.clone().add(ray.origin) });
                        // }
                        // else {
                        //     console.log("BIG DISTANCE:", { distance: distance, polygon: polygon, position: position });
                        // }

                    }
                    break;
            }

            OctreeCSG.debugPoly && console.log("[rayIntersect]", i, result);
            // Not required since always using DoubleSide check (?)
            /*
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
            */

            // const result = ray.intersectTriangle(triangles[i].a, triangles[i].b, triangles[i].c, true, _v1);

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

    getIntersectingPolygons(polygons = []) {
        if (this.polygons.length) {
            for (let i = 0; i < this.polygons.length; i++) {
                if (this.polygons[i].valid && this.polygons[i].intersects) {
                    polygons.push(this.polygons[i]);
                }
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getIntersectingPolygons(polygons);
        }
        return polygons;
    }
    getPolygons(polygons = []) {
        if (this.polygons.length) {
            for (let i = 0; i < this.polygons.length; i++) {
                if (this.polygons[i].valid) {
                    polygons.push(this.polygons[i]);
                }
            }
        }
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
    invert() {
        if (this.polygons.length > 0) {
            this.polygons.forEach(p => p.flip());
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].invert();
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


    deletePolygonsByStateRules(rulesArr, debug = false, firstRun = true) {
        if (this.polygons.length > 0) {
            // let polygonArr = this.polygons.slice();
            let polygonArr = this.polygons.filter(polygon => (polygon.valid == true) && (polygon.intersects == true));
            polygonArr.forEach(polygon => {
                let found = false;
                for (let j = 0; j < rulesArr.length; j++) {
                    if (rulesArr[j].array) {
                        let states = rulesArr[j].rule;
                        if ((states.includes(polygon.state)) && (((polygon.previousState !== "undecided") && (states.includes(polygon.previousState))) || (polygon.previousState == "undecided"))) {
                            debug && console.log("deletePolygonsByStates A");
                            found = true;
                            let statesObj = {};
                            let mainStatesObj = {};
                            states.forEach(state => statesObj[state] = false);
                            states.forEach(state => mainStatesObj[state] = false);
                            statesObj[polygon.state] = true;
                            for (let i = 0; i < polygon.previousStates.length; i++) {
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
                                    break;
                                }
                            }
                        }
                    }
                    else {
                        if (polygon.checkAllStates(rulesArr[j].rule)) {
                            found = true;
                            break;
                        }
                    }
                }
                if (found) {
                    debug && console.log("deletePolygonsByStates E");
                    let polygonIndex = this.polygons.indexOf(polygon);
                    if (polygonIndex > -1) {
                        debug && console.log("deletePolygonsByStates F", polygon);
                        polygon.setInvalid();
                        this.polygons.splice(polygonIndex, 1);
                        // polygon.delete();
                    }
                    // else {
                    //     polygon.setInvalid();
                    // }
                    if (firstRun) {
                        polygon.delete();
                    }
                }
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].deletePolygonsByStateRules(rulesArr, debug, false);
        }
    }

    deletePolygonsByIntersection(intersects, firstRun = true) {
        if (intersects == undefined) {
            return;
        }
        if (this.polygons.length > 0) {
            let polygonArr = this.polygons.slice();
            polygonArr.forEach(polygon => {
                if (polygon.valid) {
                    if (polygon.intersects === intersects) {
                        let polygonIndex = this.polygons.indexOf(polygon);
                        if (polygonIndex > -1) {
                            polygon.setInvalid();
                            this.polygons.splice(polygonIndex, 1);
                            // polygon.delete();
                        }
                        // else {
                        //     polygon.setInvalid();
                        // }
                        if (firstRun) {
                            polygon.delete();
                        }
                    }
                }
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].deletePolygonsByIntersection(intersects, false);
        }
    }

    isPolygonIntersecting(polygon) {
        if (!this.box.intersectsTriangle(polygon.triangle)) {
            return false;
        }

        // Changing to return true if intersecting with box, if looking only for octrees with polygons that intersects it can lead to incorrectly identifying intersecting polygons 
        return true;
        // if (this.polygons.length > 0) {
        //     return true;
        // }
        // let isIntersecting = false;
        // if (this.subTrees.length > 0) {
        //     for (let i = 0; i < this.subTrees.length; i++) {
        //         isIntersecting = this.subTrees[i].isPolygonIntersecting(polygon);
        //         if (isIntersecting) {
        //             break;
        //         }
        //     }
        // }
        // return isIntersecting;
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
    handleIntersectingPolygons(targetOctree, targetOctreeBuffer) {
        if (this.polygons.length > 0) {
            let polygonStack = this.polygons.filter(polygon => (polygon.valid == true) && (polygon.intersects == true) && (polygon.state == "undecided"));
            let currentPolygon = polygonStack.pop();
            while (currentPolygon) {
                if (currentPolygon.state !== "undecided") {
                    continue;
                }
                if (!currentPolygon.valid) {
                    continue;
                }

                let debugPoly = false;
                // let testTriangle = new THREE.Triangle(new THREE.Vector3(0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(-0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(0, -4.3809967041015625, 2.4097442626953125));
                // if ((OctreeCSG.returnType == -1) && (currentPolygon.triangle.equals(testTriangle))) {
                //     debugPoly = true;
                //     console.warn("STARTING DEBUG");
                // }
                OctreeCSG.debugPoly = debugPoly;
                let targetPolygons = targetOctree.getPolygonsIntersectingPolygon(currentPolygon, debugPoly);

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
                        debugPoly && console.log("splitResults", splitResults)
                        if (splitResults.length > 1) {
                            // let newPolygons = [];
                            for (let i = 0; i < splitResults.length; i++) {
                                let polygon = splitResults[i].polygon;
                                polygon.intersects = currentPolygon.intersects;
                                polygon.splitState1 = splitResults[i].type;
                                // if (splitResults[i].type == "back") {
                                polygonStack.push(polygon);
                                // }
                                // else {
                                //     polygon.setState(splitResults[i].type);
                                // }

                            }
                            this.replacePolygon(currentPolygon, splitResults.map(result => result.polygon));
                            // needsBreak = true;
                            break;
                        }
                        else {
                            if (currentPolygon.id !== splitResults[0].polygon.id) {
                                splitResults[0].polygon.intersects = currentPolygon.intersects;
                                splitResults[0].polygon.splitState2 = splitResults[0].type;
                                // if (splitResults[0].type == "back") {
                                polygonStack.push(splitResults[0].polygon);
                                // }
                                // else {
                                //     splitResults[0].polygon.setState(splitResults[0].type);
                                // }
                                this.replacePolygon(currentPolygon, splitResults[0].polygon);
                                break;
                            }
                            else {
                                if ((splitResults[0].type == "coplanar-front") || (splitResults[0].type == "coplanar-back")) {
                                    currentPolygon.setState(splitResults[0].type);
                                    currentPolygon.coplanar = true;
                                }
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
                    debugPoly && console.log("[handleIntersectingPolygons] Not intersecting with any target polygons", currentPolygon);
                }

                // if (iteration >= 100) {
                //     break;
                // }
                // console.log("--------------------");
                currentPolygon = polygonStack.pop();
            }

            // console.log("ASDADASD", this.polygons);
            // if (OctreeCSG.useWindingNumber === true && targetOctreeAllPolygons === undefined) {
            //     console.log("[handleIntersectingPolygons] targetOctreeAllPolygons === undefined");
            //     targetOctreeAllPolygons = targetOctree.getPolygons();
            // }
            polygonStack = this.polygons.filter(polygon => (polygon.valid == true) && (polygon.intersects == true));
            currentPolygon = polygonStack.pop();
            while (currentPolygon) {
                // if (currentPolygon.state !== "undecided") {
                //     continue;
                // }
                if (!currentPolygon.valid) {
                    continue;
                }

                let debugPoly = false;

                // let testTriangle = new THREE.Triangle(new THREE.Vector3(0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(-0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(0, -4.3809967041015625, 2.4097442626953125));
                // if ((OctreeCSG.returnType == -1) && (currentPolygon.triangle.equals(testTriangle))) {
                //     debugPoly = true;
                //     console.warn("STARTING DEBUG");
                // }
                OctreeCSG.debugPoly = debugPoly;
                let inside = false;
                if (targetOctree.box.containsPoint(currentPolygon.triangle.midPoint)) {
                    if (OctreeCSG.useWindingNumber === true) {
                        inside = polyInside_WindingNumber_buffer(targetOctreeBuffer, currentPolygon.triangle.midPoint, currentPolygon.coplanar);
                    }
                    else {
                        let point = pointRounding(_v2.copy(currentPolygon.triangle.midPoint));
                        // let point = currentPolygon.triangle.midPoint;

                        // let point = pointRounding(currentPolygon.triangle.getMidpoint(_v2));
                        debugPoly && console.log("point for currentPolygon", point.clone(), currentPolygon);
                        // let point = currentPolygon.triangle.getMidpoint(_v2);
                        // _rayDirection.copy(currentPolygon.plane.normal).normalize();



                        if (OctreeCSG.useOctreeRay !== true) {
                            // _ray.origin.copy(point);
                            _rayDirection.copy(currentPolygon.plane.normal);
                            // _raycaster1.ray.origin.copy(point);
                            // _raycaster1.set(point, _rayDirection);
                            // for (let i = 0; i < _raycastDirectionsCount; i++) {
                            //     _raycaster1.ray.direction.copy(_raycastDirections[i]);
                            //     let intersects = _raycaster1.intersectObject(targetOctree.mesh);
                            //     // console.log(i, "Intersects?", intersects);
                            //     if (debugPoly) {
                            //         console.log("RAY CHECK intersects.length", intersects.length, point, _raycastDirections[i]);
                            //     }
                            //     if (intersects.length) {

                            //         if (_raycastDirections[i].dot(intersects[0].face.normal) > 0) {
                            //             debugPoly && console.log(i, "Point is inside the object", _raycastDirections[i].dot(intersects[0].face.normal));
                            //             inside = true;
                            //             break;
                            //         }
                            //         else {
                            //             debugPoly && console.log(i, "Point is outside the object", _raycastDirections[i].dot(intersects[0].face.normal));
                            //         }
                            //     }
                            // }
                            _raycaster1.set(point, _rayDirection);
                            let intersects = _raycaster1.intersectObject(targetOctree.mesh);
                            // console.log(i, "Intersects?", intersects);
                            if (debugPoly) {
                                console.log("RAY CHECK intersects.length", intersects.length, point, _rayDirection);
                            }
                            if (intersects.length) {

                                if (_rayDirection.dot(intersects[0].face.normal) > 0) {
                                    debugPoly && console.log("Point is inside the object", _rayDirection.dot(intersects[0].face.normal));
                                    inside = true;
                                }
                                else {
                                    debugPoly && console.log("Point is outside the object", _rayDirection.dot(intersects[0].face.normal));
                                }

                            }
                            if (!inside && currentPolygon.coplanar) {
                                // let coplanarFound = false;
                                // console.log("POLYGON IS COPLANAR");
                                for (let j = 0; j < _wP_EPS_ARR_COUNT; j++) {
                                    // console.warn("DOES IT GET HERE?");
                                    _raycaster1.ray.origin.copy(point).add(_wP_EPS_ARR[j]);
                                    // let intersects = targetOctree.rayIntersect(_ray, targetOctree.mesh.matrixWorld);
                                    let intersects = _raycaster1.intersectObject(targetOctree.mesh);
                                    // console.log(i, "Intersects?", intersects);
                                    if (debugPoly) {
                                        console.log("RAY CHECK intersects.length", intersects.length, point, _rayDirection);
                                    }
                                    if (intersects.length) {

                                        if (_rayDirection.dot(intersects[0].face.normal) > 0) {
                                            debugPoly && console.log("Point is inside the object", _rayDirection.dot(intersects[0].face.normal));
                                            inside = true;
                                            break;
                                        }
                                        else {
                                            debugPoly && console.log("Point is outside the object", _rayDirection.dot(intersects[0].face.normal));
                                        }

                                    }
                                }
                                // if (coplanarFound) {
                                //     console.log("Found as coplanar", _ray.clone());
                                // }
                            }
                        }
                        else {
                            // let ray = new Ray(point, _rayDirection);
                            _ray.origin.copy(point);
                            _rayDirection.copy(currentPolygon.plane.normal);
                            // _ray.direction.copy(_rayDirection);
                            _ray.direction.copy(currentPolygon.plane.normal);
                            // let intersects = targetOctree.rayIntersect(_ray, targetOctree.mesh.matrixWorld);
                            let intersects = targetOctree.rayIntersect(_ray, targetOctree.originalMatrixWorld);
                            if (debugPoly) {
                                console.log("RAY CHECK intersects.length", intersects.length, point, _rayDirection);
                            }
                            if (intersects.length) {
                                if (_rayDirection.dot(intersects[0].polygon.plane.normal) > 0) {
                                    debugPoly && console.log("Point is inside the object", _rayDirection.dot(intersects[0].polygon.plane.normal));
                                    inside = true;
                                    // break;
                                }
                                else {
                                    debugPoly && console.log("Point is outside the object", _rayDirection.dot(intersects[0].polygon.plane.normal));
                                }

                            }
                            if (!inside && currentPolygon.coplanar) {
                                // let coplanarFound = false;
                                // console.log("POLYGON IS COPLANAR");
                                for (let j = 0; j < _wP_EPS_ARR_COUNT; j++) {
                                    // console.warn("DOES IT GET HERE?");
                                    _ray.origin.copy(point).add(_wP_EPS_ARR[j]);
                                    _rayDirection.copy(currentPolygon.plane.normal);
                                    _ray.direction.copy(currentPolygon.plane.normal);
                                    // let intersects = targetOctree.rayIntersect(_ray, targetOctree.mesh.matrixWorld);
                                    let intersects = targetOctree.rayIntersect(_ray, targetOctree.originalMatrixWorld);
                                    if (debugPoly) {
                                        console.log("RAY CHECK intersects.length", intersects.length, point, _rayDirection);
                                    }
                                    if (intersects.length) {
                                        if (_rayDirection.dot(intersects[0].polygon.plane.normal) > 0) {
                                            debugPoly && console.log("Point is inside the object", _rayDirection.dot(intersects[0].polygon.plane.normal));
                                            inside = true;
                                            // coplanarFound = true;
                                            break;
                                        }
                                        else {
                                            debugPoly && console.log("Point is outside the object", _rayDirection.dot(intersects[0].polygon.plane.normal));
                                        }

                                    }
                                }
                                // if (coplanarFound) {
                                //     console.log("Found as coplanar", _ray.clone());
                                // }
                            }
                            /*
                            for (let i = 0; i < _raycastDirectionsCount; i++) {
                                _ray.direction.copy(_raycastDirections[i]);
                                let intersects = targetOctree.rayIntersect(_ray, targetOctree.mesh.matrixWorld);
                                // let intersects = targetOctree.rayIntersect(_ray, targetOctree.originalMatrixWorld);
                                if (debugPoly) {
                                    console.log("RAY CHECK intersects.length", intersects.length, point, _raycastDirections[i]);
                                }
                                if (intersects.length) {
                                    if (_raycastDirections[i].dot(intersects[0].polygon.plane.normal) > 0) {
                                        debugPoly && console.log(i, "Point is inside the object", _raycastDirections[i].dot(intersects[0].polygon.plane.normal));
                                        inside = true;
                                        break;
                                    }
                                    else {
                                        debugPoly && console.log(i, "Point is outside the object", _raycastDirections[i].dot(intersects[0].polygon.plane.normal));
                                    }
    
                                }
                            }
                            */

                            /*
                            // let ray = new Ray(point, _rayDirection);
                            let intersects = targetOctree.rayIntersect(ray);
                            // console.log("octree ray test", intersects);
                            if (debugPoly) {
                                console.log("RAY CHECK intersects.length", intersects.length, point, _rayDirection);
                            }
                            if (intersects.length) {
                                for (let i = 0; i < intersects.length; i++) {
                                    if (_rayDirection.dot(intersects[i].polygon.plane.normal) > 0) {
                                        debugPoly && console.log(i, "Point is inside the object", _rayDirection.dot(intersects[i].polygon.plane.normal));
                                        inside = true;
                                        break;
                                    }
                                    else {
                                        debugPoly && console.log(i, "Point is outside the object", _rayDirection.dot(intersects[i].polygon.plane.normal));
                                    }
                                }
                            }
                            */
                        }
                    }
                }

                if (debugPoly) {
                    console.log("CHECK INSIDE", inside);
                }
                if (inside === true) {
                    currentPolygon.setState("inside");
                }
                else {
                    currentPolygon.setState("outside");
                }

                currentPolygon = polygonStack.pop();
            }

        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].handleIntersectingPolygons(targetOctree, targetOctreeBuffer);
        }
    }

    handleIntersectingPolygons_reduced(targetOctree, targetOctreeBuffer) { // used in async functions
        // async handleIntersectingPolygons_async(targetOctree, targetOctreeBuffer) {
        // return new Promise(async (resolve, reject) => {
        //     try {
        if (this.polygons.length > 0) {
            // testvar++;
            // this.polygons.forEach(polygon => {
            //     polygon.reset();
            // });

            // TESTING NEW METHOD
            let polygonStack = this.polygons.filter(polygon => (polygon.valid == true) && (polygon.intersects == true) && (polygon.state == "undecided"));
            let currentPolygon = polygonStack.pop();
            while (currentPolygon) {
                if (currentPolygon.state !== "undecided") {
                    continue;
                }
                if (!currentPolygon.valid) {
                    continue;
                }

                let debugPoly = false;
                // let testTriangle = new THREE.Triangle(new THREE.Vector3(0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(-0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(0, -4.3809967041015625, 2.4097442626953125));
                // if ((OctreeCSG.returnType == -1) && (currentPolygon.triangle.equals(testTriangle))) {
                //     debugPoly = true;
                //     console.warn("STARTING DEBUG");
                // }
                OctreeCSG.debugPoly = debugPoly;
                let targetPolygons = targetOctree.getPolygonsIntersectingPolygon(currentPolygon, debugPoly);

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
                        debugPoly && console.log("splitResults", splitResults)
                        if (splitResults.length > 1) {
                            // let newPolygons = [];
                            for (let i = 0; i < splitResults.length; i++) {
                                let polygon = splitResults[i].polygon;
                                polygon.intersects = currentPolygon.intersects;
                                polygon.splitState1 = splitResults[i].type;
                                polygonStack.push(polygon);
                            }
                            this.replacePolygon(currentPolygon, splitResults.map(result => result.polygon));
                            break;
                        }
                        else {
                            if (currentPolygon.id !== splitResults[0].polygon.id) {
                                splitResults[0].polygon.intersects = currentPolygon.intersects;
                                splitResults[0].polygon.splitState2 = splitResults[0].type;
                                polygonStack.push(splitResults[0].polygon);
                                this.replacePolygon(currentPolygon, splitResults[0].polygon);
                                break;
                            }
                            else {
                                if ((splitResults[0].type == "coplanar-front") || (splitResults[0].type == "coplanar-back")) {
                                    currentPolygon.setState(splitResults[0].type);
                                    currentPolygon.coplanar = true;
                                }
                            }
                        }
                    }
                }
                else {
                    debugPoly && console.log("[handleIntersectingPolygons] Not intersecting with any target polygons", currentPolygon);
                }

                currentPolygon = polygonStack.pop();
            }

            /*
            polygonStack = this.polygons.filter(polygon => (polygon.valid == true) && (polygon.intersects == true));
            let runningWebWorkers = [];
            currentPolygon = polygonStack.pop();
            while (currentPolygon) {
                // console.warn("Checking loop polygon id", currentPolygon.id);
                if (!currentPolygon.valid) {
                    continue;
                }

                let debugPoly = false;

                // let testTriangle = new THREE.Triangle(new THREE.Vector3(0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(-0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(0, -4.3809967041015625, 2.4097442626953125));
                // if ((OctreeCSG.returnType == -1) && (currentPolygon.triangle.equals(testTriangle))) {
                //     debugPoly = true;
                //     console.warn("STARTING DEBUG");
                // }
                OctreeCSG.debugPoly = debugPoly;
                let inside = false;
                if (targetOctree.box.containsPoint(currentPolygon.triangle.midPoint)) {
                    // if (OctreeCSG.useWindingNumber === true) {
                    // let responses = [];
                    // // let result1 = OctreeCSG.testWorker(1);
                    // // let result2 = OctreeCSG.testWorker(2);
                    let worker = getAvailableWorker();
                    while (!worker) {
                        // console.log("Waiting for worker");
                        await sleep(1);
                        worker = getAvailableWorker();
                    }

                    worker.checkWindingNumber({
                        type: 'windingNumber',
                        point: currentPolygon.triangle.midPoint,
                        coplanar: currentPolygon.coplanar,
                        polygonID: currentPolygon.id,
                        triangles: targetOctreeBuffer
                    }, currentPolygon).then(worker => {
                        // console.log("Worker finished", worker.id);
                        let workerIndex = runningWebWorkers.indexOf(worker);
                        if (workerIndex > -1) {
                            runningWebWorkers.splice(workerIndex, 1);
                        }
                    });
                    runningWebWorkers.push(worker);

                }
                else {
                    currentPolygon.setState("outside");
                }

                // if (debugPoly) {
                //     console.log("CHECK INSIDE", inside);
                // }
                // if (inside === true) {
                //     currentPolygon.setState("inside");
                // }
                // else {
                //     currentPolygon.setState("outside");
                // }

                currentPolygon = polygonStack.pop();
            }
            // console.log("START WAITING", runningWebWorkers.length);
            while (runningWebWorkers.length) {
                // console.log("Waiting to finish");
                await sleep(1);
            }
            // console.log("FINISHED WAITING", runningWebWorkers.length);
            */

        }
        for (let i = 0; i < this.subTrees.length; i++) {
            // await this.subTrees[i].handleIntersectingPolygons_async(targetOctree, targetOctreeBuffer);
            this.subTrees[i].handleIntersectingPolygons_reduced(targetOctree, targetOctreeBuffer);
        }
        // resolve();
        //     }
        //     catch (e) {
        //         reject(e);
        //     }
        // });
    }

    delete() {
        if (this.polygons.length > 0) {
            this.polygons.forEach(p => p.delete());
            this.polygons.length = 0;
        }
        if (this.subTrees.length) {
            for (let i = 0; i < this.subTrees.length; i++) {
                this.subTrees[i].delete(false);
            }
            this.subTrees.length = 0;
        }
        this.mesh = undefined;
        this.originalMatrixWorld = undefined;
        this.box = undefined;
        this.parent = undefined;
    }
    getPolygonCallback(cbFunc) {
        if (this.polygons.length > 0) {
            for (let i = 0; i < this.polygons.length; i++) {
                if (this.polygons[i].valid) {
                    cbFunc(this.polygons[i]);
                }
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getPolygonCallback(cbFunc);
        }
    }
}


function raycastIntersectAscSort(a, b) {
    return a.distance - b.distance;
}

function pointRounding(point, num = 15) {
    point.x = +point.x.toFixed(num);
    point.y = +point.y.toFixed(num);
    point.z = +point.z.toFixed(num);
    return point;
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
                    }
                }
                else {
                    result.push({
                        polygon: new Polygon(f, polygon.shared),
                        type: "front"
                    });
                }
            }
            if (b.length >= 3) {
                if (b.length > 3) {
                    let newPolys = splitPolygonArr(b);
                    for (let npI = 0; npI < newPolys.length; npI++) {
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
                }
            }
            break;
    }
    if (result.length == 0) {
        result.push(returnPolygon);
    }
    return result;
}

function splitPolygonArr(arr) {
    let resultArr = [];


    if (arr.length > 4) {
        console.warn("[splitPolygonArr] arr.length > 4", arr.length);
        for (let j = 3; j <= arr.length; j++) {
            let result = [];
            result.push(arr[0].clone());
            result.push(arr[j - 2].clone());
            result.push(arr[j - 1].clone());
            resultArr.push(result);
        }
    }
    else {
        if (arr[0].pos.distanceTo(arr[2].pos) <= arr[1].pos.distanceTo(arr[3].pos)) {
            resultArr.push([arr[0].clone(), arr[1].clone(), arr[2].clone()],
                [arr[0].clone(), arr[2].clone(), arr[3].clone()]);
        }
        else {
            resultArr.push([arr[0].clone(), arr[1].clone(), arr[3].clone()],
                [arr[1].clone(), arr[2].clone(), arr[3].clone()]);
        }
        return resultArr;

    }

    return resultArr;
}

/*
Union:
1. Delete all polygons in A that are:
    a. inside and coplanar-back
    b. inside
2. Delete all polygons in B that are:
    a. inside and coplanar-back
    b. inside and coplanar-front
    c. inside
*/
OctreeCSG.union = function (octreeA, octreeB, buildTargetOctree = true) {
    let octree = new OctreeCSG();
    
    if (octreeA.box.intersectsBox(octreeB.box)) {
        let currentMeshSideA;
        let currentMeshSideB;
        if (octreeA.mesh) {
            currentMeshSideA = octreeA.mesh.material.side;
            octreeA.mesh.material.side = OctreeCSG.testSide;
        }
        if (octreeB.mesh) {
            currentMeshSideB = octreeB.mesh.material.side;
            octreeB.mesh.material.side = OctreeCSG.testSide;
        }

        octreeA.resetPolygons();
        octreeB.resetPolygons();

        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);

        handleIntersectingOctrees(octreeA, octreeB);
        octreeA.deletePolygonsByStateRules([
            {
                array: true,
                rule: ["inside", "coplanar-back"]
            },
            {
                array: false,
                rule: "inside"
            }
        ]);

        octreeB.deletePolygonsByStateRules([
            {
                array: true,
                rule: ["inside", "coplanar-back"]
            },
            {
                array: true,
                rule: ["inside", "coplanar-front"]
            },
            {
                array: false,
                rule: "inside"
            }
        ]);

        if (OctreeCSG.returnType == 0) {
            octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
            octreeB.getPolygonCallback(octree.addPolygon.bind(octree));
        }
        else if (OctreeCSG.returnType == -1) {
            console.log("OctreeA");
            let polys_test = octreeA.getPolygons();
            let limit = Math.min(polys_test.length, 50000);
            console.log(`[octreeA] polys_test`, polys_test.length, limit);
            let count = 0;
            for (let i = 0; i < limit; i++) {
                if (polys_test[i].intersects) {
                    let t = polys_test[i].triangle;
                    // if ((t.a.x <= 1) && (t.b.x <= 1) && (t.c.x <= 1)) {
                    //     if ((t.a.x >= -4) && (t.b.x >= -4) && (t.c.x >= -4)) {
                    // if ((t.a.y == -1) && (t.b.y == -1) && (t.c.y == -1)) {
                    // if ((t.a.z <= 4) && (t.b.z <= 4) && (t.c.z <= 4)) {
                    // if ((t.a.z > -5) && (t.b.z > -5) && (t.c.z > -5)) {
                    // console.log("AAAA", i, t, polys_test[i]);
                    octree.addPolygon(polys_test[i]);
                    count++;
                    // }
                    // }
                    // }
                    //     }
                    // }
                }
                // else {
                // octree.addPolygon(polys_test[i]);
                // }
            }
            console.log("AAAA ADDED COUNT", count);
        }
        else {
            console.log("OctreeB");
            let polys_test = octreeB.getPolygons();
            let limit = Math.min(polys_test.length, 50000);
            console.log(`[octreeB] polys_test`, polys_test.length, limit);
            let count = 0;
            for (let i = 0; i < limit; i++) {
                if (polys_test[i].intersects) {
                    // console.log(i, polys_test[i]);
                    let t = polys_test[i].triangle;
                    // if ((t.a.x <= 1) && (t.b.x <= 1) && (t.c.x <= 1)) {
                    //     if ((t.a.x >= -2) && (t.b.x >= -2) && (t.c.x >= -2)) {
                    // if ((t.a.y >= 3) && (t.b.y >= 3) && (t.c.y >= 3)) {
                    //     if ((t.a.z <= 1) && (t.b.z <= 1) && (t.c.z <= 1)) {
                    //         if ((t.a.z >= -2) && (t.b.z >= -2) && (t.c.z >= -2)) {
                    //             if (polys_test[i].checkAllStates("back")) {


                    // console.log("BBBB", i, t, polys_test[i]);
                    octree.addPolygon(polys_test[i]);
                    count++;
                    // }
                    //         }
                    //     }
                    // }
                }
                // else {
                // octree.addPolygon(polys_test[i]);
                // }
            }
            console.log("BBBB ADDED COUNT", count);
        }

        buildTargetOctree && octree.buildTree();
        if (octreeA.mesh) {
            if (octreeA.mesh.material.side !== currentMeshSideA) {
                octreeA.mesh.material.side = currentMeshSideA;
            }
        }
        if (octreeB.mesh) {
            if (octreeB.mesh.material.side !== currentMeshSideB) {
                octreeB.mesh.material.side = currentMeshSideB;
            }
        }

    }
    else {
        octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
        octreeB.getPolygonCallback(octree.addPolygon.bind(octree));
        buildTargetOctree && octree.buildTree();
    }

    return octree;
}

/*
Subtract: 
1. Delete all polygons in A that are:
    a. inside and coplanar-back
    b. inside and coplanar-front
    c. inside
2. Delete all polygons in B that are:
    a. outside and coplanar-back
    b. outside and coplanar-front
    c. inside and coplanar-front
    d. outside
*/
OctreeCSG.subtract = function (octreeA, octreeB, buildTargetOctree = true) {
    let octree = new OctreeCSG();
    if (octreeA.box.intersectsBox(octreeB.box)) {
        let currentMeshSideA;
        let currentMeshSideB;
        if (octreeA.mesh) {
            currentMeshSideA = octreeA.mesh.material.side;
            octreeA.mesh.material.side = OctreeCSG.testSide;
        }
        if (octreeB.mesh) {
            currentMeshSideB = octreeB.mesh.material.side;
            octreeB.mesh.material.side = OctreeCSG.testSide;
        }

        octreeA.resetPolygons();
        octreeB.resetPolygons();
        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);


        handleIntersectingOctrees(octreeA, octreeB);

        octreeA.deletePolygonsByStateRules([
            {
                array: true,
                rule: ["inside", "coplanar-back"]
            },
            {
                array: true,
                rule: ["inside", "coplanar-front"]
            },
            {
                array: false,
                rule: "inside"
            }
        ]);
        octreeB.deletePolygonsByStateRules([
            {
                array: true,
                rule: ["outside", "coplanar-back"]
            },
            {
                array: true,
                rule: ["outside", "coplanar-front"]
            },
            {
                array: true,
                rule: ["inside", "coplanar-front"]
            },
            {
                array: false,
                rule: "outside"
            }
        ]);


        octreeB.deletePolygonsByIntersection(false);


        octreeB.invert();


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
                    if (((t.a.y < -3) && (t.b.y < -3) && (t.c.y < -3))) {
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
            let limit = Math.min(polys_test.length, 50000);
            console.log(`[octreeB] polys_test`, polys_test.length, limit);
            for (let i = 0; i < limit; i++) {
                if (polys_test[i].intersects) {
                    let t = polys_test[i].triangle;
                    // if ((t.a.x <= 1) && (t.b.x <= 1) && (t.c.x <= 1)) {
                    // if (((t.a.y === -5) && (t.b.y === -5) && (t.c.y === -5))) {
                    //     console.log("BBBB", i, t, polys_test[i]);
                    octree.addPolygon(polys_test[i]);
                    // }
                }
                // else {
                // octree.addPolygon(polys_test[i]);
                // }
            }
        }

        if (octreeA.mesh) {
            if (octreeA.mesh.material.side !== currentMeshSideA) {
                octreeA.mesh.material.side = currentMeshSideA;
            }
        }
        if (octreeB.mesh) {
            if (octreeB.mesh.material.side !== currentMeshSideB) {
                octreeB.mesh.material.side = currentMeshSideB;
            }
        }
    }
    else {
        octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
    }

    buildTargetOctree && octree.buildTree();
    // octree.invert();
    return octree;
}

/*
Intersect: 
1. Delete all polygons in A that are:
    a. inside and coplanar-back
    b. outside and coplanar-front
    c. outside and coplanar-back
    d. outside
2. Delete all polygons in B that are:
    a. inside and coplanar-front
    b. inside and coplanar-back
    c. outside and coplanar-front
    d. outside and coplanar-back
    e. outside
*/
OctreeCSG.intersect = function (octreeA, octreeB, buildTargetOctree = true) {
    let octree = new OctreeCSG();
    if (octreeA.box.intersectsBox(octreeB.box)) {
        let currentMeshSideA;
        let currentMeshSideB;
        if (octreeA.mesh) {
            currentMeshSideA = octreeA.mesh.material.side;
            octreeA.mesh.material.side = OctreeCSG.testSide;
        }
        if (octreeB.mesh) {
            currentMeshSideB = octreeB.mesh.material.side;
            octreeB.mesh.material.side = OctreeCSG.testSide;
        }

        octreeA.resetPolygons();
        octreeB.resetPolygons();

        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);

        handleIntersectingOctrees(octreeA, octreeB);

        octreeA.deletePolygonsByStateRules([
            {
                array: true,
                rule: ["inside", "coplanar-back"]
            },
            {
                array: true,
                rule: ["outside", "coplanar-front"]
            },
            {
                array: true,
                rule: ["outside", "coplanar-back"]
            },
            {
                array: false,
                rule: "outside"
            }
        ]);

        octreeB.deletePolygonsByStateRules([
            {
                array: true,
                rule: ["inside", "coplanar-front"]
            },
            {
                array: true,
                rule: ["inside", "coplanar-back"]
            },
            {
                array: true,
                rule: ["outside", "coplanar-front"]
            },
            {
                array: true,
                rule: ["outside", "coplanar-back"]
            },
            {
                array: false,
                rule: "outside"
            }
        ]);
        octreeA.deletePolygonsByIntersection(false);
        octreeB.deletePolygonsByIntersection(false);

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
                    // if (((t.a.y < -3) && (t.b.y < -3) && (t.c.y < -3))) {
                    // if (((t.a.x >= 0.8) && (t.b.x >= 0.8) && (t.c.x >= 0.8))) {
                    // console.log("AAAA", i, t, polys_test[i]);
                    octree.addPolygon(polys_test[i]);
                    // }
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
                    let t = polys_test[i].triangle;
                    // if ((t.a.x <= 1) && (t.b.x <= 1) && (t.c.x <= 1)) {
                    // if (((t.a.y === -5) && (t.b.y === -5) && (t.c.y === -5))) {
                    // console.log("BBBB", i, t, polys_test[i]);
                    octree.addPolygon(polys_test[i]);
                    // }
                }
                // else {
                // octree.addPolygon(polys_test[i]);
                // }
            }
        }

        // let polys_test = octreeB.getPolygons();
        // let limit = Math.min(polys_test.length, 50);
        // for (let i = 0; i < limit; i++) {
        //     console.log(i, polys_test[i]);
        //     octree.addPolygon(polys_test[i]);
        // }

        if (octreeA.mesh) {
            if (octreeA.mesh.material.side !== currentMeshSideA) {
                octreeA.mesh.material.side = currentMeshSideA;
            }
        }
        if (octreeB.mesh) {
            if (octreeB.mesh.material.side !== currentMeshSideB) {
                octreeB.mesh.material.side = currentMeshSideB;
            }
        }
    }
    // else {
    //     octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
    // }
    buildTargetOctree && octree.buildTree();
    // octree.invert();
    return octree;
}

OctreeCSG.operation = function (obj, returnOctrees = false, buildTargetOctree = true, options = { objCounter: 0 }, firstRun = true) {
    // console.log("OctreeCSG.operation", obj);
    let octreeA, octreeB, resultOctree, material;
    if (obj.material) {
        material = obj.material;
    }
    if (obj.objA) {
        octreeA = handleObjectForOp(obj.objA, returnOctrees, buildTargetOctree, options);
        if (returnOctrees == true) {
            obj.objA = octreeA.original;
            octreeA = octreeA.result;
        }
    }
    if (obj.objB) {
        octreeB = handleObjectForOp(obj.objB, returnOctrees, buildTargetOctree, options);
        if (returnOctrees == true) {
            obj.objB = octreeB.original;
            octreeB = octreeB.result;
        }
    }
    switch (obj.op) {
        case 'union':
            resultOctree = OctreeCSG.union(octreeA, octreeB, buildTargetOctree);
            break;
        case 'subtract':
            resultOctree = OctreeCSG.subtract(octreeA, octreeB, buildTargetOctree);
            break;
        case 'intersect':
            resultOctree = OctreeCSG.intersect(octreeA, octreeB, buildTargetOctree);
            break;
    }
    if (firstRun && material) {
        let mesh = OctreeCSG.toMesh(resultOctree, material);
        return returnOctrees ? { result: mesh, operationTree: obj } : mesh;
    }
    if (firstRun && returnOctrees) {
        return { result: resultOctree, operationTree: obj };
    }
    return resultOctree;
}

// Work in progress
function handleObjectForOp(obj, returnOctrees, buildTargetOctree, options) {
    let returnObj;
    if (obj.isMesh) {
        returnObj = OctreeCSG.fromMesh(obj, options.objCounter++);
        if (returnOctrees) {
            returnObj = { result: returnObj, original: returnObj.clone() };
        }
    }
    else if (obj.isOctree) {
        returnObj = obj;
        if (returnOctrees) {
            returnObj = { result: obj, original: obj.clone() };
        }
    }
    else if (obj.op) {
        returnObj = OctreeCSG.operation(obj, returnOctrees, buildTargetOctree, options, false);
        if (returnOctrees) {
            returnObj = { result: returnObj, original: obj };
        }
    }

    return returnObj;
}

/*
// Work in progress
OctreeCSG.unionArray = function (objArr, buildTargetOctree = true) {
    // console.log("OctreeCSG.getRayPolys", OctreeCSG.getRayPolys);
    // console.log("OctreeCSG.useOctreeRay", OctreeCSG.useOctreeRay);
    // let polys = [];
    let octrees = [];
    for (let i = 0; i < objArr.length; i++) {
        let tempOctree = OctreeCSG.fromMesh(objArr[i]);
        tempOctree.octreeIndex = i;
        octrees.push(tempOctree);
    }
    let octree = new OctreeCSG();




    // let aPolygons = octreeA.getPolygons();
    // let bPolygons = octreeB.getPolygons();
    // let filterResults;
    if (octreeA.box.intersectsBox(octreeB.box)) {
        let trianglesSet = new Set();
        let currentMeshSideA;
        let currentMeshSideB;
        if (octreeA.mesh) {
            currentMeshSideA = octreeA.mesh.material.side;
            octreeA.mesh.material.side = OctreeCSG.testSide;
        }
        if (octreeB.mesh) {
            currentMeshSideB = octreeB.mesh.material.side;
            octreeB.mesh.material.side = OctreeCSG.testSide;
        }

        octreeA.resetPolygons();
        octreeB.resetPolygons();

        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);


        handleIntersectingOctrees(octreeA, octreeB);

        octreeA.deletePolygonsByStateRules([
            {
                array: true,
                rule: ["inside", "coplanar-back"]
            },
            {
                array: false,
                rule: "inside"
            }
        ]);

        // }

        octreeB.deletePolygonsByStateRules([
            {
                array: true,
                rule: ["inside", "coplanar-back"]
            },
            {
                array: true,
                rule: ["inside", "coplanar-front"]
            },
            {
                array: false,
                rule: "inside"
            }
        ]);

        octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
        octreeB.getPolygonCallback(octree.addPolygon.bind(octree));


        buildTargetOctree && octree.buildTree();
        if (octreeA.mesh) {
            if (octreeA.mesh.material.side !== currentMeshSideA) {
                octreeA.mesh.material.side = currentMeshSideA;
            }
        }
        if (octreeB.mesh) {
            if (octreeB.mesh.material.side !== currentMeshSideB) {
                octreeB.mesh.material.side = currentMeshSideB;
            }
        }

    }
    else {
        octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
        octreeB.getPolygonCallback(octree.addPolygon.bind(octree));
        buildTargetOctree && octree.buildTree();
    }

    return octree;
}
*/

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
const _normal1 = new Vector3();
const tmpm3 = new Matrix3();
const ttvv0 = new Vector3()

OctreeCSG.toGeometry = function (octree) {
    let polygons = octree.getPolygons();
    let validPolygons = [];
    let trianglesSet = new Set();
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
    trianglesSet.clear();
    trianglesSet = undefined;

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
    let octree = new OctreeCSG();
    octree.originalMatrixWorld = obj.matrixWorld.clone();
    obj.updateWorldMatrix(true, true);
    // obj.updateMatrixWorld();
    // obj.updateMatrix();
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
        if (isValidTriangle(polys[i].triangle)) {
            if (isNaN(polys[i].plane.normal.x)) {
                console.warn("polygon", i, "is NaN!!!!");
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

// OctreeCSG.meshToBuffers = function (obj, objectIndex) {
//     obj.updateWorldMatrix(true, true);
//     // let octree = new OctreeCSG();
//     let geometry = obj.geometry;
//     tmpm3.getNormalMatrix(obj.matrix);
//     let posattr = geometry.attributes.position;
//     let normalattr = geometry.attributes.normal;
//     let uvattr = geometry.attributes.uv;
//     let colorattr = geometry.attributes.color;
//     let groups = geometry.groups;
//     let index;
//     if (geometry.index)
//         index = geometry.index.array;
//     else {
//         index = new Array((posattr.array.length / posattr.itemSize) | 0);
//         for (let i = 0; i < index.length; i++)
//             index[i] = i;
//     }
//     // let triCount = (index.length / 3) | 0;
//     let polys = [];
//     // polys = new Array(triCount)
//     for (let i = 0, pli = 0, l = index.length; i < l; i += 3, pli++) {
//         let vertices = [];
//         for (let j = 0; j < 3; j++) {
//             let vi = index[i + j]
//             let vp = vi * 3;
//             let vt = vi * 2;
//             let pos = new Vector3(posattr.array[vp], posattr.array[vp + 1], posattr.array[vp + 2]);
//             let normal = new Vector3(normalattr.array[vp], normalattr.array[vp + 1], normalattr.array[vp + 2]);
//             pos.applyMatrix4(obj.matrix);
//             normal.applyMatrix3(tmpm3);
//             // v.applyMatrix4(obj.matrixWorld);
//             // vertices.push(v);
//             //     v2.applyMatrix4(obj.matrixWorld);
//             //     v3.applyMatrix4(obj.matrixWorld);
//             vertices.push(new Vertex(pos, normal, uvattr && { // uv
//                 x: uvattr.array[vt],
//                 y: uvattr.array[vt + 1]
//             }, colorattr && { x: colorattr.array[vt], y: colorattr.array[vt + 1], z: colorattr.array[vt + 2] }));
//         }
//         if ((objectIndex === undefined) && groups && groups.length > 0) {
//             let polygon;
//             for (let group of groups) {
//                 if ((index[i] >= group.start) && (index[i] < (group.start + group.count))) {
//                     polygon = new Polygon(vertices, group.materialIndex);
//                 }
//             }
//             if (polygon) {
//                 polys.push(polygon);
//             }

//         }
//         else {
//             polys.push(new Polygon(vertices, objectIndex));
//         }
//     }
//     return polys;
//     // for (let i = 0; i < polys.length; i++) {
//     //     octree.addPolygon(polys[i]);
//     // }
//     // // octree.addTriangle(newTriangle(v1, v2, v3));

//     // octree.buildTree();
//     // // return CSG.fromPolygons(polys.filter(p => !isNaN(p.plane.normal.x)));
//     // return octree;

// };

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






// OctreeCSG.addPolygonToMap = function (map, polygon, value) {
//     let mapValue = map.get(polygon) || [];
//     mapValue.push(value);
//     map.set(polygon, mapValue);
// }



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
        // this.constant;
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
    // distanceToPoint(point) {
    //     return this.normal.dot(point) - this.constant;
    // }

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
        this.triangle = new Triangle(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        this.triangle.midPoint = this.triangle.getMidpoint(new Vector3());

        // this.triangle.polygon = this;
        // this.plane.constant = this.plane.normal.dot(this.triangle.midPoint);
        // this.box = new Box3();
        // this.box.expandByPoint(this.triangle.a);
        // this.box.expandByPoint(this.triangle.b);
        // this.box.expandByPoint(this.triangle.c);
        // this.box.expandByScalar(EPSILON);

        // this.source = "new";
        this.intersects = false;
        this.state = "undecided";
        this.previousState = "undecided";
        this.previousStates = [];
        this.valid = true;
        this.coplanar = false;
        // this.original = true;
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
        let polygon = new Polygon(this.vertices.map(v => v.clone()), this.shared);
        polygon.intersects = this.intersects;
        polygon.valid = this.valid;
        return polygon;
    }
    flip() {
        this.vertices.reverse().forEach(v => v.flip());
        // _v3.copy(this.triangle.a);
        // this.triangle.a.copy(this.triangle.c);
        // this.triangle.c.copy(_v3);
        let tmp = this.triangle.a;
        this.triangle.a = this.triangle.c;
        this.triangle.c = tmp;
        this.plane.flip();
    }
    delete() {
        this.vertices.forEach(v => v.delete());
        this.vertices.length = 0;
        this.plane.delete();
        this.plane = undefined;
        this.triangle = undefined;
        this.shared = undefined;
        this.setInvalid();
    }
}




////
// Winding Number algorithm adapted from https://github.com/grame-cncm/faust/blob/master-dev/tools/physicalModeling/mesh2faust/vega/libraries/windingNumber/windingNumber.cpp
const _wV1 = new Vector3();
const _wV2 = new Vector3();
const _wV3 = new Vector3();
const _wP = new Vector3();
const _wP_EPS_ARR = [
    new Vector3(EPSILON, 0, 0),
    new Vector3(0, EPSILON, 0),
    new Vector3(0, 0, EPSILON),
    new Vector3(-EPSILON, 0, 0),
    new Vector3(0, -EPSILON, 0),
    new Vector3(0, 0, -EPSILON)
];
const _wP_EPS_ARR_COUNT = _wP_EPS_ARR.length;
const _matrix3 = new Matrix3();
const wNPI = 4 * Math.PI;

/*
// Replaced with buffer functions below
function calcWindingNumber(polygons, point) {
    let wN = 0;
    for (let i = 0; i < polygons.length; i++) {
        let pT = polygons[i].triangle;
        _wV1.subVectors(pT.a, point);
        _wV2.subVectors(pT.b, point);
        _wV3.subVectors(pT.c, point);
        let lenA = _wV1.length();
        let lenB = _wV2.length();
        let lenC = _wV3.length();
        _matrix3.set(_wV1.x, _wV1.y, _wV1.z, _wV2.x, _wV2.y, _wV2.z, _wV3.x, _wV3.y, _wV3.z);
        let omega = 2 * Math.atan2(_matrix3.determinant(), (lenA * lenB * lenC + _wV1.dot(_wV2) * lenC + _wV2.dot(_wV3) * lenA + _wV3.dot(_wV1) * lenB));
        wN += omega;
    }

    wN = Math.round(wN / wNPI);
    return wN;
}
function polyInside_WindingNumber(polygons, polygon, boundingBox) {
    let result = false;
    let point = polygon.triangle.midPoint;
    _wP.copy(point);
    let wN = calcWindingNumber(polygons, _wP);
    if (wN === 0) {
        if (polygon.coplanar) {
            for (let j = 0; j < _wP_EPS_ARR_COUNT; j++) {
                _wP.copy(point).add(_wP_EPS_ARR[j]);
                wN = calcWindingNumber(polygons, _wP);
                if (wN !== 0) {
                    result = true;
                    break;
                }
            }
        }
    }
    else {
        result = true;
    }

    return result;

}
*/


function returnXYZ(arr, index) {
    return { x: arr[index], y: arr[index + 1], z: arr[index + 2] };
}
function calcWindingNumber_buffer(trianglesArr, point) {
    let wN = 0;
    for (let i = 0; i < trianglesArr.length; i += 9) {
        _wV1.subVectors(returnXYZ(trianglesArr, i), point);
        _wV2.subVectors(returnXYZ(trianglesArr, i + 3), point);
        _wV3.subVectors(returnXYZ(trianglesArr, i + 6), point);
        let lenA = _wV1.length();
        let lenB = _wV2.length();
        let lenC = _wV3.length();
        _matrix3.set(_wV1.x, _wV1.y, _wV1.z, _wV2.x, _wV2.y, _wV2.z, _wV3.x, _wV3.y, _wV3.z);
        let omega = 2 * Math.atan2(_matrix3.determinant(), (lenA * lenB * lenC + _wV1.dot(_wV2) * lenC + _wV2.dot(_wV3) * lenA + _wV3.dot(_wV1) * lenB));
        wN += omega;
    }
    wN = Math.round(wN / wNPI);
    return wN;
}
function polyInside_WindingNumber_buffer(trianglesArr, point, coplanar) {
    let result = false;
    _wP.copy(point);
    let wN = calcWindingNumber_buffer(trianglesArr, _wP);
    if (wN === 0) {
        if (coplanar) {
            for (let j = 0; j < _wP_EPS_ARR_COUNT; j++) {
                _wP.copy(point).add(_wP_EPS_ARR[j]);
                wN = calcWindingNumber_buffer(trianglesArr, _wP);
                if (wN !== 0) {
                    result = true;
                    break;
                }
            }
        }
    }
    else {
        result = true;
    }

    return result;

}

/////



function handleIntersectingOctrees(octreeA, octreeB) {
    let octreeA_clone = octreeA.clone();
    let octreeA_buffer;
    let octreeB_buffer;
    if (OctreeCSG.useWindingNumber === true) {
        octreeA_buffer = prepareTriangleBuffer(octreeA_clone.getPolygons());
        octreeB_buffer = prepareTriangleBuffer(octreeB.getPolygons());
    }
    octreeA.handleIntersectingPolygons(octreeB, octreeB_buffer);
    octreeB.handleIntersectingPolygons(octreeA_clone, octreeA_buffer);
    octreeA_clone.delete();
    octreeA_clone = undefined;
    if (octreeA_buffer !== undefined) {
        octreeA_buffer = undefined;
        octreeB_buffer = undefined;
    }
}

OctreeCSG.subtract_async = async function (octreeA, octreeB, buildTargetOctree = true) {
    return new Promise(async (resolve, reject) => {
        try {
            if (workerPool.length < OctreeCSG.maxWebWorkers) {
                OctreeCSG.createWorkers();
            }
            let octree = new OctreeCSG();
            if (octreeA.box.intersectsBox(octreeB.box)) {
                let currentMeshSideA;
                let currentMeshSideB;
                if (octreeA.mesh) {
                    currentMeshSideA = octreeA.mesh.material.side;
                    octreeA.mesh.material.side = OctreeCSG.testSide;
                }
                if (octreeB.mesh) {
                    currentMeshSideB = octreeB.mesh.material.side;
                    octreeB.mesh.material.side = OctreeCSG.testSide;
                }

                octreeA.resetPolygons();
                octreeB.resetPolygons();
                octreeA.markIntesectingPolygons(octreeB);
                octreeB.markIntesectingPolygons(octreeA);
                let before = performance.now();
                console.log("[OctreeCSG.subtract_async] before", performance.now());
                // console.log("before sleep");
                // await sleep(1000);
                // console.log("after sleep");
                await handleIntersectingOctrees_async(octreeA, octreeB);
                console.log("[OctreeCSG.subtract_async] after", performance.now());

                octreeA.deletePolygonsByStateRules([
                    {
                        array: true,
                        rule: ["inside", "coplanar-back"]
                    },
                    {
                        array: true,
                        rule: ["inside", "coplanar-front"]
                    },
                    {
                        array: false,
                        rule: "inside"
                    }
                ]);
                octreeB.deletePolygonsByStateRules([
                    {
                        array: true,
                        rule: ["outside", "coplanar-back"]
                    },
                    {
                        array: true,
                        rule: ["outside", "coplanar-front"]
                    },
                    {
                        array: true,
                        rule: ["inside", "coplanar-front"]
                    },
                    {
                        array: false,
                        rule: "outside"
                    }
                ]);


                octreeB.deletePolygonsByIntersection(false);


                octreeB.invert();

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
                            // if (((t.a.y < -3) && (t.b.y < -3) && (t.c.y < -3))) {
                            // if (((t.a.x >= 0.8) && (t.b.x >= 0.8) && (t.c.x >= 0.8))) {
                            // console.log("AAAA", i, t, polys_test[i]);
                            octree.addPolygon(polys_test[i]);
                            // }
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
                            let t = polys_test[i].triangle;
                            // if ((t.a.x <= 1) && (t.b.x <= 1) && (t.c.x <= 1)) {
                            // if (((t.a.y === -5) && (t.b.y === -5) && (t.c.y === -5))) {
                            //     console.log("BBBB", i, t, polys_test[i]);
                            octree.addPolygon(polys_test[i]);
                            // }
                        }
                        // else {
                        // octree.addPolygon(polys_test[i]);
                        // }
                    }
                }

                if (octreeA.mesh) {
                    if (octreeA.mesh.material.side !== currentMeshSideA) {
                        octreeA.mesh.material.side = currentMeshSideA;
                    }
                }
                if (octreeB.mesh) {
                    if (octreeB.mesh.material.side !== currentMeshSideB) {
                        octreeB.mesh.material.side = currentMeshSideB;
                    }
                }
            }
            else {
                octreeA.getPolygonCallback(octree.addPolygon.bind(octree));
            }

            buildTargetOctree && octree.buildTree();
            // octree.invert();
            resolve(octree);
        }
        catch (e) {
            reject(e);
        }
    });
}

async function handleIntersectingOctrees_async(octreeA, octreeB) {
    return new Promise(async (resolve, reject) => {
        try {
            const original_useWindingNumber = OctreeCSG.useWindingNumber;
            OctreeCSG.useWindingNumber = true;
            let octreeA_clone = octreeA.clone();
            // let octreeA_polygons;
            // let octreeB_polygons;
            let octreeA_buffer;
            let octreeB_buffer;
            if (OctreeCSG.useWindingNumber === true) {
                octreeA_buffer = prepareTriangleBuffer(octreeA_clone.getPolygons());
                octreeB_buffer = prepareTriangleBuffer(octreeB.getPolygons());
            }
            // console.log("[handleIntersectingOctrees_async] before");
            // await octreeA.handleIntersectingPolygons_async(octreeB, octreeB_buffer);
            octreeA.handleIntersectingPolygons_reduced(octreeB, octreeB_buffer);
            // console.log("[handleIntersectingOctrees_async] before 2");
            await handleInsideOutsidePolygons_async(octreeA, octreeB, octreeB_buffer);
            // console.log("[handleIntersectingOctrees_async] before 3");
            // await octreeB.handleIntersectingPolygons_async(octreeA_clone, octreeA_buffer);
            octreeB.handleIntersectingPolygons_reduced(octreeA_clone, octreeA_buffer);
            // console.log("[handleIntersectingOctrees_async] before 4");
            await handleInsideOutsidePolygons_async(octreeB, octreeA_clone, octreeA_buffer);
            // console.log("[handleIntersectingOctrees_async] after");
            octreeA_clone.delete();
            octreeA_clone = undefined;

            if (octreeA_buffer !== undefined) {
                octreeA_buffer = undefined;
                octreeB_buffer = undefined;
            }
            OctreeCSG.useWindingNumber = original_useWindingNumber;
            resolve();
        }
        catch (e) {
            reject(e)
        }
    });
}

async function handleInsideOutsidePolygons_async(octree, targetOctree, targetOctreeBuffer) {
    return new Promise(async (resolve, reject) => {
        try {
            // polygonStack = this.polygons.filter(polygon => (polygon.valid == true) && (polygon.intersects == true));
            let polygonStack = octree.getIntersectingPolygons();
            let runningWebWorkers = [];
            let currentPolygon = polygonStack.pop();
            while (currentPolygon) {
                // console.warn("Checking loop polygon id", currentPolygon.id);
                if (!currentPolygon.valid) {
                    continue;
                }

                let debugPoly = false;

                // let testTriangle = new THREE.Triangle(new THREE.Vector3(0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(-0.29171404242515564, -4.110300540924072, 2.832019329071045), new THREE.Vector3(0, -4.3809967041015625, 2.4097442626953125));
                // if ((OctreeCSG.returnType == -1) && (currentPolygon.triangle.equals(testTriangle))) {
                //     debugPoly = true;
                //     console.warn("STARTING DEBUG");
                // }
                OctreeCSG.debugPoly = debugPoly;
                let inside = false;
                if (targetOctree.box.containsPoint(currentPolygon.triangle.midPoint)) {
                    // if (OctreeCSG.useWindingNumber === true) {
                    // let responses = [];
                    // // let result1 = OctreeCSG.testWorker(1);
                    // // let result2 = OctreeCSG.testWorker(2);
                    let worker = getAvailableWorker();
                    while (!worker) {
                        // console.log("Waiting for worker");
                        await sleep(1);
                        worker = getAvailableWorker();
                    }

                    worker.checkWindingNumber({
                        type: 'windingNumber',
                        point: currentPolygon.triangle.midPoint,
                        coplanar: currentPolygon.coplanar,
                        polygonID: currentPolygon.id,
                        triangles: targetOctreeBuffer
                    }, currentPolygon).then(worker => {
                        // console.log("Worker finished", worker.id);
                        let workerIndex = runningWebWorkers.indexOf(worker);
                        if (workerIndex > -1) {
                            runningWebWorkers.splice(workerIndex, 1);
                        }
                    });
                    runningWebWorkers.push(worker);

                }
                else {
                    currentPolygon.setState("outside");
                }

                // if (debugPoly) {
                //     console.log("CHECK INSIDE", inside);
                // }
                // if (inside === true) {
                //     currentPolygon.setState("inside");
                // }
                // else {
                //     currentPolygon.setState("outside");
                // }

                currentPolygon = polygonStack.pop();
            }
            // console.log("START WAITING", runningWebWorkers.length);
            while (runningWebWorkers.length) {
                // console.log("Waiting to finish");
                await sleep(1);
            }
            resolve();
        }
        catch (e) {
            reject(e);
        }
    });
}

// OctreeCSG.prepareTriangleBuffer = function (polygons) {
//     return prepareTriangleBuffer(polygons);
// }

// {message: data, data: buff}
// OctreeCSG.runWorker = async function (data, transferables) {

function prepareTriangleBuffer(polygons) {
    let numOfTriangles = polygons.length;
    // let buffer = new ArrayBuffer(numOfTriangles * 3 * 3 * 4);
    // let array = new Float32Array(buffer);
    let array = new Float32Array(numOfTriangles * 3 * 3);
    let bufferIndex = 0;
    for (let i = 0; i < numOfTriangles; i++) {
        let triangle = polygons[i].triangle;
        array[bufferIndex++] = triangle.a.x;
        array[bufferIndex++] = triangle.a.y;
        array[bufferIndex++] = triangle.a.z;
        array[bufferIndex++] = triangle.b.x;
        array[bufferIndex++] = triangle.b.y;
        array[bufferIndex++] = triangle.b.z;
        array[bufferIndex++] = triangle.c.x;
        array[bufferIndex++] = triangle.c.y;
        array[bufferIndex++] = triangle.c.z;
    }
    // return buffer;
    return array;
}
OctreeCSG.prepareTriangleBuffer = prepareTriangleBuffer;
const workerPool = [];
OctreeCSG.useWebWorkers = false;
OctreeCSG.useWebWorkersSync = true;
OctreeCSG.maxWebWorkers = navigator.hardwareConcurrency || 4;
OctreeCSG.createWorkers = function () {
    let max = OctreeCSG.maxWebWorkers - workerPool.length;
    for (let i = 0; i < max; i++) {
        OctreeCSG.createWorker();
    }
}
OctreeCSG.getWorkerPool = function () { // FOR TESTING ONLY - WILL BE DELETED BEFORE PROD
    return workerPool;
}
function getAvailableWorker() {
    for (let i = 0; i < workerPool.length; i++) {
        if (!workerPool[i].running) {
            return workerPool[i];
        }
    }
    return;
}
OctreeCSG.createWorker = function () {
    let worker = new GenerateWebWorker();
    workerPool.push(worker);
    return worker;
}
OctreeCSG.testWorker2 = function (data) {
    console.log("OctreeCSG.testWorker2");
    let result = OctreeCSG.testWorker4(data);
    console.log("OctreeCSG.testWorker2", result);
    return result;
    // // let worker = new Worker('./js/OctreeCSG/OctreeCSG.worker.js');
    // let worker = new Worker(new URL('./OctreeCSG.worker.js', import.meta.url), { type: 'module' });
    // worker.onerror = (e) => {
    //     console.log(e);
    // }
    // worker.onmessage = (e) => {
    //     console.log("INC DATA:", e.data);
    // }
    // worker.postMessage("A");

}
OctreeCSG.testWorker4 = function (data) {
    console.log("OctreeCSG.testWorker4");
    let result = OctreeCSG.testWorker3(data);
    console.log("OctreeCSG.testWorker4", result);
    return result;
}
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
OctreeCSG.testWorker3 = async function (data) {
    console.log("OctreeCSG.testWorker3");
    let responses = [];
    // let result1 = OctreeCSG.testWorker(1);
    // let result2 = OctreeCSG.testWorker(2);
    let worker = getAvailableWorker();
    if (!worker) {
        console.warn("no available workers");
        return;
    }
    console.log("testing worker");
    worker.sendMessage(data).then(data => responses.push(data));
    let worker2 = getAvailableWorker();
    if (!worker2) {
        console.warn("no available workers");
        return;
    }
    console.log("testing worker 2");
    worker2.sendMessage(data).then(data => responses.push(data));
    while (responses.length < 2) {
        console.log("responses not received", responses.length, performance.now());
        await sleep(500);
    }
    console.log("got response:", responses);
    return responses;
}
// OctreeCSG.sendToWorker = async function (data) {
OctreeCSG.testWorker = async function (data) {
    console.log("OctreeCSG.testWorker");
    let worker = getAvailableWorker();
    if (!worker) {
        console.warn("no available workers");
        return;
    }
    console.log("testing worker");
    let result = await worker.sendMessage(data);
    console.log("got response:", result);
    // worker.sendMessage(data).then(workerCB, (msg) => {
    //     console.log("ERR", msg);
    // });
    return result;
}
OctreeCSG.runWorker = async function (data, transferables) {
    let worker = getAvailableWorker();
    if (!worker) {
        console.warn("no available workers");
        return;
    }
    // console.log("testing worker");
    let result = await worker.sendMessage(data, transferables);
    // console.log("got response:", result);
    // worker.sendMessage(data).then(workerCB, (msg) => {
    //     console.log("ERR", msg);
    // });
    return result;
}
function workerCB() {
    console.log("CALLBACK", arguments);
}

let webWorker_ID = 0;
class GenerateWebWorker {
    constructor() {
        this.running = false;
        this.worker = new Worker(new URL('./OctreeCSG.worker.js', import.meta.url), { type: 'module' });
        this.worker.onerror = (e) => {
            if (e.message) {
                throw new Error(`[OctreeCSG] GenerateWebWorker: Could not create a web worker with the error "${e.message}"`);
            }
            else {
                throw new Error(`[OctreeCSG] GenerateWebWorker: Could not create a web worker, no error message was provided.`);
            }
        }
        this.id = webWorker_ID++;
    }
    checkWindingNumber(data, currentPolygon) {
        // worker.checkWindingNumber({
        //     type: windingNumber,
        //     point: currentPolygon.triangle.midPoint,
        //     coplanar: currentPolygon.coplanar,
        //     polygonID: currentPolygon.id,
        //     triangles: targetOctreeBuffer
        // }, currentPolygon)
        if (this.running) {
            throw new Error(`[GenerateWebWorker] checkWindingNumber: Worker is already running`);
        }
        if (this.worker === null) {
            throw new Error(`[GenerateWebWorker] checkWindingNumber: Worker has beein disposed`);
        }
        this.running = true;
        const { worker } = this;
        return new Promise((resolve, reject) => {
            try {
                worker.onerror = (e) => {
                    reject(new Error(`[GenerateWebWorker] checkWindingNumber: ${e.message}`));
                    this.running = false;
                    worker.onmessage = null;
                }
                worker.onmessage = (e) => {
                    const { data } = e;
                    if (data.error) {
                        reject(new Error(data.error));
                        worker.onmessage = null;
                    }
                    if ((data.type === 'windingNumber') && currentPolygon) {
                        if (data.result === true) {
                            currentPolygon.setState("inside");
                        }
                        else {
                            currentPolygon.setState("outside");
                        }
                        resolve(this);
                    }
                    else {
                        resolve(data);
                    }
                    this.running = false;
                    worker.onmessage = null;
                }
                // console.log("GOT HERE?", worker);
                // let numOfObjects = 1;
                // let buff = new ArrayBuffer(numOfObjects * 4);
                // let test = new Float32Array(buff);
                // test[0] = 7;
                // {message: data, data: buff}
                worker.postMessage(data);
            }
            catch (e) {
                reject(e);
                worker.onmessage = null;
            }

        });
    }
    sendMessage(data, transferables, currentPolygon) {
        if (this.running) {
            throw new Error(`[GenerateWebWorker] sendMessage: Worker is already running`);
        }
        if (this.worker === null) {
            throw new Error(`[GenerateWebWorker] sendMessage: Worker has beein disposed`);
        }
        this.running = true;
        const { worker } = this;
        return new Promise((resolve, reject) => {
            try {
                worker.onerror = (e) => {
                    reject(new Error(`[GenerateWebWorker] sendMessage: ${e.message}`));
                    // reject(e);
                    this.running = false;
                    worker.onmessage = null;
                }
                worker.onmessage = (e) => {
                    // console.log("INC DATA:", e);
                    const { data } = e;
                    if (data.error) {
                        reject(new Error(data.error));
                        worker.onmessage = null;
                    }
                    resolve(data);
                    this.running = false;
                    worker.onmessage = null;
                }
                // console.log("GOT HERE?", worker);
                // let numOfObjects = 1;
                // let buff = new ArrayBuffer(numOfObjects * 4);
                // let test = new Float32Array(buff);
                // test[0] = 7;
                // {message: data, data: buff}
                worker.postMessage(data, transferables);
            }
            catch (e) {
                reject(e);
                worker.onmessage = null;
            }

        });
    }
    dispose() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = undefined;
            let workerIndex = workerPool.indexOf(this);
            if (workerIndex > -1) {
                workerPool.splice(workerIndex, 1);
            }
        }
    }
}



////////
// https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
const edge1 = new Vector3();
const edge2 = new Vector3();
const h = new Vector3();
const s = new Vector3();
const q = new Vector3();
function rayIntersectsTriangle(ray, triangle, target = new Vector3()) {
    

    const EPSILON = 0.0000001;
    edge1.subVectors(triangle.b, triangle.a);
    edge2.subVectors(triangle.c, triangle.a);
    h.crossVectors(ray.direction, edge2);
    let a = edge1.dot(h);
    if (a > -EPSILON && a < EPSILON) {
        return null; // Ray is parallel to the triangle
    }
    let f = 1 / a;
    s.subVectors(ray.origin, triangle.a);
    let u = f * s.dot(h);
    if (u < 0 || u > 1) {
        return null;
    }
    q.crossVectors(s, edge1);
    let v = f * ray.direction.dot(q);
    if (v < 0 || u + v > 1) {
        return null;
    }
    // Check where intersection is
    let t = f * edge2.dot(q);
    if (t > EPSILON) {
        return target.copy(ray.direction).multiplyScalar(t).add(ray.origin);
    }
    // else {
    return null;
    // }
}
OctreeCSG.rayIntersectsTriangle = rayIntersectsTriangle;
////////
OctreeCSG.returnType = 0;

OctreeCSG.testSide = DoubleSide;
OctreeCSG.useOctreeRay = true;
OctreeCSG.getRayPolys = true;
OctreeCSG.useWindingNumber = false;
OctreeCSG.rayIntersectTriangleType = "MollerTrumbore"; // "regular" (three.js' ray.intersectTriangle; "MollerTrumbore" (Moller Trumbore algorithm);


OctreeCSG.debugPoly = false;
OctreeCSG.useWindingNumberTurbo = false;
OctreeCSG.useGDTest = false;

////



// TODO: test max level 10 and (min) polys per tree 100 or 200
OctreeCSG.maxLevel = 16;
OctreeCSG.polygonsPerTree = 100;

OctreeCSG.Polygon = Polygon;
export default OctreeCSG;