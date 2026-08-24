/**
 * 풀스크린 2D 합성용 WebGL context의 공통 저비용 속성을 생성합니다.
 * 이 엔진은 depth, stencil 또는 MSAA를 사용하지 않으므로 관련 backing buffer를 만들지 않습니다.
 * @param {boolean} alpha - 투명 drawing buffer 사용 여부입니다.
 * @returns {WebGLContextAttributes} WebGL context 생성 속성입니다.
 */
export function createDisplayWebGLContextAttributes(alpha = true) {
    return {
        alpha: alpha !== false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false
    };
}
