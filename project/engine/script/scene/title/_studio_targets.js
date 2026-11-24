import * as THREE from '../../../vendor/three-r160/three.module.min.js';

// Each contour and its hit area share a plane on the corresponding model surface.
const surfaces = {
    door: { center: [-3.762, 1.65, 1.54], size: [1.40, 3.08], rotation: [0, Math.PI / 2, 0] },
    shelf: { center: [-2.72, 1.881, -2.44], size: [0.62, 0.62], rotation: [-Math.PI / 2, 0, 0], circular: true },
    desk: { center: [1.08, 2.21, -2.561], size: [2.32, 1.26], rotation: [0, 0, 0] }
};
const margin = 0.22;

const vertexShader = `
    varying vec2 faceUV;
    void main() {
        faceUV = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    uniform vec2 halfSize;
    uniform float haloMargin;
    uniform float circle;
    uniform float emphasis;
    varying vec2 faceUV;
    void main() {
        vec2 p = (faceUV * 2.0 - 1.0) * (halfSize + haloMargin);
        vec2 q = abs(p) - halfSize + 0.025;
        float boxEdge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.025;
        float edge = mix(boxEdge, length(p) - halfSize.x, circle);
        float core = 1.0 - smoothstep(0.006, 0.033, abs(edge));
        float halo = exp(-max(edge, 0.0) * 22.0) *
            smoothstep(-0.040, 0.016, edge) * (1.0 - smoothstep(0.12, haloMargin, edge));
        gl_FragColor = vec4(0.22, 0.71, 1.0, emphasis * (0.48 * core + 0.23 * halo));
        #include <colorspace_fragment>
    }
`;

export function buildStudioTargets(scene, gpu) {
    return Object.fromEntries(Object.entries(surfaces).map(([id, { center, size, rotation, circular }]) => {
        const [width, height] = size;
        const plane = new THREE.Object3D();
        plane.position.set(...center);
        plane.rotation.set(...rotation);
        plane.updateMatrix();
        const corners = [-1, 1].flatMap(x => [-1, 1].map(y =>
            new THREE.Vector3(x * width / 2, y * height / 2, 0).applyMatrix4(plane.matrix)));
        let material = null;
        if (gpu) {
            material = new THREE.ShaderMaterial({
                vertexShader, fragmentShader, transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending, toneMapped: false,
                uniforms: {
                    halfSize: { value: new THREE.Vector2(width / 2, height / 2) },
                    haloMargin: { value: margin }, circle: { value: Number(!!circular) },
                    emphasis: { value: 0.64 }
                }
            });
            const glow = new THREE.Mesh(new THREE.PlaneGeometry(width + 2 * margin, height + 2 * margin), material);
            glow.position.copy(plane.position);
            glow.quaternion.copy(plane.quaternion);
            scene.add(glow);
        }
        return [id, { corners, material }];
    }));
}
