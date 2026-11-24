import * as THREE from '../../../vendor/three-r160/three.module.min.js';
import { AERO_LIVE_SCENE_CONSTANTS } from '../../data/scene/aero_live/aero_live_scene_constants.js';

const colors = AERO_LIVE_SCENE_CONSTANTS.COLORS;

// Small printed props are painted once at load, like decals on a physical model.
export function studioPrint(width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    return material;
}

function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function type(ctx, words, x, y, size, color, family = 'monospace') {
    ctx.fillStyle = color;
    ctx.font = 'bold ' + size + 'px ' + family;
    ctx.fillText(words, x, y);
}

function disc(ctx, x, y, radius, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
}

function gradient(ctx, x, y, endX, endY, stops) {
    const fill = ctx.createLinearGradient(x, y, endX, endY);
    for (const [offset, color] of stops) fill.addColorStop(offset, color);
    return fill;
}

function hill(ctx, width, height, fill, yAt) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 2) ctx.lineTo(x, yAt(x / width));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
}

// Hand-painted scenic insert seen through the miniature's window.
export function bayWindow(ctx, w, h) {
    rect(ctx, gradient(ctx, 0, 0, 0, h, [
        [0, colors.SKY_DEEP], [0.37, colors.SKY_TOP], [0.69, colors.SKY_HAZE], [1, '#eefbd5']
    ]), 0, 0, w, h);
    for (const [cx, cy, scale] of [[0.21, 0.26, 1], [0.76, 0.17, 0.67], [0.93, 0.41, 0.35]]) {
        for (const [dx, dy, r] of [[-44, 6, 16], [-24, 1, 21], [0, -5, 27], [27, 4, 18], [46, 8, 12]]) {
            disc(ctx, w * cx + dx * scale, h * cy + dy * scale, r * scale, '#f5feff');
        }
    }
    hill(ctx, w, h, '#5cbbaa', u => h * (0.65 - 0.046 * Math.sin(u * 9 + 0.5)));
    rect(ctx, gradient(ctx, 0, h * 0.65, 0, h, [
        [0, '#baf5e8'], [0.20, '#63d5df'], [1, '#158abb']
    ]), 0, h * 0.68, w, h * 0.32);
    for (let i = 0; i < 11; i++) {
        rect(ctx, '#b5f5ed', (i * 83) % w, h * 0.73 + (i * 13) % 62, 11 + i % 4 * 12, 2);
    }
    hill(ctx, w, h, gradient(ctx, 0, h * 0.75, 0, h, [
        [0, '#ceef78'], [0.43, colors.AERO_LIME], [1, '#399e68']
    ]), u => h * (0.93 - 0.18 * Math.cos(u * 4.2 - 0.25) + 0.032 * u));
}

export function monitorFeed(ctx, w, h) {
    rect(ctx, '#123958', 0, 0, w, h);
    rect(ctx, gradient(ctx, 0, 0, 0, 32, [[0, '#c3f5ff'], [0.48, '#70ccf1'], [0.53, '#3798ce'], [1, '#2275a5']]), 0, 0, w, 30);
    type(ctx, 'AQUA  /  STUDIO', 17, 21, 15, '#092c4a');
    rect(ctx, '#c2eff6', 16, 44, 327, 153);
    rect(ctx, gradient(ctx, 22, 50, 312, 191, [[0, '#075999'], [0.6, '#13a6c5'], [1, colors.AQUA]]), 22, 50, 315, 141);
    // Water rings tie the studio's audio visualizer to the game's ocean wallpaper.
    for (let i = 0; i < 4; i++) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#79d8e8';
        ctx.beginPath(); ctx.ellipse(176, 137, 42 + i * 28, 9 + i * 7, 0, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.strokeStyle = '#f5feff'; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = 0; x <= 240; x += 2) {
        const y = 117 + Math.sin(x * 0.13) * Math.exp(-Math.pow((x - 120) / 53, 2)) * 36;
        if (!x) ctx.moveTo(x + 59, y); else ctx.lineTo(x + 59, y);
    }
    ctx.stroke();
    type(ctx, 'PREVIEW', 360, 64, 14, colors.SKY_HAZE);
    for (let i = 0; i < 7; i++) rect(ctx, i % 3 ? '#73b6cf' : colors.AERO_LIME, 360, 78 + i * 17, 48 + (i * 23) % 70, 5);
    for (let i = 0; i < 32; i++) {
        const bar = 6 + 31 * Math.abs(Math.sin(i * 2.7) * Math.cos(i * 0.21));
        rect(ctx, i > 25 ? colors.AERO_LIME : colors.AQUA, 20 + i * 14, h - 13 - bar, 8, bar);
    }
}

export function sleeve(ctx, w, h) {
    rect(ctx, '#eefeff', 0, 0, w, h);
    rect(ctx, gradient(ctx, 0, 0, w, h, [[0, '#0a5ca4'], [0.58, '#13649d'], [1, '#19a4a6']]), 7, 7, w - 14, h - 14);
    type(ctx, 'AQUA', 21, 63, 47, '#f7ffff', 'sans-serif');
    const cd = gradient(ctx, 42, 100, 206, 230, [
        [0, '#249aca'], [0.16, '#d2fbff'], [0.32, '#b7ef88'], [0.48, '#f5fbff'],
        [0.65, '#86bbfa'], [0.78, '#cab4f0'], [1, '#4bafa9']
    ]);
    disc(ctx, w / 2, h * 0.52, w * 0.36, cd);
    disc(ctx, w / 2, h * 0.52, w * 0.092, '#ecfbff');
    disc(ctx, w / 2, h * 0.52, w * 0.051, '#13739f');
    type(ctx, 'RIPPLE MIX', 22, h - 32, 23, '#e1feff');
}

export function sign(ctx, w, h) {
    rect(ctx, gradient(ctx, 0, 0, 0, h, [[0, '#70cde5'], [0.46, '#2986b1'], [0.51, '#105784'], [1, '#123f67']]), 0, 0, w, h);
    ctx.strokeStyle = '#a9eefc'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, w - 12, h - 12);
    disc(ctx, 29, h * 0.50, 8, colors.LIVE);
    disc(ctx, 27, h * 0.46, 2.4, '#ffeaf5');
    type(ctx, 'ON AIR', 51, h * 0.73, 54, colors.GLASS_WHITE);
}
