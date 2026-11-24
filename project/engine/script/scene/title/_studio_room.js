import * as THREE from '../../../vendor/three-r160/three.module.min.js';
import { TITLE_SCENE_CONSTANTS as SHOTS, TITLE_EYE_HEIGHT } from '../../data/scene/title/title_scene_constants.js';
import { StudioLens } from './_studio_lens.js';
import { buildStudioTargets } from './_studio_targets.js';
import { buildStudio } from './_studio_model.js';

// Exact critically damped spring step. A new destination preserves velocity mid-flight.
function damp(value, velocity, goal, dt) {
    const rate = 6.8, decay = Math.exp(-rate * dt);
    const offset = value - goal;
    const tangent = velocity + rate * offset;
    return [(offset + tangent * dt) * decay + goal, (velocity - tangent * rate * dt) * decay];
}

function shotValues(shot) {
    return [...shot.floor, ...shot.look];
}

export class StudioRoom {
    constructor(host, StillRenderer = null) {
        this.host = host;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(63, 1, 0.045, 30);
        this.values = shotValues(SHOTS.overview);
        this.goal = this.values.slice();
        this.speed = this.values.map(() => 0);
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.projected = new THREE.Vector3();
        this.isStill = StillRenderer !== null;
        this.touchScreen = window.matchMedia('(pointer: coarse)');
        this.renderer = this.isStill ? new StillRenderer() :
            new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
        try {
            if (!this.isStill) {
                if (!this.renderer.capabilities.isWebGL2 && !this.renderer.extensions.has('ANGLE_instanced_arrays')) {
                    throw new Error('The studio needs instanced drawing');
                }
                this.renderer.setClearColor('#101b36');
                this.lens = new StudioLens(this.renderer);
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                this.renderer.shadowMap.autoUpdate = false;
                this.renderer.shadowMap.needsUpdate = true;
            }
            const sky = new THREE.HemisphereLight('#adc6ff', '#798bb0', 0.73);
            // Cool window light keeps the silhouette of the mullions on the floor.
            const key = new THREE.DirectionalLight('#bdeaff', 2.16);
            key.position.set(-8.2, 6.65, -3.35);
            key.target.position.set(0.15, 0.0, 0.37);
            key.castShadow = true;
            Object.assign(key.shadow.camera, { left: -6.3, right: 6.3, top: 6, bottom: -5.6, far: 24 });
            key.shadow.camera.updateProjectionMatrix();
            const shadowSize = this.touchScreen.matches ? 512 : 1024;
            key.shadow.mapSize.set(shadowSize, shadowSize);
            key.shadow.normalBias = 0.018;
            key.shadow.bias = -0.00035;
            const fill = new THREE.DirectionalLight('#91afff', 0.58);
            fill.position.set(2.1, 4.5, 4.3);
            const lamp = new THREE.PointLight('#a9dcff', 1.65, 3.1);
            lamp.position.set(2.63, 1.98, -2.36);
            const screenLight = new THREE.PointLight('#6fd9ff', 1.38, 2.4);
            screenLight.position.set(1.08, 2.07, -2.40);
            this.scene.add(sky, key, key.target, fill, lamp, screenLight);
            buildStudio(this.scene, !this.isStill);
            this.targets = buildStudioTargets(this.scene, !this.isStill);
            this.renderer.domElement.setAttribute('aria-hidden', 'true');
            host.append(this.renderer.domElement);
            this.resize();
            this.render();
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    frame(id, strength = 1) {
        const origin = shotValues(SHOTS.overview);
        // On focus, turn towards the object first. Activation completes the walk up to it.
        this.goal = shotValues(SHOTS[id]).map((value, i) =>
            THREE.MathUtils.lerp(origin[i], value, i < 2 ? strength * strength : strength)
        );
    }

    advance(seconds) {
        const dt = Math.min(0.12, Math.max(0, seconds));
        let moving = false;
        for (let i = 0; i < this.values.length; i++) {
            const current = this.values[i], goal = this.goal[i];
            if (current === goal && this.speed[i] === 0) continue;
            const [value, speed] = damp(current, this.speed[i], goal, dt);
            if (this.isStill || this.reducedMotion.matches || (Math.abs(value - goal) < 0.015 && Math.abs(speed) < 0.1)) {
                this.values[i] = goal;
                this.speed[i] = 0;
            } else {
                this.values[i] = value;
                this.speed[i] = speed;
                moving = true;
            }
            this.dirty = true;
        }
        return !moving;
    }

    resize() {
        const { width, height } = this.host.getBoundingClientRect();
        const w = Math.max(1, width), h = Math.max(1, height);
        this.width = w;
        this.height = h;
        const aspect = w / h;
        // Keep the door, record and screen within a single standing view on narrow phones.
        const portraitFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(38)) / aspect);
        this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(portraitFov), 63, 126);
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        if (this.isStill) {
            this.renderer.setSize(w, h, false);
        } else {
            const compact = this.touchScreen.matches || w <= 720;
            const maxPixels = compact ? 720000 : 2100000;
            const ratio = Math.min(window.devicePixelRatio || 1, compact ? 1.4 : 1.75,
                Math.sqrt(maxPixels / (w * h)), this.renderer.capabilities.maxTextureSize / Math.max(w, h));
            this.renderer.setDrawingBufferSize(w, h, ratio);
            if (this.lens && !this.lens.resize(this.renderer)) {
                this.lens.dispose();
                this.lens = null;
            }
        }
        this.dirty = true;
    }

    highlight(id) {
        if (this.highlighted === id || this.isStill) return;
        this.highlighted = id;
        for (const [name, { material }] of Object.entries(this.targets)) {
            material.uniforms.emphasis.value = name === id ? 1.45 : 0.64;
        }
        this.dirty = true;
    }

    targetBounds(id) {
        const { width, height, projected, camera } = this;
        let left = width, right = 0, top = height, bottom = 0;
        for (const corner of this.targets[id].corners) {
            projected.copy(corner).project(camera);
            if (projected.z < -1 || projected.z > 1) return null;
            const x = width * (1 + projected.x) / 2;
            const y = height * (1 - projected.y) / 2;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
        }
        if (right <= 0 || left >= width || bottom <= 0 || top >= height) return null;
        left = Math.max(0, left);
        right = Math.min(width, right);
        top = Math.max(0, top);
        bottom = Math.min(height, bottom);
        const x = THREE.MathUtils.clamp((left + right) / 2, 22, width - 22);
        const y = THREE.MathUtils.clamp((top + bottom) / 2, 22, height - 22);
        return { x, y, width: Math.max(44, right - left), height: Math.max(44, bottom - top) };
    }

    render() {
        if (!this.dirty) return false;
        const [x, z, tx, ty, tz] = this.values;
        this.camera.position.set(x, TITLE_EYE_HEIGHT, z);
        this.camera.lookAt(tx, ty, tz);
        this.camera.updateMatrixWorld();
        if (this.lens) {
            const focus = Math.hypot(tx - x, ty - TITLE_EYE_HEIGHT, tz - z);
            this.lens.render(this.renderer, this.scene, this.camera, focus);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        this.dirty = false;
        return true;
    }

    dispose() {
        const geometries = new Set(), materials = new Set();
        this.scene.traverse(object => {
            if (object.isInstancedMesh) object.dispose();
            if (object.geometry) geometries.add(object.geometry);
            if (object.material) materials.add(object.material);
            object.shadow?.dispose();
        });
        for (const geometry of geometries) geometry.dispose();
        const textures = new Set();
        for (const material of materials) {
            if (material.map) textures.add(material.map);
            if (material.aoMap) textures.add(material.aoMap);
            material.dispose();
        }
        for (const texture of textures) texture.dispose();
        this.lens?.dispose();
        this.renderer.dispose();
        this.renderer.forceContextLoss?.();
        this.renderer.domElement.remove();
    }
}
