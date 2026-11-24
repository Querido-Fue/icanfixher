import * as THREE from '../../../vendor/three-r160/three.module.min.js';

function birchGrain() {
    const width = 128, height = 64;
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const u = 2 * Math.PI * x / width, v = 2 * Math.PI * y / height;
            const vein = v + 0.16 * Math.sin(u) + 0.06 * Math.sin(2 * u + v);
            const line = Math.pow(0.5 + 0.5 * Math.cos(7 * vein), 9);
            const grain = 252 - 21 * line - 4 * (1 + Math.sin(19 * vein + u));
            const offset = 4 * (y * width + x);
            pixels[offset] = grain;
            pixels[offset + 1] = grain - 2;
            pixels[offset + 2] = grain - 6;
            pixels[offset + 3] = 255;
        }
    }
    const map = new THREE.DataTexture(pixels, width, height);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
}

// Bake the static furniture footprints once. Boards and the oval rug sample the
// same floor coordinates, so the contact shading follows the rug's raised bands.
function floorOcclusion() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 128, 128);
    ctx.translate(64, 64);
    ctx.scale(128 / 8.3, -128 / 6.52);
    function shade(x, z, rx, rz, opacity) {
        ctx.save();
        ctx.translate(x, z);
        ctx.scale(rx, rz);
        const falloff = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        falloff.addColorStop(0, 'rgba(0,0,0,' + opacity + ')');
        falloff.addColorStop(0.52, 'rgba(0,0,0,' + opacity * 0.65 + ')');
        falloff.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = falloff;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
    }
    shade(-2.5, -2.44, 1.52, 0.72, 0.86); // record shelf
    shade(1.08, -2.20, 2.75, 1.14, 0.70); // desk and feet
    for (const x of [-0.88, 3.04]) for (const z of [-2.76, -1.66]) shade(x, z, 0.22, 0.18, 0.88);
    shade(0.98, -0.48, 0.94, 0.90, 0.82); // chair
    shade(-3.04, -0.22, 0.71, 0.68, 0.91); // bowl stand
    shade(3.19, -0.94, 0.60, 0.79, 0.92); // tower
    shade(3.28, -2.56, 0.48, 0.51, 0.88); // planter
    return new THREE.CanvasTexture(canvas);
}

export function studioFinishes(gpu) {
    const matte = new THREE.MeshStandardMaterial({ roughness: 0.84 });
    const enamel = new THREE.MeshStandardMaterial({ roughness: 0.20, metalness: 0.09 });
    const light = new THREE.MeshBasicMaterial();
    if (!gpu) return { matte, enamel, light, wood: matte, boards: matte, rug: matte };
    const wood = new THREE.MeshStandardMaterial({ roughness: 0.64, map: birchGrain() });
    const aoMap = floorOcclusion();
    const boards = wood.clone(), rug = matte.clone();
    for (const material of [boards, rug]) {
        material.aoMap = aoMap;
        material.onBeforeCompile = shader => {
            shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
                #include <uv_vertex>
                vec4 floorPoint = modelMatrix * instanceMatrix * vec4(position, 1.0);
                vAoMapUv = floorPoint.xz / vec2(8.3, 6.52) + 0.5;
            `);
        };
    }
    return { matte, enamel, light, wood, boards, rug };
}

// Intersect just the reflected eye ray with the known window plane. The bowl
// gets a moving four-pane reflection without a scene capture or reflection pass.
export function reflectBayWindow(shader) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 eye = normalize(vViewPosition);
        vec3 ray = inverseTransformDirection(reflect(-eye, normal), viewMatrix);
        vec3 surface = cameraPosition - inverseTransformDirection(eye, viewMatrix) * length(vViewPosition);
        float travel = (surface.x + 3.845) / max(-ray.x, 0.001);
        vec2 pane = surface.yz + travel * ray.yz - vec2(2.73, -1.52);
        vec2 border = 1.0 - smoothstep(vec2(0.88, 1.03), vec2(1.0, 1.145), abs(pane));
        vec2 bars = smoothstep(vec2(0.021), vec2(0.065), abs(pane + vec2(0.13, 0.0)));
        float reflection = border.x * border.y * bars.x * bars.y * step(0.001, -ray.x);
        outgoingLight = mix(outgoingLight, vec3(0.79, 0.96, 1.0), reflection);
        diffuseColor.a = min(0.86, diffuseColor.a + 0.60 * reflection);
        #include <opaque_fragment>
    `);
}
