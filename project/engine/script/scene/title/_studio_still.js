import * as THREE from '../../../vendor/three-r160/three.module.min.js';

// Render a still on selection or resize when the browser has no WebGL context.
// The same camera, meshes and printed textures are used for both renderers.
const light = new THREE.Vector3(3.6, 8.8, 4.8).normalize();
const toByte = new Uint8ClampedArray(1025);
for (let i = 0; i < toByte.length; i++) {
    const linear = i / 1024;
    toByte[i] = 255 * (linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055);
}

function prepareMeshes(scene) {
    scene.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse(object => {
        if (!object.isMesh) return;
        const { geometry, material } = object;
        const { position, normal, uv } = geometry.attributes;
        const canvas = material.map?.image;
        const texture = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
        for (let n = 0; n < (object.isInstancedMesh ? object.count : 1); n++) {
            const world = object.matrixWorld.clone();
            const color = material.color.clone();
            if (object.isInstancedMesh) {
                const instance = new THREE.Matrix4(), tint = new THREE.Color();
                object.getMatrixAt(n, instance);
                object.getColorAt(n, tint);
                world.multiply(instance);
                color.multiply(tint);
            }
            const normals = new THREE.Matrix3().getNormalMatrix(world);
            const vertices = Array.from({ length: position.count }, (_, i) => {
                const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(world);
                const face = new THREE.Vector3().fromBufferAttribute(normal, i).applyNormalMatrix(normals);
                const shade = material.isMeshBasicMaterial ? 1 :
                    0.47 + 0.16 * (1 + face.y) + 0.59 * Math.max(0, face.dot(light));
                return { point, shade, u: uv.getX(i), v: uv.getY(i) };
            });
            meshes.push({ vertices, indices: geometry.index.array, color, material, texture, order: object.renderOrder });
        }
    });
    return meshes.sort((a, b) => a.order - b.order);
}

function clipNear(vertices) {
    const result = [];
    for (let i = 0; i < 3; i++) {
        const a = vertices[i], b = vertices[(i + 1) % 3];
        const da = a.clip.z + a.clip.w, db = b.clip.z + b.clip.w;
        if (da >= 0) result.push(a);
        if ((da >= 0) === (db >= 0)) continue;
        const t = da / (da - db);
        result.push({
            clip: a.clip.clone().lerp(b.clip, t),
            shade: THREE.MathUtils.lerp(a.shade, b.shade, t),
            u: THREE.MathUtils.lerp(a.u, b.u, t),
            v: THREE.MathUtils.lerp(a.v, b.v, t)
        });
    }
    return result;
}

function screen(vertex, w, h) {
    const { clip, u, v, shade } = vertex, inverse = 1 / clip.w;
    return { x: (1 + clip.x * inverse) * w / 2, y: (1 - clip.y * inverse) * h / 2,
        z: clip.z * inverse, inverse, u, v, shade };
}

function triangle(a, b, c, mesh, image, depth) {
    const { width, height, data } = image;
    const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y;
    const area = bx * cy - by * cx;
    if (mesh.material.side === THREE.BackSide ? area <= 0.0001 : area >= -0.0001) return;
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const x1 = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const { color, texture, material } = mesh;
    for (let y = y0; y <= y1; y++) {
        const dy = y + 0.5 - a.y;
        for (let x = x0; x <= x1; x++) {
            const dx = x + 0.5 - a.x;
            const s = (dx * cy - dy * cx) / area, t = (bx * dy - by * dx) / area, r = 1 - s - t;
            if (r < 0 || s < 0 || t < 0) continue;
            const index = y * width + x, z = r * a.z + s * b.z + t * c.z;
            if (z >= depth[index]) continue;
            if (material.depthWrite) depth[index] = z;
            const scale = 1 / (r * a.inverse + s * b.inverse + t * c.inverse);
            const wa = r * a.inverse * scale, wb = s * b.inverse * scale, wc = t * c.inverse * scale;
            let red, green, blue;
            if (texture) {
                const u = wa * a.u + wb * b.u + wc * c.u, v = wa * a.v + wb * b.v + wc * c.v;
                const tx = THREE.MathUtils.clamp(Math.floor(u * texture.width), 0, texture.width - 1);
                const ty = THREE.MathUtils.clamp(Math.floor((1 - v) * texture.height), 0, texture.height - 1);
                const texel = 4 * (ty * texture.width + tx);
                red = texture.data[texel]; green = texture.data[texel + 1]; blue = texture.data[texel + 2];
            } else {
                const brightness = 1024 * (wa * a.shade + wb * b.shade + wc * c.shade);
                red = toByte[Math.min(1024, Math.round(color.r * brightness))];
                green = toByte[Math.min(1024, Math.round(color.g * brightness))];
                blue = toByte[Math.min(1024, Math.round(color.b * brightness))];
            }
            const offset = 4 * index, alpha = material.opacity;
            data[offset] = red * alpha + data[offset] * (1 - alpha);
            data[offset + 1] = green * alpha + data[offset + 1] * (1 - alpha);
            data[offset + 2] = blue * alpha + data[offset + 2] * (1 - alpha);
            data[offset + 3] = 255;
        }
    }
}

export class StudioStillRenderer {
    constructor() {
        this.domElement = document.createElement('canvas');
        this.context = this.domElement.getContext('2d');
        if (!this.context) throw new Error('Canvas 2D unavailable');
        this.snapshots = new Map();
    }

    setSize(width, height) {
        const scale = Math.min(1, 800 / Math.max(width, height));
        this.domElement.width = Math.max(1, Math.round(width * scale));
        this.domElement.height = Math.max(1, Math.round(height * scale));
        this.snapshots.clear();
    }

    render(scene, camera) {
        this.meshes ??= prepareMeshes(scene);
        camera.updateMatrixWorld();
        const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        const key = projection.elements.join(',');
        const previous = this.snapshots.get(key);
        if (previous) { this.context.putImageData(previous, 0, 0); return; }
        const { width, height } = this.domElement;
        const image = this.context.createImageData(width, height);
        const depth = new Float32Array(width * height).fill(Infinity);
        for (const mesh of this.meshes) {
            const points = mesh.vertices.map(({ point, shade, u, v }) => ({
                clip: new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(projection), shade, u, v
            }));
            const projected = points.map(p => p.clip.z + p.clip.w >= 0 ? screen(p, width, height) : null);
            for (let i = 0; i < mesh.indices.length; i += 3) {
                const ia = mesh.indices[i], ib = mesh.indices[i + 1], ic = mesh.indices[i + 2];
                const a = projected[ia], b = projected[ib], c = projected[ic];
                if (a && b && c) triangle(a, b, c, mesh, image, depth);
                else if (a || b || c) {
                    const polygon = clipNear([points[ia], points[ib], points[ic]]).map(p => screen(p, width, height));
                    for (let j = 1; j + 1 < polygon.length; j++) triangle(polygon[0], polygon[j], polygon[j + 1], mesh, image, depth);
                }
            }
        }
        this.context.putImageData(image, 0, 0);
        if (this.snapshots.size >= 7) this.snapshots.delete(this.snapshots.keys().next().value);
        this.snapshots.set(key, image);
    }

    dispose() {
        this.meshes = null;
        this.snapshots.clear();
    }
}
