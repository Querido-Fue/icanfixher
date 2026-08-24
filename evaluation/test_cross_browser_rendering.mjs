import assert from 'node:assert/strict';
import fs from 'node:fs';

/** 브라우저 import를 테스트 의존성으로 치환해 클래스를 불러옵니다. */
function loadInjectedClass(relativePath, exportName, dependencies) {
    const sourceUrl = new URL(relativePath, import.meta.url);
    let source = fs.readFileSync(sourceUrl, 'utf8');
    source = source.replace(/^[ \t]*import\b[\s\S]*?;[ \t]*\r?\n/gm, '');
    source = source.replace(`export class ${exportName}`, `class ${exportName}`);
    const names = Object.keys(dependencies);
    const factory = new Function(
        ...names,
        `"use strict";\n${source}\nreturn ${exportName};\n//# sourceURL=${sourceUrl.pathname}`
    );
    return factory(...Object.values(dependencies));
}

/** 브라우저 import를 테스트 의존성으로 치환해 지정한 함수를 불러옵니다. */
function loadInjectedFunctions(relativePath, exportNames, dependencies) {
    const sourceUrl = new URL(relativePath, import.meta.url);
    let source = fs.readFileSync(sourceUrl, 'utf8');
    source = source.replace(/^[ \t]*import\b[\s\S]*?;[ \t]*\r?\n/gm, '');
    source = source.replace(/export function\s+/gu, 'function ');
    const names = Object.keys(dependencies);
    const factory = new Function(
        ...names,
        `"use strict";\n${source}\nreturn { ${exportNames.join(', ')} };\n//# sourceURL=${sourceUrl.pathname}`
    );
    return factory(...Object.values(dependencies));
}

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

/** Retina backing store가 1080p 물리 타깃 상한과 renderScale을 함께 지키는지 검증합니다. */
async function testRenderTargetCap() {
    const createScreenHandler = (viewport, renderScale) => loadInjectedClass(
        '../project/engine/script/display/_screen_handler.js',
        'ScreenHandler',
        {
            getData: (key) => {
                assert.equal(key, 'GLOBAL_CONSTANTS');
                return { ASPECT_RATIO: { RATIO: 16 / 9 } };
            },
            getSetting: (key) => {
                assert.equal(key, 'renderScale');
                return renderScale;
            },
            clampNumber,
            window: viewport
        }
    );

    const retinaViewport = { innerWidth: 1440, innerHeight: 900, devicePixelRatio: 2 };
    const FullScaleScreenHandler = createScreenHandler(retinaViewport, 100);
    const fullScale = new FullScaleScreenHandler();
    await fullScale.init();
    assert.equal(fullScale.baseWidth, 2880);
    assert.equal(fullScale.baseHeight, 1620);
    assert.equal(fullScale.width, 1920);
    assert.equal(fullScale.height, 1080);

    const ReducedScaleScreenHandler = createScreenHandler(retinaViewport, 75);
    const reducedScale = new ReducedScaleScreenHandler();
    await reducedScale.init();
    assert.equal(reducedScale.width, 1440);
    assert.equal(reducedScale.height, 810);

    const ordinaryViewport = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1.2 };
    const OrdinaryScreenHandler = createScreenHandler(ordinaryViewport, 100);
    const ordinary = new OrdinaryScreenHandler();
    await ordinary.init();
    assert.equal(ordinary.width, 1536);
    assert.equal(ordinary.height, 864);
}

/** 동적 2D surface도 제한 렌더 타깃을 사용하고 핵심 정적 UI만 native DPR을 유지하는지 검증합니다. */
function testDynamicSurfaceResolutionPolicy() {
    const { usesNativeDisplay2DResolution } = loadInjectedFunctions(
        '../project/engine/script/display/display_surface_descriptor.js',
        ['usesNativeDisplay2DResolution'],
        {
            getData: () => ({
                WEBGL_RENDER_MODES: { BATCH: 'batch' },
                WEBGL_LAYER_NAME_MAP: {},
                NATIVE_2D_SURFACE_IDS: ['texteffect', 'ui', 'vignette', 'top'],
                STATIC_SURFACE_ORDER_MAP: {}
            })
        }
    );

    assert.equal(usesNativeDisplay2DResolution({ type: '2d', id: 'ui', dynamic: false }), true);
    assert.equal(usesNativeDisplay2DResolution({ type: '2d', id: 'dynamic:2d:1', dynamic: true }), false);
    assert.equal(usesNativeDisplay2DResolution({ type: 'webgl', id: 'background', dynamic: false }), false);
}

/** roundRect가 없는 Firefox 계열에서도 예외 없이 같은 둥근 경로를 만드는지 검증합니다. */
function testRoundRectFallback() {
    const { renderDrawRoundRect } = loadInjectedFunctions(
        '../project/engine/script/display/draw_2d_shapes.js',
        ['renderDrawRoundRect'],
        { clampNumber, toRadians: (degrees) => degrees * Math.PI / 180 }
    );
    const calls = [];
    const context = {};
    for (const method of [
        'beginPath',
        'moveTo',
        'lineTo',
        'quadraticCurveTo',
        'closePath',
        'rect',
        'fill',
        'stroke'
    ]) {
        context[method] = (...args) => calls.push([method, ...args]);
    }

    assert.doesNotThrow(() => renderDrawRoundRect(context, {
        x: 10,
        y: 20,
        w: 120,
        h: 48,
        radius: 12,
        stroke: false
    }));
    assert.equal(calls.filter(([method]) => method === 'quadraticCurveTo').length, 4);
    assert.equal(calls.filter(([method]) => method === 'closePath').length, 1);
    assert.equal(calls.filter(([method]) => method === 'fill').length, 1);
}

/** 풀스크린 합성 context가 사용하지 않는 MSAA/depth/stencil backing buffer를 요청하지 않는지 검증합니다. */
async function testWebGLContextAttributes() {
    const { createDisplayWebGLContextAttributes } = await import(
        '../project/engine/script/display/webgl_context_attributes.js'
    );
    assert.deepEqual(createDisplayWebGLContextAttributes(true), {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false
    });
    assert.equal(createDisplayWebGLContextAttributes(false).alpha, false);
}

/** 같은 프레임 예외가 매 rAF마다 console.warn을 발생시키지 않는지 검증합니다. */
function testFrameErrorLogThrottle() {
    const warnings = [];
    const window = { addEventListener: () => {} };
    const document = {
        addEventListener: () => {},
        hidden: false,
        hasFocus: () => true,
        documentElement: { style: {} }
    };
    const EngineApp = loadInjectedClass(
        '../project/engine/script/app/engine_app.js',
        'EngineApp',
        {
            getData: () => ({ REASONS: { APP_INACTIVE: 'inactive' }, INACTIVE_POLICY: {} }),
            runtimeTool: () => ({ closeWindow: () => {} }),
            window,
            document,
            requestAnimationFrame: () => 1,
            cancelAnimationFrame: () => {},
            performance: { now: () => 0 },
            console: { warn: (...args) => warnings.push(args) },
            setTimeout: () => 1
        }
    );
    const systemHandler = {
        shouldRunFixedStep: () => false,
        tick: () => { throw new TypeError('repeat-render-error'); }
    };
    const app = new EngineApp(systemHandler);
    app.running = true;
    app.loop(0);
    app.loop(10);
    app.loop(20);
    app.loop(6000);
    assert.equal(warnings.length, 2);
    assert.match(String(warnings[1][0]), /2회 중복 로그 생략/u);
}

/** production hot path에 동기 GPU 상태 조회와 불필요한 flush가 남지 않았는지 검증합니다. */
function testNoPerFrameGpuSynchronization() {
    const overlaySource = fs.readFileSync(
        new URL('../project/engine/script/display/webgl/_overlay_effect_renderer.js', import.meta.url),
        'utf8'
    );
    const wallpaperSource = fs.readFileSync(
        new URL('../project/engine/script/scene/aero_live/_aero_live_wallpaper_effect_pass.js', import.meta.url),
        'utf8'
    );
    assert.doesNotMatch(overlaySource, /gl\.flush\s*\(/u);
    assert.doesNotMatch(wallpaperSource, /gl\.getError\s*\(/u);
}

/** 튜토리얼 동안 마지막 backdrop을 재사용하고 ripple 내부 패스를 건너뛰는지 검증합니다. */
async function testTutorialWallpaperPause() {
    const { AeroLiveWallpaperEffectPass } = await import(
        '../project/engine/script/scene/aero_live/_aero_live_wallpaper_effect_pass.js'
    );
    const drawCalls = [];
    const gl = {
        drawingBufferWidth: 64,
        drawingBufferHeight: 36,
        FRAMEBUFFER: 0x8D40,
        ARRAY_BUFFER: 0x8892,
        TEXTURE_2D: 0x0DE1,
        TEXTURE0: 0x84C0,
        TRIANGLES: 0x0004,
        FLOAT: 0x1406,
        BLEND: 0x0BE2,
        DEPTH_TEST: 0x0B71,
        CULL_FACE: 0x0B44,
        SCISSOR_TEST: 0x0C11,
        isContextLost: () => false,
        bindFramebuffer: () => {},
        viewport: () => {},
        disable: () => {},
        colorMask: () => {},
        useProgram: () => {},
        bindBuffer: () => {},
        enableVertexAttribArray: () => {},
        vertexAttribPointer: () => {},
        activeTexture: () => {},
        bindTexture: () => {},
        uniform1i: () => {},
        drawArrays: (...args) => drawCalls.push(args),
        deleteFramebuffer: () => {},
        deleteTexture: () => {},
        deleteProgram: () => {},
        deleteBuffer: () => {}
    };
    const pass = new AeroLiveWallpaperEffectPass({ imageFactory: () => null });
    const baseTexture = {};
    const target = { framebuffer: {}, texture: {} };
    pass.gl = gl;
    pass.resources.quadBuffer = {};
    pass.resources.programs.copy = {
        program: {},
        position: 0,
        uniforms: { u_texture: {} }
    };
    Object.assign(pass.assets.base, {
        ready: true,
        failed: false,
        texture: baseTexture,
        width: 1920,
        height: 1080
    });

    pass.setPaused(true);
    const initial = pass.render({ gl, target, width: 64, height: 36, timeSeconds: 1 });
    assert.equal(initial.rendered, true);
    assert.deepEqual(initial.internalPassOrder, ['copy']);
    assert.equal(drawCalls.length, 1);

    const cached = pass.render({ gl, target, width: 64, height: 36, timeSeconds: 2 });
    assert.equal(cached.rendered, true);
    assert.deepEqual(cached.internalPassOrder, []);
    assert.equal(drawCalls.length, 1, '정지 프레임은 fullscreen ripple 패스를 다시 그리면 안 됩니다.');
    assert.equal(pass.getStatus().metrics.pausedCacheHits, 1);

    pass.setPaused(false);
    const resumed = pass.render({
        gl,
        target,
        width: 64,
        height: 36,
        timeSeconds: 3,
        deltaSeconds: 1 / 60
    });
    assert.equal(resumed.rendered, true);
    assert.deepEqual(resumed.internalPassOrder, ['copy']);
    assert.equal(drawCalls.length, 2);
    assert.equal(pass.getStatus().paused, false);
    pass.destroy();

    const rendererSource = fs.readFileSync(
        new URL('../project/engine/script/scene/aero_live/_aero_live_renderer.js', import.meta.url),
        'utf8'
    );
    assert.match(rendererSource, /setPaused\?\.\(tutorialActive\)/u);
    assert.match(rendererSource, /wallpaperPaused[\s\S]*?'paused'/u);
}

await testRenderTargetCap();
testDynamicSurfaceResolutionPolicy();
testRoundRectFallback();
await testWebGLContextAttributes();
testFrameErrorLogThrottle();
testNoPerFrameGpuSynchronization();
await testTutorialWallpaperPause();

console.log('교차 브라우저 렌더링 회귀 테스트 통과');
