import * as THREE from '../../../vendor/three-r160/three.module.min.js';
import { TITLE_SCENE_CONSTANTS as SHOTS } from '../../data/scene/title/title_scene_constants.js';
import { buildStudio } from './_studio_model.js';

// Exact critically damped spring step. A new destination preserves velocity mid-flight.
function damp(value, velocity, goal, dt) {
    const rate = 9.5, decay = Math.exp(-rate * dt);
    const offset = value - goal;
    const tangent = velocity + rate * offset;
    return [(offset + tangent * dt) * decay + goal, (velocity - tangent * rate * dt) * decay];
}

function shotValues(shot) {
    return [...shot.eye, ...shot.look, shot.width, shot.height];
}

export class StudioRoom {
    constructor(host) {
        this.host = host;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 70);
        this.values = shotValues(SHOTS.overview);
        this.goal = this.values.slice();
        this.speed = this.values.map(() => 0);
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
        try {
            this.renderer.setClearColor(0, 0);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = false;
            this.renderer.shadowMap.needsUpdate = true;
            const sky = new THREE.HemisphereLight('#fff2e7', '#b9a1ba', 1.75);
            const key = new THREE.DirectionalLight('#ffdec2', 2.30);
            key.position.set(3.6, 8.8, 4.8);
            key.castShadow = true;
            Object.assign(key.shadow.camera, { left: -6.3, right: 6.3, top: 6, bottom: -5.6, far: 24 });
            key.shadow.camera.updateProjectionMatrix();
            key.shadow.mapSize.set(1024, 1024);
            key.shadow.normalBias = 0.018;
            key.shadow.bias = -0.00035;
            const rim = new THREE.DirectionalLight('#a6c4e9', 0.94);
            rim.position.set(-4, 4, -2);
            const lamp = new THREE.PointLight('#ffc385', 5, 4);
            lamp.position.set(2.63, 1.98, -2.36);
            this.scene.add(sky, key, rim, lamp);
            buildStudio(this.scene);
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
        const overview = shotValues(SHOTS.overview);
        this.goal = shotValues(SHOTS[id]).map((target, i) => THREE.MathUtils.lerp(overview[i], target, strength));
    }

    advance(seconds) {
        const dt = Math.min(0.12, Math.max(0, seconds));
        let moving = false;
        for (let i = 0; i < this.values.length; i++) {
            const current = this.values[i], goal = this.goal[i];
            if (current === goal && this.speed[i] === 0) continue;
            const [value, speed] = damp(current, this.speed[i], goal, dt);
            if (this.reducedMotion.matches || (Math.abs(value - goal) < 0.015 && Math.abs(speed) < 0.1)) {
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
        this.aspect = Math.max(1, width) / Math.max(1, height);
        this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
        this.dirty = true;
    }

    render() {
        if (!this.dirty) return;
        const [x, y, z, tx, ty, tz, width, height] = this.values;
        const halfHeight = Math.max(height, width / this.aspect) * 0.5;
        this.camera.position.set(x, y, z);
        this.camera.lookAt(tx, ty, tz);
        this.camera.top = halfHeight;
        this.camera.bottom = -halfHeight;
        this.camera.right = halfHeight * this.aspect;
        this.camera.left = -this.camera.right;
        this.camera.updateProjectionMatrix();
        this.renderer.render(this.scene, this.camera);
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
        for (const material of materials) { material.map?.dispose(); material.dispose(); }
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer.domElement.remove();
    }
}
