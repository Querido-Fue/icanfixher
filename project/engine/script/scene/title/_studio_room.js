import * as THREE from '../../../vendor/three-r160/three.module.min.js';
import { TITLE_SCENE_CONSTANTS as SHOTS, TITLE_EYE_HEIGHT } from '../../data/scene/title/title_scene_constants.js';
import { StudioLens } from './_studio_lens.js';
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
        this.camera = new THREE.PerspectiveCamera(59, 1, 0.045, 30);
        this.values = shotValues(SHOTS.overview);
        this.goal = this.values.slice();
        this.speed = this.values.map(() => 0);
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.isStill = StillRenderer !== null;
        this.touchScreen = window.matchMedia('(pointer: coarse)');
        this.renderer = this.isStill ? new StillRenderer() :
            new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
        try {
            if (!this.isStill) {
                this.renderer.setClearColor('#c4e4df');
                this.lens = new StudioLens(this.renderer);
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                this.renderer.shadowMap.autoUpdate = false;
                this.renderer.shadowMap.needsUpdate = true;
            }
            const sky = new THREE.HemisphereLight('#d9efff', '#dcc5a6', 1.16);
            // Grazing sun enters through the cut-out bay window and its real mullions.
            const key = new THREE.DirectionalLight('#ffdeb0', 2.65);
            key.position.set(-8.2, 6.65, -3.35);
            key.target.position.set(0.15, 0.0, 0.37);
            key.castShadow = true;
            Object.assign(key.shadow.camera, { left: -6.3, right: 6.3, top: 6, bottom: -5.6, far: 24 });
            key.shadow.camera.updateProjectionMatrix();
            const shadowSize = this.touchScreen.matches ? 512 : 1024;
            key.shadow.mapSize.set(shadowSize, shadowSize);
            key.shadow.normalBias = 0.018;
            key.shadow.bias = -0.00035;
            const fill = new THREE.DirectionalLight('#e1f5ff', 1.27);
            fill.position.set(2.1, 4.5, 4.3);
            const lamp = new THREE.PointLight('#fff0b1', 3.1, 3.1);
            lamp.position.set(2.63, 1.98, -2.36);
            this.scene.add(sky, key, key.target, fill, lamp);
            buildStudio(this.scene, !this.isStill);
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
        const aspect = w / h;
        // Keep a comfortable horizontal field on the portrait stage without a zoom during motion.
        const portraitFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / aspect);
        this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(portraitFov), 59, 78);
        const stacked = window.matchMedia('(max-aspect-ratio: 1/1)').matches;
        // Place the point of interest beside the desktop menu or above the mobile controls.
        this.camera.setViewOffset(w, h, stacked ? 0 : -0.125 * w, 0, w, h);
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

    render() {
        if (!this.dirty) return;
        const [x, z, tx, ty, tz] = this.values;
        this.camera.position.set(x, TITLE_EYE_HEIGHT, z);
        this.camera.lookAt(tx, ty, tz);
        if (this.lens) {
            const focus = Math.hypot(tx - x, ty - TITLE_EYE_HEIGHT, tz - z);
            this.lens.render(this.renderer, this.scene, this.camera, focus);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        this.dirty = false;
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
