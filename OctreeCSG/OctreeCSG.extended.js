import OctreeCSG from './OctreeCSG.js';
import { Vector3, Plane, Line3, Sphere } from 'three';
import { Capsule } from 'threeModules/math/Capsule.js';

const _v1 = new Vector3();
const _v2 = new Vector3();
const _plane = new Plane();
const _line1 = new Line3();
const _line2 = new Line3();
const _sphere = new Sphere();
const _capsule = new Capsule();

class Octree extends OctreeCSG {
    constructor(box, parent) {
        super(box, parent);
    }
    getTriangles(triangles = []) {
        let polygons = this.getPolygons();
        polygons.forEach(p => triangles.push(p.triangle));
        return triangles;
    }
    getRayTriangles(ray, triangles = []) {
        let polygons = this.getRayPolygons(ray);
        polygons.forEach(p => triangles.push(p.triangle));
        return triangles;
    }
    triangleCapsuleIntersect(capsule, triangle) {

        triangle.getPlane(_plane);

        const d1 = _plane.distanceToPoint(capsule.start) - capsule.radius;
        const d2 = _plane.distanceToPoint(capsule.end) - capsule.radius;

        if ((d1 > 0 && d2 > 0) || (d1 < - capsule.radius && d2 < - capsule.radius)) {

            return false;

        }

        const delta = Math.abs(d1 / (Math.abs(d1) + Math.abs(d2)));
        const intersectPoint = _v1.copy(capsule.start).lerp(capsule.end, delta);

        if (triangle.containsPoint(intersectPoint)) {

            return { normal: _plane.normal.clone(), point: intersectPoint.clone(), depth: Math.abs(Math.min(d1, d2)) };

        }

        const r2 = capsule.radius * capsule.radius;

        const line1 = _line1.set(capsule.start, capsule.end);

        const lines = [
            [triangle.a, triangle.b],
            [triangle.b, triangle.c],
            [triangle.c, triangle.a]
        ];

        for (let i = 0; i < lines.length; i++) {

            const line2 = _line2.set(lines[i][0], lines[i][1]);

            const [point1, point2] = capsule.lineLineMinimumPoints(line1, line2);

            if (point1.distanceToSquared(point2) < r2) {

                return { normal: point1.clone().sub(point2).normalize(), point: point2.clone(), depth: capsule.radius - point1.distanceTo(point2) };

            }

        }

        return false;

    }

    triangleSphereIntersect(sphere, triangle) {

        triangle.getPlane(_plane);

        if (!sphere.intersectsPlane(_plane)) return false;

        const depth = Math.abs(_plane.distanceToSphere(sphere));
        const r2 = sphere.radius * sphere.radius - depth * depth;

        const plainPoint = _plane.projectPoint(sphere.center, _v1);

        if (triangle.containsPoint(sphere.center)) {

            return { normal: _plane.normal.clone(), point: plainPoint.clone(), depth: Math.abs(_plane.distanceToSphere(sphere)) };

        }

        const lines = [
            [triangle.a, triangle.b],
            [triangle.b, triangle.c],
            [triangle.c, triangle.a]
        ];

        for (let i = 0; i < lines.length; i++) {

            _line1.set(lines[i][0], lines[i][1]);
            _line1.closestPointToPoint(plainPoint, true, _v2);

            const d = _v2.distanceToSquared(sphere.center);

            if (d < r2) {

                return { normal: sphere.center.clone().sub(_v2).normalize(), point: _v2.clone(), depth: sphere.radius - Math.sqrt(d) };

            }

        }

        return false;

    }

    getSphereTriangles(sphere, triangles) {
        for (let i = 0; i < this.subTrees.length; i++) {
            const subTree = this.subTrees[i];
            if (!sphere.intersectsBox(subTree.box)) continue;

            if (subTree.polygons.length > 0) {
                for (let j = 0; j < subTree.polygons.length; j++) {
                    if (!subTree.polygons[j].valid) continue;

                    if (triangles.indexOf(subTree.polygons[j].triangle) === - 1) {
                        triangles.push(subTree.polygons[j].triangle);
                    }
                }
            }
            else {
                subTree.getSphereTriangles(sphere, triangles);
            }
        }
    }

    getCapsuleTriangles(capsule, triangles) {
        for (let i = 0; i < this.subTrees.length; i++) {
            const subTree = this.subTrees[i];
            if (!capsule.intersectsBox(subTree.box)) continue;

            if (subTree.polygons.length > 0) {
                for (let j = 0; j < subTree.polygons.length; j++) {
                    if (!subTree.polygons[j].valid) continue;
                    if (triangles.indexOf(subTree.polygons[j].triangle) === - 1) {
                        triangles.push(subTree.polygons[j].triangle);
                    }
                }
            }
            else {
                subTree.getCapsuleTriangles(capsule, triangles);
            }
        }
    }

    sphereIntersect(sphere) {
        _sphere.copy(sphere);
        const triangles = [];
        let result, hit = false;

        this.getSphereTriangles(sphere, triangles);
        for (let i = 0; i < triangles.length; i++) {
            if (result = this.triangleSphereIntersect(_sphere, triangles[i])) {
                hit = true;
                _sphere.center.add(result.normal.multiplyScalar(result.depth));
            }
        }

        if (hit) {
            const collisionVector = _sphere.center.clone().sub(sphere.center);
            const depth = collisionVector.length();
            return { normal: collisionVector.normalize(), depth: depth };
        }

        return false;
    }

    capsuleIntersect(capsule) {

        _capsule.copy(capsule);

        const triangles = [];
        let result, hit = false;

        this.getCapsuleTriangles(_capsule, triangles);

        for (let i = 0; i < triangles.length; i++) {

            if (result = this.triangleCapsuleIntersect(_capsule, triangles[i])) {
                hit = true;
                _capsule.translate(result.normal.multiplyScalar(result.depth));
            }
        }

        if (hit) {
            const collisionVector = _capsule.getCenter(new Vector3()).sub(capsule.getCenter(_v1));
            const depth = collisionVector.length();

            return { normal: collisionVector.normalize(), depth: depth };
        }

        return false;
    }
    fromGraphNode(group) {
        group.updateWorldMatrix(true, true);
        group.traverse((obj) => {
            if (obj.isMesh === true) {
                OctreeCSG.fromMesh(obj, undefined, this, false);
            }
        });
        this.buildTree();

        return this;
    }
}

export { Octree, OctreeCSG };