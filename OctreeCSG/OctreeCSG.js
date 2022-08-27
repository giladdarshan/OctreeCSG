import { Vector2, Vector3, Box3, DoubleSide, Matrix3, Matrix4, Ray, Triangle, BufferGeometry, BufferAttribute, Mesh, Raycaster } from 'three';
import { checkTrianglesIntersection } from './three-triangle-intersection.js';

const _v1 = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();
const _box3$1 = new Box3();

const tv0 = new Vector3();
const tv1 = new Vector3();
const _raycaster1 = new Raycaster();
const _ray = new Ray();
const _rayDirection = new Vector3(0, 0, 1);


const EPSILON = 1e-5;
const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;
let _polygonID = 0;

class OctreeCSG {
    constructor(box, parent) {
        this.polygons = [];
        this.replacedPolygons = [];
        this.mesh;
        this.originalMatrixWorld;
        this.box = box;
        this.subTrees = [];
        this.parent = parent;
        this.level = 0;
        // this.isOctree = true;
    }
    clone() {
        return new this.constructor().copy(this);
    }

    copy(source) {
        this.polygons = source.polygons.map(p => p.clone());
        this.replacedPolygons = source.replacedPolygons.map(p => p.clone());
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

    newOctree(box, parent) {
        return new this.constructor(box, parent);
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
                    subTrees.push(this.newOctree(box, this));
                }
            }
        }

        let polygon;
        while (polygon = this.polygons.pop()) {
            let found = false;
            for (let i = 0; i < subTrees.length; i++) {
                if (subTrees[i].box.containsPoint(polygon.getMidpoint())) {
                    subTrees[i].polygons.push(polygon);
                    found = true;
                }

            }
            if (!found) {
                console.error("ERROR: unable to find subtree for:", polygon.triangle);
                throw new Error(`Unable to find subtree for triangle at level ${level}`);
            }

        }

        for (let i = 0; i < subTrees.length; i++) {
            subTrees[i].level = level + 1;
            const len = subTrees[i].polygons.length;

            // if (len !== 0) {
            if (len > OctreeCSG.polygonsPerTree && level < OctreeCSG.maxLevel) {
                subTrees[i].split(level + 1);

            }
            this.subTrees.push(subTrees[i]);
            // }
        }

        return this;
    }

    buildTree() {
        this.calcBox();
        this.split(0);
        this.processTree();

        return this;

    }
    processTree() {
        if (!this.isEmpty()) {
            _box3$1.copy(this.box);
            for (let i = 0; i < this.polygons.length; i++) {
                this.box.expandByPoint(this.polygons[i].triangle.a);
                this.box.expandByPoint(this.polygons[i].triangle.b);
                this.box.expandByPoint(this.polygons[i].triangle.c);
            }
            this.expandParentBox();
        }
        for (let i = 0; i < this.subTrees.length; i++) {
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

    getPolygonsIntersectingPolygon(targetPolygon, polygons = []) {
        if (this.box.intersectsTriangle(targetPolygon.triangle)) {
            if (this.polygons.length > 0) {
                let allPolygons = this.polygons.slice();
                if (this.replacedPolygons.length > 0) {
                    for (let i = 0; i < this.replacedPolygons.length; i++) {
                        allPolygons.push(this.replacedPolygons[i]);
                    }
                }
                for (let i = 0; i < allPolygons.length; i++) {
                    let polygon = allPolygons[i];

                    if (!polygon.originalValid || !polygon.valid || !polygon.intersects) {
                        continue;
                    }

                    if (checkTrianglesIntersection(targetPolygon.triangle, polygon.triangle)) {
                        polygons.push(polygon);
                    }
                }
            }
        }

        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getPolygonsIntersectingPolygon(targetPolygon, polygons);
        }

        return polygons;
    }


    getRayPolygons(ray, polygons = []) {
        if (this.polygons.length > 0) {
            for (let i = 0; i < this.polygons.length; i++) {
                if (this.polygons[i].valid && this.polygons[i].originalValid) {
                    if (polygons.indexOf(this.polygons[i]) === -1) {
                        polygons.push(this.polygons[i]);
                    }
                }
            }
        }
        if (this.replacedPolygons.length > 0) {
            polygons.push(...this.replacedPolygons);
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            if (ray.intersectsBox(this.subTrees[i].box)) {
                this.subTrees[i].getRayPolygons(ray, polygons);
            }
        }

        return polygons;
    }

    rayIntersect(ray, matrixWorld, intersects = []) {
        if (ray.direction.length() === 0) return [];

        let distance = 1e100;
        let polygons = this.getRayPolygons(ray);

        for (let i = 0; i < polygons.length; i++) {
            let result;
            if (OctreeCSG.rayIntersectTriangleType === "regular") {
                result = ray.intersectTriangle(polygons[i].triangle.a, polygons[i].triangle.b, polygons[i].triangle.c, false, _v1); //double
                if (result) {
                    _v1.applyMatrix4(matrixWorld);
                    distance = _v1.distanceTo(ray.origin);
                    if (distance < 0 || distance > Infinity) {
                        console.warn("[rayIntersect] Failed ray distance check", ray);
                    }
                    else {
                        intersects.push({ distance: distance, polygon: polygons[i], position: _v1.clone() });
                    }
                }
            }
            else { // MollerTrumbore
                result = rayIntersectsTriangle(ray, polygons[i].triangle, _v1);
                if (result) {
                    const newdistance = result.clone().sub(ray.origin).length();
                    if (distance > newdistance) {
                        distance = newdistance;
                    }
                    if (distance < 1e100) {
                        intersects.push({ distance: distance, polygon: polygons[i], position: result.clone().add(ray.origin) });
                    }
                }
            }
        }

        intersects.length && intersects.sort(raycastIntersectAscSort);
        return intersects;
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
                    if (polygons.indexOf(this.polygons[i]) === -1) {
                        polygons.push(this.polygons[i]);
                    }
                }

            }
        }


        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getPolygons(polygons);
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

    replacePolygon(polygon, newPolygons) {
        if (!Array.isArray(newPolygons)) {
            newPolygons = [newPolygons];
        }
        if (this.polygons.length > 0) {
            let polygonIndex = this.polygons.indexOf(polygon);
            if (polygonIndex > -1) {
                if (polygon.originalValid === true) {
                    this.replacedPolygons.push(polygon);
                }
                else {
                    polygon.setInvalid();
                }


                this.polygons.splice(polygonIndex, 1, ...newPolygons);
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].replacePolygon(polygon, newPolygons);
        }

    }


    deletePolygonsByStateRules(rulesArr, firstRun = true) {
        if (this.polygons.length > 0) {
            let polygonArr = this.polygons.filter(polygon => (polygon.valid == true) && (polygon.intersects == true));
            polygonArr.forEach(polygon => {
                let found = false;
                for (let j = 0; j < rulesArr.length; j++) {
                    if (rulesArr[j].array) {
                        let states = rulesArr[j].rule;
                        if ((states.includes(polygon.state)) && (((polygon.previousState !== "undecided") && (states.includes(polygon.previousState))) || (polygon.previousState == "undecided"))) {
                            found = true;
                            let statesObj = {};
                            let mainStatesObj = {};
                            states.forEach(state => statesObj[state] = false);
                            states.forEach(state => mainStatesObj[state] = false);
                            statesObj[polygon.state] = true;
                            for (let i = 0; i < polygon.previousStates.length; i++) {
                                if (!states.includes(polygon.previousStates[i])) { // if previous state not one of provided states (not included in states array), break
                                    found = false;
                                    break;
                                }
                                else {
                                    statesObj[polygon.previousStates[i]] = true;
                                }
                            }
                            if (found) {
                                for (let state in statesObj) {
                                    if (statesObj[state] === false) {
                                        found = false;
                                        break;
                                    }
                                }

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
                    let polygonIndex = this.polygons.indexOf(polygon);
                    if (polygonIndex > -1) {
                        polygon.setInvalid();
                        this.polygons.splice(polygonIndex, 1);
                    }

                    if (firstRun) {
                        polygon.delete();
                    }
                }
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].deletePolygonsByStateRules(rulesArr, false);
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
                        }

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

        return true;
    }
    markIntesectingPolygons(targetOctree) {
        if (this.polygons.length > 0) {
            this.polygons.forEach(polygon => {
                polygon.intersects = targetOctree.isPolygonIntersecting(polygon);
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].markIntesectingPolygons(targetOctree);
        }
    }

    resetPolygons(resetOriginal = true) {
        if (this.polygons.length > 0) {
            this.polygons.forEach(polygon => {
                polygon.reset(resetOriginal);
            });
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].resetPolygons(resetOriginal);
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

                let targetPolygons = targetOctree.getPolygonsIntersectingPolygon(currentPolygon);
                if (targetPolygons.length > 0) {
                    for (let j = 0; j < targetPolygons.length; j++) {
                        let target = targetPolygons[j];
                        let splitResults = splitPolygonByPlane(currentPolygon, target.plane);
                        if (splitResults.length > 1) {
                            for (let i = 0; i < splitResults.length; i++) {
                                let polygon = splitResults[i].polygon;
                                polygon.intersects = currentPolygon.intersects;
                                polygon.newPolygon = true;
                                polygonStack.push(polygon);
                            }
                            this.replacePolygon(currentPolygon, splitResults.map(result => result.polygon));
                            break;
                        }
                        else {
                            if (currentPolygon.id !== splitResults[0].polygon.id) {
                                splitResults[0].polygon.intersects = currentPolygon.intersects;
                                splitResults[0].polygon.newPolygon = true;
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

                currentPolygon = polygonStack.pop();
            }

            polygonStack = this.polygons.filter(polygon => (polygon.valid == true) && (polygon.intersects == true));
            currentPolygon = polygonStack.pop();
            let inside = false;
            while (currentPolygon) {
                if (!currentPolygon.valid) {
                    continue;
                }

                inside = false;
                if (targetOctree.box.containsPoint(currentPolygon.getMidpoint())) {
                    if (OctreeCSG.useWindingNumber === true) {
                        inside = polyInside_WindingNumber_buffer(targetOctreeBuffer, currentPolygon.getMidpoint(), currentPolygon.coplanar);
                    }
                    else {
                        let point = pointRounding(_v2.copy(currentPolygon.getMidpoint()));

                        if (OctreeCSG.useOctreeRay !== true && targetOctree.mesh) {
                            _rayDirection.copy(currentPolygon.plane.normal);
                            _raycaster1.set(point, _rayDirection);

                            let intersects = _raycaster1.intersectObject(targetOctree.mesh);
                            if (intersects.length) {
                                if (_rayDirection.dot(intersects[0].face.normal) > 0) {
                                    inside = true;
                                }
                            }
                            if (!inside && currentPolygon.coplanar) {
                                for (let j = 0; j < _wP_EPS_ARR_COUNT; j++) {
                                    _raycaster1.ray.origin.copy(point).add(_wP_EPS_ARR[j]);

                                    let intersects = _raycaster1.intersectObject(targetOctree.mesh);
                                    if (intersects.length) {
                                        if (_rayDirection.dot(intersects[0].face.normal) > 0) {
                                            inside = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            _ray.origin.copy(point);
                            _rayDirection.copy(currentPolygon.plane.normal);
                            _ray.direction.copy(currentPolygon.plane.normal);

                            let intersects = targetOctree.rayIntersect(_ray, targetOctree.originalMatrixWorld);
                            if (intersects.length) {
                                if (_rayDirection.dot(intersects[0].polygon.plane.normal) > 0) {
                                    inside = true;
                                }
                            }
                            if (!inside && currentPolygon.coplanar) {
                                for (let j = 0; j < _wP_EPS_ARR_COUNT; j++) {
                                    _ray.origin.copy(point).add(_wP_EPS_ARR[j]);
                                    _rayDirection.copy(currentPolygon.plane.normal);
                                    _ray.direction.copy(currentPolygon.plane.normal);
                                    let intersects = targetOctree.rayIntersect(_ray, targetOctree.originalMatrixWorld);
                                    if (intersects.length) {
                                        if (_rayDirection.dot(intersects[0].polygon.plane.normal) > 0) {
                                            inside = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
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

    delete(deletePolygons = true) {
        if (this.polygons.length > 0 && deletePolygons) {
            this.polygons.forEach(p => p.delete());
            this.polygons.length = 0;
        }
        if (this.replacedPolygons.length > 0 && deletePolygons) {
            this.replacedPolygons.forEach(p => p.delete());
            this.replacedPolygons.length = 0;
        }

        if (this.subTrees.length) {
            for (let i = 0; i < this.subTrees.length; i++) {
                this.subTrees[i].delete(deletePolygons);
            }
            this.subTrees.length = 0;
        }
        this.mesh = undefined;
        this.originalMatrixWorld = undefined;
        this.box = undefined;
        this.parent = undefined;
        this.level = undefined;
    }
    getPolygonCloneCallback(cbFunc) {
        if (this.polygons.length > 0) {
            for (let i = 0; i < this.polygons.length; i++) {
                if (this.polygons[i].valid) {
                    cbFunc(this.polygons[i].clone());
                }
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].getPolygonCloneCallback(cbFunc);
        }
    }
    deleteReplacedPolygons() {
        if (this.replacedPolygons.length > 0) {
            this.replacedPolygons.forEach(p => p.delete());
            this.replacedPolygons.length = 0;
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].deleteReplacedPolygons();
        }
    }
    markPolygonsAsOriginal() {
        if (this.polygons.length > 0) {
            this.polygons.forEach(p => p.originalValid = true);
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].markPolygonsAsOriginal();
        }
    }
    applyMatrix(matrix, normalMatrix, firstRun = true) {
        if (matrix.isMesh) {
            matrix.updateMatrix();
            matrix = matrix.matrix;
        }
        this.box.makeEmpty();
        normalMatrix = normalMatrix || tmpm3.getNormalMatrix(matrix);
        if (this.polygons.length > 0) {
            for (let i = 0; i < this.polygons.length; i++) {
                if (this.polygons[i].valid) {
                    this.polygons[i].applyMatrix(matrix, normalMatrix);
                }
            }
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].applyMatrix(matrix, normalMatrix, false);
        }
        if (firstRun) {
            this.processTree();
        }
    }
    setPolygonIndex(index) {
        if (index === undefined) {
            return;
        }
        if (this.polygons.length > 0) {
            this.polygons.forEach(p => p.shared = index);
        }
        for (let i = 0; i < this.subTrees.length; i++) {
            this.subTrees[i].setPolygonIndex(index);
        }
    }
}
OctreeCSG.prototype.isOctree = true;

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


const CSG_Rules = {
    union: {
        a: [
            {
                array: true,
                rule: ["inside", "coplanar-back"]
            },
            {
                array: false,
                rule: "inside"
            }
        ],
        b: [
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
        ]
    },
    subtract: {
        a: [
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
        ],
        b: [
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
        ]
    },
    intersect: {
        a: [
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
        ],
        b: [
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
        ]
    }
};
// class OctreeCSG { };


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
            octreeA.mesh.material.side = DoubleSide;
        }
        if (octreeB.mesh) {
            currentMeshSideB = octreeB.mesh.material.side;
            octreeB.mesh.material.side = DoubleSide;
        }

        octreeA.resetPolygons(false);
        octreeB.resetPolygons(false);

        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);

        handleIntersectingOctrees(octreeA, octreeB);
        octreeA.deleteReplacedPolygons();
        octreeB.deleteReplacedPolygons();



        octreeA.deletePolygonsByStateRules(CSG_Rules.union.a);
        octreeB.deletePolygonsByStateRules(CSG_Rules.union.b);


        octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree));
        octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree));

        octree.markPolygonsAsOriginal();
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
        octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree));
        octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree));
        octree.markPolygonsAsOriginal();
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
            octreeA.mesh.material.side = DoubleSide;
        }
        if (octreeB.mesh) {
            currentMeshSideB = octreeB.mesh.material.side;
            octreeB.mesh.material.side = DoubleSide;
        }

        octreeA.resetPolygons(false);
        octreeB.resetPolygons(false);
        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);


        handleIntersectingOctrees(octreeA, octreeB);
        octreeA.deleteReplacedPolygons();
        octreeB.deleteReplacedPolygons();

        octreeA.deletePolygonsByStateRules(CSG_Rules.subtract.a);
        octreeB.deletePolygonsByStateRules(CSG_Rules.subtract.b);


        octreeB.deletePolygonsByIntersection(false);

        octreeB.invert();

        octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree));
        octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree));


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
        octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree));
    }
    octree.markPolygonsAsOriginal();
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
            octreeA.mesh.material.side = DoubleSide;
        }
        if (octreeB.mesh) {
            currentMeshSideB = octreeB.mesh.material.side;
            octreeB.mesh.material.side = DoubleSide;
        }

        octreeA.resetPolygons(false);
        octreeB.resetPolygons(false);

        octreeA.markIntesectingPolygons(octreeB);
        octreeB.markIntesectingPolygons(octreeA);

        handleIntersectingOctrees(octreeA, octreeB);
        octreeA.deleteReplacedPolygons();
        octreeB.deleteReplacedPolygons();

        octreeA.deletePolygonsByStateRules(CSG_Rules.intersect.a);
        octreeB.deletePolygonsByStateRules(CSG_Rules.intersect.b);

        octreeA.deletePolygonsByIntersection(false);
        octreeB.deletePolygonsByIntersection(false);

        octreeA.getPolygonCloneCallback(octree.addPolygon.bind(octree));
        octreeB.getPolygonCloneCallback(octree.addPolygon.bind(octree));

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

    octree.markPolygonsAsOriginal();
    buildTargetOctree && octree.buildTree();

    return octree;
}

OctreeCSG.meshUnion = function (mesh1, mesh2, targetMaterial) {
    let octreeA;
    let octreeB;
    if (targetMaterial && Array.isArray(targetMaterial)) {
        octreeA = OctreeCSG.fromMesh(mesh1, 0);
        octreeB = OctreeCSG.fromMesh(mesh2, 1);
    }
    else {
        octreeA = OctreeCSG.fromMesh(mesh1);
        octreeB = OctreeCSG.fromMesh(mesh2);
        targetMaterial = targetMaterial !== undefined ? targetMaterial : (Array.isArray(mesh1.material) ? mesh1.material[0] : mesh1.material).clone();
    }
    let resultOctree = OctreeCSG.union(octreeA, octreeB, false);
    let resultMesh = OctreeCSG.toMesh(resultOctree, targetMaterial);
    disposeOctree(octreeA, octreeB, resultOctree);
    return resultMesh;
}
OctreeCSG.meshSubtract = function (mesh1, mesh2, targetMaterial) {
    let octreeA;
    let octreeB;
    if (targetMaterial && Array.isArray(targetMaterial)) {
        octreeA = OctreeCSG.fromMesh(mesh1, 0);
        octreeB = OctreeCSG.fromMesh(mesh2, 1);
    }
    else {
        octreeA = OctreeCSG.fromMesh(mesh1);
        octreeB = OctreeCSG.fromMesh(mesh2);
        targetMaterial = targetMaterial !== undefined ? targetMaterial : (Array.isArray(mesh1.material) ? mesh1.material[0] : mesh1.material).clone();
    }
    let resultOctree = OctreeCSG.subtract(octreeA, octreeB, false);
    let resultMesh = OctreeCSG.toMesh(resultOctree, targetMaterial);
    disposeOctree(octreeA, octreeB, resultOctree);
    return resultMesh;
}
OctreeCSG.meshIntersect = function (mesh1, mesh2, targetMaterial) {
    let octreeA;
    let octreeB;
    if (targetMaterial && Array.isArray(targetMaterial)) {
        octreeA = OctreeCSG.fromMesh(mesh1, 0);
        octreeB = OctreeCSG.fromMesh(mesh2, 1);
    }
    else {
        octreeA = OctreeCSG.fromMesh(mesh1);
        octreeB = OctreeCSG.fromMesh(mesh2);
        targetMaterial = targetMaterial !== undefined ? targetMaterial : (Array.isArray(mesh1.material) ? mesh1.material[0] : mesh1.material).clone();
    }
    let resultOctree = OctreeCSG.intersect(octreeA, octreeB, false);
    let resultMesh = OctreeCSG.toMesh(resultOctree, targetMaterial);
    disposeOctree(octreeA, octreeB, resultOctree);
    return resultMesh;
}
let _asyncUnionID = 0;
let _asyncUnionArrayID = 0;
OctreeCSG.disposeOctree = true;
OctreeCSG.async = {
    batchSize: 100,
    union: function (octreeA, octreeB, buildTargetOctree = true) {
        return new Promise((resolve, reject) => {
            // const id = _asyncUnionID++;
            // console.log(`Promise Union #${id} started`);
            try {
                let result = OctreeCSG.union(octreeA, octreeB, buildTargetOctree);
                resolve(result);
                disposeOctree(octreeA, octreeB);
            }
            catch (e) {
                reject(e);
            }
        });
    },
    subtract: function (octreeA, octreeB, buildTargetOctree = true) {
        return new Promise((resolve, reject) => {
            try {
                let result = OctreeCSG.subtract(octreeA, octreeB, buildTargetOctree);
                resolve(result);
                disposeOctree(octreeA, octreeB);
            }
            catch (e) {
                reject(e);
            }
        });
    },
    intersect: function (octreeA, octreeB, buildTargetOctree = true) {
        return new Promise((resolve, reject) => {
            try {
                let result = OctreeCSG.intersect(octreeA, octreeB, buildTargetOctree);
                resolve(result);
                disposeOctree(octreeA, octreeB);
            }
            catch (e) {
                reject(e);
            }
        });
    },

    unionArray: function (objArr, materialIndexMax = Infinity) {
        return new Promise((resolve, reject) => {
            try {
                let usingBatches = OctreeCSG.async.batchSize > 4 && OctreeCSG.async.batchSize < objArr.length;
                // const id = _asyncUnionArrayID++
                // console.log(`Promise Union Array #${id}`, usingBatches);
                let mainOctree;
                let mainOctreeUsed = false;
                let promises = [];
                if (usingBatches) {
                    let batches = [];
                    let currentIndex = 0;
                    while (currentIndex < objArr.length) {
                        batches.push(objArr.slice(currentIndex, currentIndex + OctreeCSG.async.batchSize));
                        currentIndex += OctreeCSG.async.batchSize
                    }

                    let batch = batches.shift();
                    while (batch) {
                        let promise = OctreeCSG.async.unionArray(batch, 0);
                        promises.push(promise);
                        batch = batches.shift();
                    }
                    usingBatches = true;
                    mainOctreeUsed = true;
                    objArr.length = 0;
                }
                else {
                    let octreesArray = [];
                    for (let i = 0; i < objArr.length; i++) {
                        let materialIndex = i > materialIndexMax ? materialIndexMax : i;
                        let tempOctree
                        if (objArr[i].isMesh) {
                            tempOctree = OctreeCSG.fromMesh(objArr[i], materialIndexMax > -1 ? materialIndex : undefined);
                        }
                        else {
                            tempOctree = objArr[i];
                            if (materialIndexMax > -1) {
                                tempOctree.setPolygonIndex(materialIndex);
                            }
                        }
                        tempOctree.octreeIndex = i;
                        octreesArray.push(tempOctree);
                    }
                    mainOctree = octreesArray.shift();

                    let result;
                    let hasLeftOver = false;
                    let leftOverOctree;
                    for (let i = 0; i < octreesArray.length; i += 2) {
                        if (i + 1 >= octreesArray.length) {
                            leftOverOctree = octreesArray[i];
                            hasLeftOver = true;
                            break;
                        }
                        let promise = OctreeCSG.async.union(octreesArray[i], octreesArray[i + 1]);
                        promises.push(promise);
                    }
                    if (leftOverOctree) {
                        let promise = OctreeCSG.async.union(mainOctree, leftOverOctree);
                        promises.push(promise);
                        mainOctreeUsed = true;
                    }
                }
                Promise.allSettled(promises).then(results => {
                    let octrees = []
                    results.forEach(r => {
                        if (r.status === "fulfilled") {
                            octrees.push(r.value);
                        }
                    });
                    if (!mainOctreeUsed) {
                        octrees.unshift(mainOctree);
                    }
                    if (octrees.length > 0) {
                        if (octrees.length === 1) {
                            resolve(octrees[0]);
                        }
                        else if (octrees.length > 3) {
                            OctreeCSG.async.unionArray(octrees, usingBatches ? 0 : -1).then(result => {
                                resolve(result);
                            }).catch(e => reject(e));
                        }
                        else {
                            OctreeCSG.async.union(octrees[0], octrees[1]).then(result => {
                                if (octrees.length === 3) {
                                    OctreeCSG.async.union(result, octrees[2]).then(result => {
                                        resolve(result);
                                    }).catch(e => reject(e));
                                }
                                else {
                                    resolve(result);
                                }
                            }).catch(e => reject(e));
                        }
                    }
                    else {
                        reject('Unable to find any result octree');
                    }
                });
            }
            catch (e) {
                reject(e);
            }
        });
    },
    subtractArray: function (objArr, materialIndexMax = Infinity) {
        return new Promise((resolve, reject) => {
            try {
                let usingBatches = OctreeCSG.async.batchSize > 4 && OctreeCSG.async.batchSize < objArr.length;
                let mainOctree;
                let mainOctreeUsed = false;
                let promises = [];
                if (usingBatches) {
                    let batches = [];
                    let currentIndex = 0;
                    while (currentIndex < objArr.length) {
                        batches.push(objArr.slice(currentIndex, currentIndex + OctreeCSG.async.batchSize));
                        currentIndex += OctreeCSG.async.batchSize
                    }

                    let batch = batches.shift();
                    while (batch) {
                        let promise = OctreeCSG.async.subtractArray(batch, 0);
                        promises.push(promise);
                        batch = batches.shift();
                    }
                    usingBatches = true;
                    mainOctreeUsed = true;
                    objArr.length = 0;
                }
                else {
                    let octreesArray = [];
                    for (let i = 0; i < objArr.length; i++) {
                        let materialIndex = i > materialIndexMax ? materialIndexMax : i;
                        let tempOctree
                        if (objArr[i].isMesh) {
                            tempOctree = OctreeCSG.fromMesh(objArr[i], materialIndexMax > -1 ? materialIndex : undefined);
                        }
                        else {
                            tempOctree = objArr[i];
                            if (materialIndexMax > -1) {
                                tempOctree.setPolygonIndex(materialIndex);
                            }
                        }
                        tempOctree.octreeIndex = i;
                        octreesArray.push(tempOctree);
                    }
                    mainOctree = octreesArray.shift();

                    let result;
                    let hasLeftOver = false;
                    let leftOverOctree;
                    for (let i = 0; i < octreesArray.length; i += 2) {
                        if (i + 1 >= octreesArray.length) {
                            leftOverOctree = octreesArray[i];
                            hasLeftOver = true;
                            break;
                        }
                        let promise = OctreeCSG.async.subtract(octreesArray[i], octreesArray[i + 1]);
                        promises.push(promise);
                    }
                    if (leftOverOctree) {
                        let promise = OctreeCSG.async.subtract(mainOctree, leftOverOctree);
                        promises.push(promise);
                        mainOctreeUsed = true;
                    }
                }
                Promise.allSettled(promises).then(results => {
                    let octrees = []
                    results.forEach(r => {
                        if (r.status === "fulfilled") {
                            octrees.push(r.value);
                        }
                    });
                    if (!mainOctreeUsed) {
                        octrees.unshift(mainOctree);
                    }
                    if (octrees.length > 0) {
                        if (octrees.length === 1) {
                            resolve(octrees[0]);
                        }
                        else if (octrees.length > 3) {
                            OctreeCSG.async.subtractArray(octrees, usingBatches ? 0 : -1).then(result => {
                                resolve(result);
                            }).catch(e => reject(e));
                        }
                        else {
                            OctreeCSG.async.subtract(octrees[0], octrees[1]).then(result => {
                                if (octrees.length === 3) {
                                    OctreeCSG.async.subtract(result, octrees[2]).then(result => {
                                        resolve(result);
                                    }).catch(e => reject(e));
                                }
                                else {
                                    resolve(result);
                                }
                            }).catch(e => reject(e));
                        }
                    }
                    else {
                        reject('Unable to find any result octree');
                    }
                });
            }
            catch (e) {
                reject(e);
            }
        });
    },
    intersectArray: function (objArr, materialIndexMax = Infinity) {
        return new Promise((resolve, reject) => {
            try {
                let usingBatches = OctreeCSG.async.batchSize > 4 && OctreeCSG.async.batchSize < objArr.length;
                let mainOctree;
                let mainOctreeUsed = false;
                let promises = [];
                if (usingBatches) {
                    let batches = [];
                    let currentIndex = 0;
                    while (currentIndex < objArr.length) {
                        batches.push(objArr.slice(currentIndex, currentIndex + OctreeCSG.async.batchSize));
                        currentIndex += OctreeCSG.async.batchSize
                    }

                    let batch = batches.shift();
                    while (batch) {
                        let promise = OctreeCSG.async.intersectArray(batch, 0);
                        promises.push(promise);
                        batch = batches.shift();
                    }
                    usingBatches = true;
                    mainOctreeUsed = true;
                    objArr.length = 0;
                }
                else {
                    let octreesArray = [];
                    for (let i = 0; i < objArr.length; i++) {
                        let materialIndex = i > materialIndexMax ? materialIndexMax : i;
                        let tempOctree
                        if (objArr[i].isMesh) {
                            tempOctree = OctreeCSG.fromMesh(objArr[i], materialIndexMax > -1 ? materialIndex : undefined);
                        }
                        else {
                            tempOctree = objArr[i];
                            if (materialIndexMax > -1) {
                                tempOctree.setPolygonIndex(materialIndex);
                            }
                        }
                        tempOctree.octreeIndex = i;
                        octreesArray.push(tempOctree);
                    }
                    mainOctree = octreesArray.shift();

                    let result;
                    let hasLeftOver = false;
                    let leftOverOctree;
                    for (let i = 0; i < octreesArray.length; i += 2) {
                        if (i + 1 >= octreesArray.length) {
                            leftOverOctree = octreesArray[i];
                            hasLeftOver = true;
                            break;
                        }
                        let promise = OctreeCSG.async.intersect(octreesArray[i], octreesArray[i + 1]);
                        promises.push(promise);
                    }
                    if (leftOverOctree) {
                        let promise = OctreeCSG.async.intersect(mainOctree, leftOverOctree);
                        promises.push(promise);
                        mainOctreeUsed = true;
                    }
                }
                Promise.allSettled(promises).then(results => {
                    let octrees = []
                    results.forEach(r => {
                        if (r.status === "fulfilled") {
                            octrees.push(r.value);
                        }
                    });
                    if (!mainOctreeUsed) {
                        octrees.unshift(mainOctree);
                    }
                    if (octrees.length > 0) {
                        if (octrees.length === 1) {
                            resolve(octrees[0]);
                        }
                        else if (octrees.length > 3) {
                            OctreeCSG.async.intersectArray(octrees, usingBatches ? 0 : -1).then(result => {
                                resolve(result);
                            }).catch(e => reject(e));
                        }
                        else {
                            OctreeCSG.async.intersect(octrees[0], octrees[1]).then(result => {
                                if (octrees.length === 3) {
                                    OctreeCSG.async.intersect(result, octrees[2]).then(result => {
                                        resolve(result);
                                    }).catch(e => reject(e));
                                }
                                else {
                                    resolve(result);
                                }
                            }).catch(e => reject(e));
                        }
                    }
                    else {
                        reject('Unable to find any result octree');
                    }
                });
            }
            catch (e) {
                reject(e);
            }
        });
    },
    operation: function (obj, returnOctrees = false, buildTargetOctree = true, options = { objCounter: 0 }, firstRun = true) {
        return new Promise((resolve, reject) => {
            try {
                let octreeA, octreeB, resultOctree, material;
                if (obj.material) {
                    material = obj.material;
                }
                let promises = []
                if (obj.objA) {
                    let promise = handleObjectForOp_async(obj.objA, returnOctrees, buildTargetOctree, options, 0);
                    promises.push(promise);
                    // octreeA = handleObjectForOp(obj.objA, returnOctrees, buildTargetOctree, options);
                    // if (returnOctrees == true) {
                    //     obj.objA = octreeA.original;
                    //     octreeA = octreeA.result;
                    // }
                }
                if (obj.objB) {
                    let promise = handleObjectForOp_async(obj.objB, returnOctrees, buildTargetOctree, options, 1);
                    promises.push(promise);
                    // octreeB = handleObjectForOp(obj.objB, returnOctrees, buildTargetOctree, options);
                    // if (returnOctrees == true) {
                    //     obj.objB = octreeB.original;
                    //     octreeB = octreeB.result;
                    // }
                }
                Promise.allSettled(promises).then(results => {
                    let octrees = []
                    results.forEach(r => {
                        if (r.status === "fulfilled") {
                            if (r.value.objIndex === 0) {
                                octreeA = r.value;
                            }
                            else if (r.value.objIndex === 1) {
                                octreeB = r.value;
                            }
                            // octrees.push(r.value);
                        }
                    });

                    if (returnOctrees == true) {
                        obj.objA = octreeA.original;
                        octreeA = octreeA.result;
                        obj.objB = octreeB.original;
                        octreeB = octreeB.result;
                    }
                    let resultPromise;
                    switch (obj.op) {
                        case 'union':
                            resultPromise = OctreeCSG.async.union(octreeA, octreeB, buildTargetOctree);
                            // resultOctree = OctreeCSG.union(octreeA, octreeB, buildTargetOctree);
                            break;
                        case 'subtract':
                            resultPromise = OctreeCSG.async.subtract(octreeA, octreeB, buildTargetOctree);
                            // resultOctree = OctreeCSG.subtract(octreeA, octreeB, buildTargetOctree);
                            break;
                        case 'intersect':
                            resultPromise = OctreeCSG.async.intersect(octreeA, octreeB, buildTargetOctree);
                            // resultOctree = OctreeCSG.intersect(octreeA, octreeB, buildTargetOctree);
                            break;
                    }
                    resultPromise.then(resultOctree => {
                        if (firstRun && material) {
                            let mesh = OctreeCSG.toMesh(resultOctree, material);
                            if (!returnOctrees) {
                                disposeOctree(resultOctree);
                            }
                            resolve(returnOctrees ? { result: mesh, operationTree: obj } : mesh);
                        }
                        else if (firstRun && returnOctrees) {
                            resolve({ result: resultOctree, operationTree: obj });
                        }
                        else {
                            resolve(resultOctree);
                        }
                        if (!returnOctrees) {
                            disposeOctree(octreeA, octreeB);
                        }
                    }).catch(e => reject(e));
                });
            }
            catch (e) {
                reject(e);
            }
        });
    }
}
OctreeCSG.unionArray = function (objArr, materialIndexMax = Infinity) {
    let octreesArray = [];
    for (let i = 0; i < objArr.length; i++) {
        let materialIndex = i > materialIndexMax ? materialIndexMax : i;
        let tempOctree
        if (objArr[i].isMesh) {
            tempOctree = OctreeCSG.fromMesh(objArr[i], materialIndex);
        }
        else {
            tempOctree = objArr[i];
            tempOctree.setPolygonIndex(materialIndex);
        }
        tempOctree.octreeIndex = i;
        octreesArray.push(tempOctree);
    }
    let octreeA = octreesArray.shift();
    let octreeB = octreesArray.shift();
    while (octreeA && octreeB) {
        let resultOctree = OctreeCSG.union(octreeA, octreeB);
        disposeOctree(octreeA, octreeB);
        octreeA = resultOctree;
        octreeB = octreesArray.shift();
    }
    return octreeA;
}
OctreeCSG.subtractArray = function (objArr, materialIndexMax = Infinity) {
    let octreesArray = [];
    for (let i = 0; i < objArr.length; i++) {
        let materialIndex = i > materialIndexMax ? materialIndexMax : i;
        let tempOctree
        if (objArr[i].isMesh) {
            tempOctree = OctreeCSG.fromMesh(objArr[i], materialIndex);
        }
        else {
            tempOctree = objArr[i];
            tempOctree.setPolygonIndex(materialIndex);
        }
        tempOctree.octreeIndex = i;
        octreesArray.push(tempOctree);
    }
    let octreeA = octreesArray.shift();
    let octreeB = octreesArray.shift();
    while (octreeA && octreeB) {
        let resultOctree = OctreeCSG.subtract(octreeA, octreeB);
        disposeOctree(octreeA, octreeB);
        octreeA = resultOctree;
        octreeB = octreesArray.shift();
    }
    return octreeA;
}
OctreeCSG.intersectArray = function (objArr, materialIndexMax = Infinity) {
    let octreesArray = [];
    for (let i = 0; i < objArr.length; i++) {
        let materialIndex = i > materialIndexMax ? materialIndexMax : i;
        let tempOctree
        if (objArr[i].isMesh) {
            tempOctree = OctreeCSG.fromMesh(objArr[i], materialIndex);
        }
        else {
            tempOctree = objArr[i];
            tempOctree.setPolygonIndex(materialIndex);
        }
        tempOctree.octreeIndex = i;
        octreesArray.push(tempOctree);
    }
    let octreeA = octreesArray.shift();
    let octreeB = octreesArray.shift();
    while (octreeA && octreeB) {
        let resultOctree = OctreeCSG.intersect(octreeA, octreeB);
        disposeOctree(octreeA, octreeB);
        octreeA = resultOctree;
        octreeB = octreesArray.shift();
    }
    return octreeA;
}

OctreeCSG.operation = function (obj, returnOctrees = false, buildTargetOctree = true, options = { objCounter: 0 }, firstRun = true) {
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
    if (!returnOctrees) {
        disposeOctree(octreeA, octreeB);
    }
    if (firstRun && material) {
        let mesh = OctreeCSG.toMesh(resultOctree, material);
        disposeOctree(resultOctree);
        return returnOctrees ? { result: mesh, operationTree: obj } : mesh;
    }
    if (firstRun && returnOctrees) {
        return { result: resultOctree, operationTree: obj };
    }
    return resultOctree;
}

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

function handleObjectForOp_async(obj, returnOctrees, buildTargetOctree, options, objIndex) {
    return new Promise((resolve, reject) => {
        try {
            let returnObj;
            if (obj.isMesh) {
                returnObj = OctreeCSG.fromMesh(obj, options.objCounter++);
                if (returnOctrees) {
                    returnObj = { result: returnObj, original: returnObj.clone() };
                }
                returnObj.objIndex = objIndex;
                resolve(returnObj);
            }
            else if (obj.isOctree) {
                returnObj = obj;
                if (returnOctrees) {
                    returnObj = { result: obj, original: obj.clone() };
                }
                returnObj.objIndex = objIndex;
                resolve(returnObj);
            }
            else if (obj.op) {
                OctreeCSG.async.operation(obj, returnOctrees, buildTargetOctree, options, false).then(returnObj => {
                    if (returnOctrees) {
                        returnObj = { result: returnObj, original: obj };
                    }
                    returnObj.objIndex = objIndex;
                    resolve(returnObj);
                });
                // returnObj = OctreeCSG.operation(obj, returnOctrees, buildTargetOctree, options, false);
                // if (returnOctrees) {
                //     returnObj = { result: returnObj, original: obj };
                // }
            }


        }
        catch (e) {
            reject(e);
        }
    });
}

function isUniqueTriangle(triangle, set, map) {
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
        if (isUniqueTriangle(polygon.triangle, trianglesSet)) {
            triangleCount += (polygon.vertices.length - 2);
            validPolygons.push(polygon);
        }
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

    return geometry;
}

OctreeCSG.toMesh = function (octree, toMaterial) {
    let geometry = OctreeCSG.toGeometry(octree);
    return new Mesh(geometry, toMaterial);
}

OctreeCSG.fromMesh = function (obj, objectIndex, octree = new OctreeCSG(), buildTargetOctree = true) {
    if (obj.isOctree) {
        return obj;
    }
    // let octree = new OctreeCSG();
    if (OctreeCSG.rayIntersectTriangleType === "regular") {
        octree.originalMatrixWorld = obj.matrixWorld.clone();
    }
    obj.updateWorldMatrix(true, true);
    let geometry = obj.geometry;
    tmpm3.getNormalMatrix(obj.matrix);
    let posattr = geometry.attributes.position;
    let normalattr = geometry.attributes.normal;
    let uvattr = geometry.attributes.uv;
    let colorattr = geometry.attributes.color;
    let groups = geometry.groups;
    let index;
    if (geometry.index) {
        index = geometry.index.array;
    }
    else {
        index = new Array((posattr.array.length / posattr.itemSize) | 0);
        for (let i = 0; i < index.length; i++) {
            index[i] = i;
        }
    }
    let polys = [];
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
                    polygon.originalValid = true;
                }
            }
            if (polygon) {
                polys.push(polygon);
            }

        }
        else {
            let polygon = new Polygon(vertices, objectIndex);
            polygon.originalValid = true;
            polys.push(polygon);
        }
    }

    for (let i = 0; i < polys.length; i++) {
        if (isValidTriangle(polys[i].triangle)) {
            octree.addPolygon(polys[i]);
        }
        else {
            polys[i].delete();
        }
    }

    buildTargetOctree && octree.buildTree();
    if (OctreeCSG.useOctreeRay !== true) {
        octree.mesh = obj;
    }
    return octree;

};

function isValidTriangle(triangle) {
    if (triangle.a.equals(triangle.b)) return false;
    if (triangle.a.equals(triangle.c)) return false;
    if (triangle.b.equals(triangle.c)) return false;
    return true;
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
        this.id = _polygonID++;
        this.vertices = vertices.map(v => v.clone());
        this.shared = shared;
        this.plane = Plane.fromPoints(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        this.triangle = new Triangle(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        this.intersects = false;
        this.state = "undecided";
        this.previousState = "undecided";
        this.previousStates = [];
        this.valid = true;
        this.coplanar = false;
        this.originalValid = false;
        this.newPolygon = false;
    }
    getMidpoint() {
        if (this.triangle.midPoint) {
            return this.triangle.midPoint;
        }
        this.triangle.midPoint = this.triangle.getMidpoint(new Vector3());
        return this.triangle.midPoint;
    }
    applyMatrix(matrix, normalMatrix) {
        normalMatrix = normalMatrix || tmpm3.getNormalMatrix(matrix);
        this.vertices.forEach(v => {
            v.pos.applyMatrix4(matrix);
            v.normal.applyMatrix3(normalMatrix);
        });
        this.plane.delete();
        this.plane = Plane.fromPoints(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        this.triangle.set(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
        if (this.triangle.midPoint) {
            this.triangle.getMidpoint(this.triangle.midPoint);
        }
    }
    reset(resetOriginal = true) {
        this.intersects = false;
        this.state = "undecided";
        this.previousState = "undecided";
        this.previousStates.length = 0;
        this.valid = true;
        this.coplanar = false;
        resetOriginal && (this.originalValid = false);
        this.newPolygon = false;
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
        polygon.coplanar = this.coplanar;
        polygon.state = this.state;
        polygon.originalValid = this.originalValid;
        polygon.newPolygon = this.newPolygon;
        polygon.previousState = this.previousState;
        polygon.previousStates = this.previousStates.slice();
        if (this.triangle.midPoint) {
            polygon.triangle.midPoint = this.triangle.midPoint.clone();
        }
        return polygon;
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
        if (this.plane) {
            this.plane.delete();
            this.plane = undefined;
        }
        this.triangle = undefined;
        this.shared = undefined;
        this.setInvalid();
    }
}


function disposeOctree(...octrees) {
    if (OctreeCSG.disposeOctree) {
        octrees.forEach(octree => octree.delete());
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

function handleIntersectingOctrees(octreeA, octreeB, bothOctrees = true) {
    let octreeA_buffer;
    let octreeB_buffer;
    if (OctreeCSG.useWindingNumber === true) {
        if (bothOctrees) {
            octreeA_buffer = prepareTriangleBuffer(octreeA.getPolygons());
        }
        octreeB_buffer = prepareTriangleBuffer(octreeB.getPolygons());
    }
    octreeA.handleIntersectingPolygons(octreeB, octreeB_buffer);
    if (bothOctrees) {
        octreeB.handleIntersectingPolygons(octreeA, octreeA_buffer);
    }
    if (octreeA_buffer !== undefined) {
        octreeA_buffer = undefined;
        octreeB_buffer = undefined;
    }
}

function prepareTriangleBuffer(polygons) {
    let numOfTriangles = polygons.length;
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

    return array;
}

////////
// https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm
const edge1 = new Vector3();
const edge2 = new Vector3();
const h = new Vector3();
const s = new Vector3();
const q = new Vector3();
const RAY_EPSILON = 0.0000001;
function rayIntersectsTriangle(ray, triangle, target = new Vector3()) {
    edge1.subVectors(triangle.b, triangle.a);
    edge2.subVectors(triangle.c, triangle.a);
    h.crossVectors(ray.direction, edge2);
    let a = edge1.dot(h);
    if (a > -RAY_EPSILON && a < RAY_EPSILON) {
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
    if (t > RAY_EPSILON) {
        return target.copy(ray.direction).multiplyScalar(t).add(ray.origin);
    }
    // else {
    return null;
    // }
}
OctreeCSG.rayIntersectsTriangle = rayIntersectsTriangle;
////////

OctreeCSG.useOctreeRay = true;
OctreeCSG.useWindingNumber = false;
OctreeCSG.rayIntersectTriangleType = "MollerTrumbore"; // "regular" (three.js' ray.intersectTriangle; "MollerTrumbore" (Moller Trumbore algorithm);
OctreeCSG.maxLevel = 16;
OctreeCSG.polygonsPerTree = 100;
// OctreeCSG.Octree = Octree;
export default OctreeCSG;
export { OctreeCSG as CSG, OctreeCSG, Polygon, Plane, Vertex, rayIntersectsTriangle };