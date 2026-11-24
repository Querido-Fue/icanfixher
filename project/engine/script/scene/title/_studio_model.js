import * as THREE from '../../../vendor/three-r160/three.module.min.js';
import { reflectBayWindow, studioFinishes } from './_studio_finishes.js';
import { STUDIO_RECORD } from './_studio_targets.js';
import { bayWindow, monitorFeed, sign, sleeve, studioPrint } from './_studio_art.js';

const ink = '#193c58', iron = '#527b91', pearl = '#ecfaf7', silver = '#a9cbcf';
const joinery = '#77989c', birch = '#e4d5af', coral = '#f48686', aqua = '#42d4c8';
const halfPi = Math.PI / 2;

/** Static props share geometry, material and draw calls, including the small desk controls. */
export function buildStudio(scene, gpu = true) {
    const geometries = {
        box: new THREE.BoxGeometry(1, 1, 1),
        drum: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
        taper: new THREE.CylinderGeometry(0.36, 0.5, 1, 24),
        ball: new THREE.SphereGeometry(0.5, 16, 12),
        ring: new THREE.TorusGeometry(0.47, 0.036, 8, 36)
    };
    const finishes = studioFinishes(gpu);
    const transform = new THREE.Object3D();
    const batches = new Map();
    const up = new THREE.Vector3(0, 1, 0);

    function part(shape, x, y, z, w, h, d, color, rotation = [0, 0, 0], finish = 'matte') {
        transform.position.set(x, y, z);
        transform.scale.set(w, h, d);
        if (rotation.isQuaternion) transform.quaternion.copy(rotation);
        else transform.rotation.set(...rotation);
        transform.updateMatrix();
        const key = shape + '-' + finish;
        if (!batches.has(key)) batches.set(key, { shape, material: finishes[finish], items: [] });
        batches.get(key).items.push([transform.matrix.clone(), new THREE.Color(color)]);
    }
    const box = (...args) => part('box', ...args);
    const wood = (x, y, z, w, h, d, color) => part('box', x, y, z, w, h, d, color, [0, 0, 0], 'wood');
    const drum = (...args) => part('drum', ...args);
    const ball = (...args) => part('ball', ...args);
    function rod(start, end, radius, color) {
        const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
        const delta = b.clone().sub(a);
        const mid = a.addScaledVector(delta, 0.5);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, delta.clone().normalize());
        drum(mid.x, mid.y, mid.z, radius * 2, delta.length(), radius * 2, color, quaternion);
    }
    function print(paint, pixels, size, position, yaw = 0) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), studioPrint(...pixels, paint));
        mesh.position.set(...position);
        mesh.rotation.y = yaw;
        scene.add(mesh);
    }

    // Close the former cutaway from the inside. Single-sided panels admit the existing studio lights.
    function interiorPanel(width, height, position, rotation, color) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
            new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
        panel.position.set(...position);
        panel.rotation.set(...rotation);
        panel.receiveShadow = true;
        scene.add(panel);
    }
    interiorPanel(6.52, 4.47, [4.065, 2.17, 0], [0, -halfPi, 0], '#b7dcd8');
    interiorPanel(8.29, 4.47, [0, 2.17, 3.18], [0, Math.PI, 0], '#a9d5de');
    interiorPanel(8.29, 6.52, [0, 4.38, 0], [halfPi, 0, 0], '#edf5ec');

    // Lacquered plinth, staggered boards, walls and picture rails.
    box(0, -0.31, 0, 8.46, 0.50, 6.66, '#245d7a');
    box(0, -0.095, 0, 8.34, 0.10, 6.54, silver);
    box(0, -0.035, 0, 8.26, 0.10, 6.46, joinery);
    for (let row = 0; row < 15; row++) {
        const z = -3 + row * 0.43;
        let x = -4.08;
        for (let n = 0; x < 4.07; n++) {
            const width = Math.min(4.08 - x, n === 0 && row % 2 ? 1.1 : 2.13);
            box(x + width / 2, 0.033, z, width - 0.014, 0.055, 0.421,
                ['#c9b996', '#ded1ac', '#ccbf9e', '#d8c8a4'][(row + n * 3) % 4], [0, 0, 0], 'boards');
            x += width;
        }
    }
    box(0, 2.18, -3.18, 8.28, 4.4, 0.16, '#a4d7d3');
    // A real opening admits the directional light. Its scenic insert is visible
    // from indoors but does not cast into the room.
    function wallSection(bottom, top, back, front) {
        box(-4.07, (bottom + top) / 2, (back + front) / 2,
            0.16, top - bottom, front - back, '#9bc8dd');
    }
    wallSection(-0.02, 4.38, -3.24, -2.665);
    wallSection(-0.02, 4.38, -0.375, 3.24);
    wallSection(-0.02, 1.73, -2.665, -0.375);
    wallSection(3.73, 4.38, -2.665, -0.375);
    box(0, 4.4, -3.18, 8.35, 0.13, 0.23, pearl);
    box(-4.07, 4.4, 0, 0.23, 0.13, 6.57, pearl);
    box(4.10, 2.17, -3.17, 0.09, 4.42, 0.22, birch);
    box(-4.07, 2.17, 3.22, 0.22, 4.42, 0.09, birch);
    box(0, 0.17, -3.04, 8.10, 0.23, 0.12, joinery);
    box(-3.93, 0.17, 0, 0.12, 0.23, 6.30, joinery);
    // Inset window, daylight on the bay, painted sash, and slatted valance.
    for (const z of [-2.71, -0.33]) box(-3.93, 2.73, z, 0.14, 2.22, 0.09, joinery);
    for (const y of [1.675, 3.785]) box(-3.93, y, -1.52, 0.14, 0.11, 2.29, joinery);
    print(bayWindow, [512, 384], [2.29, 2.0], [-3.845, 2.73, -1.52], halfPi);
    box(-3.80, 2.73, -1.52, 0.09, 2.08, 0.063, pearl);
    box(-3.80, 2.60, -1.52, 0.09, 0.065, 2.34, pearl);
    wood(-3.77, 1.66, -1.52, 0.37, 0.11, 2.62, birch);
    for (let i = 0; i < 3; i++) box(-3.77, 3.86 - i * 0.11, -1.52, 0.17, 0.075, 2.6, pearl);
    // Door with recessed panels and a silver latch.
    box(-3.92, 1.66, 1.54, 0.15, 3.22, 1.58, joinery);
    box(-3.82, 1.65, 1.54, 0.10, 3.08, 1.40, '#4ab1c4');
    for (const y of [0.89, 2.32]) {
        box(-3.756, y, 1.54, 0.045, 1.16, 1.07, '#3e97af');
        box(-3.725, y, 1.54, 0.024, 1.04, 0.95, '#83cbd3');
    }
    // A small circular pane gives the painted door a nautical silhouette.
    drum(-3.696, 2.38, 1.54, 0.74, 0.045, 0.74, silver, [0, 0, halfPi], 'enamel');
    ball(-3.666, 2.38, 1.54, 0.07, 0.57, 0.57, '#429db9', [0, 0, 0], 'enamel');
    ball(-3.624, 2.49, 1.56, 0.012, 0.034, 0.24, '#c9f3ff', [0.18, 0, 0], 'light');
    box(-3.69, 1.48, 2.02, 0.05, 0.29, 0.13, silver);
    ball(-3.62, 1.5, 2.02, 0.15, 0.12, 0.12, silver);
    // Woven oval rug with concentric bands and a fringed edge.
    const rug = [-0.12, 1.03];
    for (const [i, ratio] of [1, 0.95, 0.92, 0.86, 0.80, 0.77, 0.70].entries()) {
        drum(rug[0], 0.073 + i * 0.005, rug[1], 4.62 * ratio, 0.018, 2.93 * ratio,
            ['#327fa4', '#ccf5f8', '#439fbc', '#68c8ce', '#d8faea', '#59b4c2', '#96daca'][i], [0, 0, 0], 'rug');
    }
    for (let i = 0; i < 36; i++) {
        const angle = i * Math.PI / 18;
        box(rug[0] + Math.cos(angle) * 2.34, 0.073, rug[1] + Math.sin(angle) * 1.49,
            0.16, 0.014, 0.055, pearl, [0, -angle, 0]);
    }

    // Record shelf, displayed sleeve and leaning LP jackets.
    const shelfX = -2.50, shelfZ = -2.44;
    for (const x of [-3.57, -1.43]) box(x, 0.88, shelfZ, 0.11, 1.62, 0.82, joinery);
    for (const y of [0.23, 0.90, 1.65]) wood(shelfX, y, shelfZ, 2.23, 0.10, 0.88, birch);
    box(shelfX, 0.9, -2.83, 2.12, 1.44, 0.085, '#628c9a');
    for (let i = 0; i < 12; i++) {
        const h = 0.42 + (i * 7 % 5) * 0.045;
        box(-3.43 + i * 0.13, 0.29 + h / 2, -2.40, 0.101, h, 0.58,
            [coral, ink, aqua, pearl, silver][i % 5], [0, 0, i > 8 ? -0.08 : 0]);
    }
    box(-2.82, 1.22, -2.36, 1.05, 0.44, 0.60, '#669caf');
    box(-2.82, 1.24, -2.045, 0.94, 0.23, 0.025, ink);
    box(-2.94, 1.25, -2.025, 0.46, 0.08, 0.02, aqua);
    for (let i = 0; i < 3; i++) ball(-2.57 + i * 0.10, 1.22, -2.02, 0.068, 0.068, 0.05, silver);
    // Turntable, vinyl grooves, center label and tonearm.
    box(-2.56, 1.77, shelfZ, 1.32, 0.13, 0.72, ink);
    drum(-2.72, 1.848, shelfZ, 0.70, 0.025, 0.70, iron);
    // Prop the record above its turntable so its face reads from standing height.
    const recordCenter = new THREE.Vector3(...STUDIO_RECORD.center);
    const recordNormal = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...STUDIO_RECORD.rotation));
    const recordRotation = new THREE.Quaternion().setFromUnitVectors(up, recordNormal);
    for (const [i, ratio] of [1, 0.93, 0.77, 0.64, 0.31, 0.063].entries()) {
        const center = recordCenter.clone().addScaledVector(recordNormal, -0.024 + 0.0035 * i);
        const diameter = STUDIO_RECORD.size[0] * ratio;
        drum(...center, diameter, 0.009, diameter, [iron, ink, '#294766', ink, aqua, ink][i], recordRotation);
    }
    rod([-2.08, 1.88, -2.64], [-2.38, 1.91, -2.36], 0.022, pearl);
    box(-2.54, 2.96, -3.035, 1.44, 1.87, 0.085, joinery);
    print(sleeve, [240, 320], [1.31, 1.73], [-2.54, 2.96, -2.982]);

    // The shelf mascot and taped photographs make the room personal to Aqua.
    ball(-1.68, 1.86, -2.39, 0.27, 0.34, 0.24, pearl);
    ball(-1.68, 2.06, -2.37, 0.32, 0.25, 0.24, pearl);
    for (const x of [-1.80, -1.56]) {
        part('taper', x, 2.19, -2.38, 0.09, 0.12, 0.10, pearl);
        ball(x < -1.68 ? -1.74 : -1.62, 2.065, -2.255, 0.029, 0.035, 0.023, ink);
    }
    ball(-1.68, 2.015, -2.25, 0.05, 0.033, 0.018, coral);
    for (let i = 0; i < 2; i++) {
        const x = -1.40 + i * 0.47, y = 3.18 - i * 0.29, tilt = i ? -0.13 : 0.09;
        box(x, y, -3.058, 0.41, 0.50, 0.028, pearl, [0, 0, tilt]);
        box(x, y + 0.027, -3.038, 0.33, 0.31, 0.018, i ? aqua : coral, [0, 0, tilt]);
        ball(x, y + 0.07, -3.024, 0.11, 0.11, 0.018, i ? '#c9f19b' : '#fce5b5');
        box(x, y + 0.248, -3.017, 0.15, 0.06, 0.02, silver, [0, 0, -tilt]);
    }

    // Broadcast desk, monitor arm, preview, webcam, mixer and keyboard.
    wood(1.08, 1.32, -2.20, 4.44, 0.16, 1.48, birch);
    box(1.08, 1.226, -2.20, 4.35, 0.045, 1.39, joinery);
    for (const x of [-0.88, 3.04]) for (const z of [-2.76, -1.66]) {
        box(x, 0.66, z, 0.12, 1.20, 0.12, ink);
    }
    box(1.10, 1.423, -1.98, 2.60, 0.04, 0.78, '#64b9be');
    box(1.08, 1.47, -2.61, 0.85, 0.085, 0.42, iron);
    box(1.08, 1.72, -2.66, 0.14, 0.43, 0.11, ink);
    box(1.08, 2.21, -2.65, 2.32, 1.26, 0.14, pearl, [0, 0, 0], 'enamel');
    print(monitorFeed, [512, 256], [2.20, 1.125], [1.08, 2.21, -2.57]);
    box(1.08, 2.91, -2.61, 0.35, 0.15, 0.18, iron);
    ball(1.09, 2.915, -2.51, 0.09, 0.09, 0.04, aqua);
    box(1.12, 1.47, -1.87, 1.27, 0.072, 0.43, pearl);
    for (let row = 0; row < 3; row++) for (let key = 0; key < 12; key++) {
        box(0.57 + key * 0.10, 1.517, -2.0 + row * 0.105, 0.078, 0.023, 0.073,
            [ink, '#87a4b3', '#6e96aa'][row]);
    }
    ball(2.02, 1.51, -1.85, 0.18, 0.13, 0.25, pearl);
    box(-0.36, 1.48, -1.83, 0.60, 0.12, 0.36, iron);
    for (let i = 0; i < 8; i++) {
        box(-0.56 + i % 4 * 0.126, 1.55, -1.91 + Math.floor(i / 4) * 0.13,
            0.082, 0.024, 0.078, ['#42e0d0','#83eb75','#a6deff'][i % 3], [0, 0, 0], 'light');
    }
    drum(2.50, 1.56, -1.75, 0.22, 0.27, 0.22, coral);
    drum(2.50, 1.70, -1.75, 0.19, 0.014, 0.19, pearl);
    drum(2.50, 1.708, -1.75, 0.158, 0.006, 0.158, joinery);
    part('ring', 2.63, 1.58, -1.75, 0.16, 0.18, 0.37, coral);
    // A headset hangs from a silver peg on the front apron.
    rod([2.80, 1.27, -1.48], [2.80, 1.27, -1.37], 0.038, silver);
    part('ring', 2.80, 1.08, -1.37, 0.40, 0.46, 0.66, iron);
    for (const x of [2.59, 3.01]) {
        ball(x, 1.02, -1.37, 0.15, 0.23, 0.17, ink);
        ball(x, 1.02, -1.28, 0.11, 0.16, 0.028, aqua);
    }
    // Articulated boom with a suspended mic and pop shield.
    rod([-0.83, 1.39, -2.61], [-0.95, 2.07, -2.53], 0.045, ink);
    rod([-0.95, 2.07, -2.53], [-0.50, 2.49, -2.28], 0.041, iron);
    rod([-0.50, 2.49, -2.28], [-0.20, 2.26, -1.97], 0.039, ink);
    rod([-0.20, 2.26, -1.97], [-0.18, 2.02, -1.91], 0.092, ink);
    ball(-0.18, 2.01, -1.91, 0.18, 0.15, 0.18, iron);
    drum(-0.16, 2.085, -1.74, 0.26, 0.028, 0.26, '#3e738c', [halfPi, 0, 0]);
    // Desk lamp and acoustic treatment.
    drum(2.82, 1.446, -2.31, 0.42, 0.07, 0.42, silver);
    rod([2.82, 1.46, -2.31], [2.86, 2.13, -2.43], 0.032, silver);
    rod([2.86, 2.13, -2.43], [2.63, 2.29, -2.39], 0.032, silver);
    ball(2.62, 2.16, -2.39, 0.58, 0.31, 0.56, '#92d657', [0, 0, 0], 'enamel');
    drum(2.62, 2.095, -2.39, 0.50, 0.025, 0.49, '#eaffbc', [0, 0, 0], 'light');
    ball(2.62, 2.25, -2.22, 0.21, 0.043, 0.05, '#e5ffc1', [0.2, 0.2, -0.10], 'light');
    for (let i = 0; i < 10; i++) box(2.33 + i * 0.154, 2.64, -3.03,
        0.10, 2.60, 0.12, i % 2 ? joinery : birch);
    box(0.94, 3.48, -3.015, 1.86, 0.58, 0.10, ink);
    print(sign, [292, 90], [1.73, 0.49], [0.94, 3.48, -2.95]);

    // Upholstered swivel chair, star base and wheels.
    const cx = 0.98, cz = -0.48;
    drum(cx, 0.54, cz, 0.12, 0.74, 0.12, iron);
    for (let i = 0; i < 5; i++) {
        const a = i * 2 * Math.PI / 5;
        const x = cx + Math.cos(a) * 0.58, z = cz + Math.sin(a) * 0.58;
        rod([cx, 0.32, cz], [x, 0.20, z], 0.045, iron);
        ball(x, 0.16, z, 0.16, 0.16, 0.14, ink);
    }
    const turn = -0.43;
    function chairBox(dx, y, dz, w, h, d, color, pitch = 0) {
        const x = cx + dx * Math.cos(turn) + dz * Math.sin(turn);
        const z = cz - dx * Math.sin(turn) + dz * Math.cos(turn);
        box(x, y, z, w, h, d, color, [pitch, turn, 0]);
    }
    chairBox(0, 0.93, 0, 1.01, 0.22, 0.91, '#45a9bb');
    chairBox(0, 1.57, 0.41, 0.94, 1.18, 0.23, '#287a9b', 0.10);
    chairBox(0, 1.63, 0.54, 0.79, 0.95, 0.09, '#4aabbd', 0.10);
    chairBox(0, 2.14, 0.49, 0.66, 0.29, 0.23, '#97d9d4');
    for (const dx of [-0.53, 0.53]) {
        chairBox(dx, 1.10, 0, 0.065, 0.35, 0.1, iron);
        chairBox(dx, 1.28, 0, 0.11, 0.08, 0.49, ink);
    }
    // Tower and illuminated fan rings.
    box(3.19, 0.665, -0.94, 0.65, 1.18, 0.92, '#d0e7e9');
    box(3.19, 0.665, -0.464, 0.55, 1.05, 0.033, '#4e8ea5');
    for (const y of [0.43, 0.88]) {
        part('ring', 3.19, y, -0.435, 0.37, 0.37, 0.37, '#8af8df', [0, 0, 0], 'light');
        ball(3.19, y, -0.426, 0.08, 0.08, 0.04, aqua);
    }
    // Broad leaves on separate stems break up the hard furniture silhouettes.
    function plant(x, z, scale) {
        const y = 0.075;
        part('taper', x, y + 0.30 * scale, z, 0.68 * scale, 0.60 * scale, 0.68 * scale, pearl, [Math.PI, 0, 0], 'enamel');
        drum(x, y + 0.59 * scale, z, 0.66 * scale, 0.08 * scale, 0.66 * scale, '#9fc1c0');
        drum(x, y + 0.64 * scale, z, 0.56 * scale, 0.02 * scale, 0.56 * scale, '#556450');
        for (let i = 0; i < 9; i++) {
            const a = i * 2.4, radius = (0.25 + i % 3 * 0.12) * scale;
            const end = [x + Math.cos(a) * radius, y + (1.09 + i % 4 * 0.14) * scale, z + Math.sin(a) * radius];
            rod([x, y + 0.61 * scale, z], end, 0.018 * scale, '#579047');
            ball(...end, 0.29 * scale, 0.63 * scale, 0.12 * scale,
                ['#5ea75d','#90c870','#b1da75'][i % 3], [0.40, -a, -0.63]);
        }
    }
    // Open glass fishbowl, seen at eye level on the way to the record shelf.
    const bowlX = -3.04, bowlZ = -0.22, bowlY = 1.56;
    drum(bowlX, 0.14, bowlZ, 0.93, 0.15, 0.93, silver);
    part('taper', bowlX, 0.55, bowlZ, 0.35, 0.75, 0.35, pearl, [0, 0, 0], 'enamel');
    drum(bowlX, 0.95, bowlZ, 1.01, 0.12, 1.01, pearl, [0, 0, 0], 'enamel');
    const glassShape = new THREE.SphereGeometry(0.68, 36, 24, 0, Math.PI * 2, 0.66, 2.01);
    const glass = new THREE.Mesh(glassShape, new THREE.MeshPhongMaterial({
        color: '#9beaf0', specular: '#ffffff', shininess: 95,
        transparent: true, opacity: 0.17, depthWrite: false
    }));
    if (gpu) glass.material.onBeforeCompile = reflectBayWindow;
    glass.position.set(bowlX, bowlY, bowlZ);
    glass.renderOrder = 2;
    scene.add(glass);
    // Color on the far side leaves the fish and the stems visible through the front.
    const water = new THREE.Mesh(new THREE.SphereGeometry(0.65, 36, 24, 0, 2 * Math.PI, 1.0, 1.66),
        new THREE.MeshBasicMaterial({ color: '#2daacb', side: THREE.BackSide, transparent: true, opacity: 0.62, depthWrite: false }));
    water.position.copy(glass.position);
    water.renderOrder = 1;
    scene.add(water);
    part('ring', bowlX, bowlY + 0.535, bowlZ, 0.88, 0.88, 0.53, '#cbf6f3', [halfPi, 0, 0], 'enamel');
    part('ring', bowlX, bowlY + 0.35, bowlZ, 1.15, 1.15, 0.30, '#94e8ed', [halfPi, 0, 0], 'light');
    ball(bowlX, 1.07, bowlZ, 0.81, 0.17, 0.79, '#cdbf8e');
    for (let i = 0; i < 5; i++) {
        const x = bowlX - 0.22 + 0.055 * i;
        ball(x, 1.26 + 0.035 * (i % 3), bowlZ - 0.10, 0.068, 0.44 + (i % 3) * 0.09,
            0.059, i % 2 ? '#80c94e' : '#4ba174', [0.12, 0.15, (i - 2) * 0.18]);
    }
    for (const [dx, dy, dz, scale, facing] of [[0.09, 0.03, 0.20, 1, 1], [-0.17, 0.22, 0.01, 0.7, -1]]) {
        const x = bowlX + dx, y = bowlY + dy, z = bowlZ + dz;
        ball(x, y, z, 0.39 * scale, 0.20 * scale, 0.14 * scale, '#ff8e49', [0, 0, 0], 'enamel');
        part('taper', x - facing * 0.22 * scale, y, z, 0.16 * scale, 0.15 * scale, 0.058 * scale,
            '#f98048', [0, 0, -facing * halfPi]);
        ball(x - facing * 0.047 * scale, y, z, 0.058 * scale, 0.194 * scale, 0.15 * scale, pearl);
        ball(x + facing * 0.112 * scale, y + 0.025 * scale, z + 0.055 * scale, 0.036 * scale, 0.036 * scale, 0.022 * scale, ink);
    }
    for (const [dx, dy, dz, diameter] of [[0.31, 0.14, 0.24, 0.055], [0.34, 0.23, 0.22, 0.075]]) {
        ball(bowlX + dx, bowlY + dy, bowlZ + dz, diameter, diameter, diameter, '#baf3ff', [0, 0, 0], 'enamel');
    }
    ball(bowlX + 0.08, bowlY + 0.30, bowlZ + 0.592, 0.18, 0.052, 0.027, '#e9ffff', [-0.24, 0.2, -0.38], 'light');
    plant(3.28, -2.56, 0.84);

    for (const { shape, material, items } of batches.values()) {
        const mesh = new THREE.InstancedMesh(geometries[shape], material, items.length);
        items.forEach(([matrix, color], i) => { mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color); });
        mesh.castShadow = mesh.receiveShadow = material !== finishes.light;
        scene.add(mesh);
    }
}
