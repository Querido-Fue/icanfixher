import * as THREE from '../../../vendor/three-r160/three.module.min.js';

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

export function cityWindow(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#495789');
    sky.addColorStop(0.49, '#bc87ab');
    sky.addColorStop(0.85, '#f4b590');
    sky.addColorStop(1, '#f5c49a');
    rect(ctx, sky, 0, 0, w, h);
    ctx.fillStyle = '#ffe2ab';
    ctx.beginPath();
    ctx.arc(w * 0.73, h * 0.45, h * 0.14, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 22; i++) {
        const x = (i * 103 + 31) % w;
        const y = (i * 43 + 12) % (h * 0.36);
        rect(ctx, '#f5dbe0', x, y, i % 4 === 0 ? 3 : 1.5, 1.5);
    }
    for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < 24; i++) {
            const bw = w / 19;
            const x = (i - 1) * bw + layer * 13;
            const top = h * (0.81 + layer * 0.12 - 0.22 * Math.abs(Math.sin(i * 17 + layer * 3)));
            rect(ctx, layer ? '#41465f' : '#776681', x, top, bw - 2, h - top);
            if (i % 4 === 0) rect(ctx, '#70617c', x + bw / 2, top - 14, 2, 14);
            for (let n = 0; n < 5; n++) {
                if ((i + n) % 3) rect(ctx, '#ffd9a5', x + 5 + n % 2 * 9, top + 9 + Math.floor(n / 2) * 12, 4, 3);
            }
        }
    }
}

export function monitorFeed(ctx, w, h) {
    rect(ctx, '#102934', 0, 0, w, h);
    rect(ctx, '#385961', 0, 0, w, 30);
    type(ctx, 'AQUA  /  STUDIO', 17, 21, 15, '#dcf5e8');
    rect(ctx, '#294b57', 16, 44, 327, 153);
    const glow = ctx.createLinearGradient(20, 45, 300, 190);
    glow.addColorStop(0, '#9edbd0'); glow.addColorStop(1, '#447b97');
    rect(ctx, glow, 22, 50, 315, 141);
    // A stylized sine wave doubles as the station mark on the preview monitor.
    ctx.strokeStyle = '#e2fff1'; ctx.lineWidth = 5; ctx.beginPath();
    for (let x = 0; x <= 240; x += 2) {
        const y = 121 + Math.sin(x * 0.13) * Math.exp(-Math.pow((x - 120) / 51, 2)) * 42;
        if (!x) ctx.moveTo(x + 59, y); else ctx.lineTo(x + 59, y);
    }
    ctx.stroke();
    type(ctx, 'PREVIEW', 360, 64, 14, '#bce7db');
    for (let i = 0; i < 7; i++) {
        rect(ctx, i % 3 ? '#5a8190' : '#f4bd94', 360, 78 + i * 17, 48 + (i * 23) % 70, 5);
    }
    for (let i = 0; i < 32; i++) {
        const bar = 6 + 31 * Math.abs(Math.sin(i * 2.7) * Math.cos(i * 0.21));
        rect(ctx, i > 25 ? '#efba88' : '#88c7b4', 20 + i * 14, h - 13 - bar, 8, bar);
    }
}

export function sleeve(ctx, w, h) {
    rect(ctx, '#e6b997', 0, 0, w, h);
    rect(ctx, '#303d52', 13, 13, w - 26, h - 26);
    type(ctx, 'AQUA', 28, 66, 46, '#f7d5b0', 'serif');
    ctx.save(); ctx.beginPath(); ctx.rect(22, 84, w - 44, h - 143); ctx.clip();
    for (let i = 0; i < 12; i++) {
        ctx.strokeStyle = ['#f7c7a0','#cf8690','#8caab0'][i % 3]; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(w * 0.44, h * 0.62, 18 + i * 9, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.restore();
    type(ctx, 'AFTER HOURS', 27, h - 35, 20, '#f4d9b5');
}

export function sign(ctx, w, h) {
    rect(ctx, '#783d46', 0, 0, w, h);
    ctx.strokeStyle = '#ffc9ac'; ctx.lineWidth = 4; ctx.strokeRect(7, 7, w - 14, h - 14);
    type(ctx, 'ON AIR', 28, h * 0.74, 61, '#ffdebb');
}
