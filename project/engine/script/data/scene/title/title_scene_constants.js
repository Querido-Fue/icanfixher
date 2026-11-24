/** 월드 좌표계의 카메라 위치와 주시점. +Z와 +X 쪽으로 열린 방이다. */
export const TITLE_SCENE_CONSTANTS = Object.freeze({
    overview: { eye: [10.8, 9.62, 13.8], look: [0, 1.97, 0], width: 12.1, height: 9.25 },
    desk: { eye: [3.4, 3.0, 4.8], look: [1.0, 1.95, -1.95], width: 5.8, height: 4.25 },
    shelf: { eye: [2.2, 2.85, 3.8], look: [-2.18, 2.1, -2.18], width: 4.85, height: 3.8 },
    door: { eye: [3.1, 2.9, 3.8], look: [-3.73, 1.6, 1.55], width: 4.2, height: 3.7 }
});
