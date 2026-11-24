import * as THREE from '../../../vendor/three-r160/three.module.min.js';

// The room is static. Only moving the eye or resizing the view schedules a frame.
// One RGBA8 scene texture feeds one lens pass, including on tile-based mobile GPUs.
export class StudioLens {
    constructor(renderer) {
        const hasDepth = renderer.capabilities.isWebGL2 || renderer.extensions.has('WEBGL_depth_texture');
        this.target = new THREE.WebGLRenderTarget(1, 1, {
            minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
            type: THREE.UnsignedByteType, stencilBuffer: false
        });
        if (hasDepth) this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedShortType);
        this.material = new THREE.ShaderMaterial({
            defines: hasDepth ? { USE_FOCUS_DEPTH: 1 } : {},
            uniforms: {
                roomColor: { value: this.target.texture },
                roomDepth: { value: this.target.depthTexture },
                texel: { value: new THREE.Vector2() },
                clipRange: { value: new THREE.Vector2() },
                focusDistance: { value: 1 },
                blurPixels: { value: 1 }
            },
            depthTest: false, depthWrite: false, toneMapped: false,
            vertexShader: `
                varying vec2 screenUV;
                void main() {
                    screenUV = position.xy * 0.5 + 0.5;
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }`,
            fragmentShader: `
                uniform sampler2D roomColor;
                uniform vec2 texel;
                #ifdef USE_FOCUS_DEPTH
                    uniform sampler2D roomDepth;
                    uniform vec2 clipRange;
                    uniform float focusDistance;
                    uniform float blurPixels;
                #endif
                varying vec2 screenUV;
                void main() {
                    float radius = 0.5;
                    #ifdef USE_FOCUS_DEPTH
                        float depth = texture2D(roomDepth, screenUV).r;
                        float viewZ = clipRange.x * clipRange.y /
                            mix(clipRange.y, clipRange.x, depth);
                        float defocus = abs(1.0 - focusDistance / viewZ);
                        radius += blurPixels * smoothstep(0.08, 0.82, defocus);
                    #endif
                    vec2 stepUV = radius * texel;
                    vec3 center = texture2D(roomColor, screenUV).rgb;
                    vec3 a = texture2D(roomColor, screenUV + stepUV * vec2(0.92, 0.38)).rgb;
                    vec3 b = texture2D(roomColor, screenUV + stepUV * vec2(-0.38, 0.92)).rgb;
                    vec3 c = texture2D(roomColor, screenUV - stepUV * vec2(0.92, 0.38)).rgb;
                    vec3 d = texture2D(roomColor, screenUV - stepUV * vec2(-0.38, 0.92)).rgb;
                    vec3 surround = (a + b + c + d) * 0.25;
                    vec3 color = mix(center, surround, mix(0.28, 0.78, smoothstep(0.5, 2.0, radius)));
                    // Spill from nearby highlights only. The monitor's dark lettering stays crisp.
                    vec3 glow = max(a - 0.64, 0.0) + max(b - 0.64, 0.0)
                              + max(c - 0.64, 0.0) + max(d - 0.64, 0.0);
                    color += glow * 0.045;
                    float lightness = dot(color, vec3(0.2126, 0.7152, 0.0722));
                    color *= mix(vec3(0.52, 0.63, 0.91), vec3(0.83, 0.95, 1.04),
                                 smoothstep(0.035, 0.60, lightness));
                    color += vec3(0.002, 0.004, 0.011);
                    vec2 edge = 2.0 * screenUV - 1.0;
                    color *= 1.0 - 0.31 * smoothstep(0.32, 1.83, dot(edge, edge));
                    gl_FragColor = vec4(color, 1.0);
                    #include <colorspace_fragment>
                }`
        });
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
        const triangle = new THREE.Mesh(this.geometry, this.material);
        triangle.frustumCulled = false;
        this.scene = new THREE.Scene();
        this.scene.add(triangle);
        this.camera = new THREE.Camera();
    }

    resize(renderer) {
        const { width, height } = renderer.domElement;
        this.target.setSize(width, height);
        this.material.uniforms.texel.value.set(1 / width, 1 / height);
        this.material.uniforms.blurPixels.value = Math.min(4, 0.0045 * height);
        // Some WebGL drivers advertise depth textures but cannot attach this format.
        const gl = renderer.getContext();
        renderer.setRenderTarget(this.target);
        const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        renderer.setRenderTarget(null);
        if (!complete && this.target.depthTexture && !gl.isContextLost()) {
            this.target.dispose();
            this.target.depthTexture = null;
            this.material.uniforms.roomDepth.value = null;
            delete this.material.defines.USE_FOCUS_DEPTH;
            this.material.needsUpdate = true;
            return this.resize(renderer);
        }
        return complete;
    }

    render(renderer, scene, camera, distance) {
        this.material.uniforms.clipRange.value.set(camera.near, camera.far);
        this.material.uniforms.focusDistance.value = distance;
        renderer.setRenderTarget(this.target);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(this.scene, this.camera);
    }

    dispose() {
        this.target.dispose();
        this.material.dispose();
        this.geometry.dispose();
    }
}
