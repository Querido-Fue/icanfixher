import { BaseScene } from 'scene/_base_scene.js';
import { getDelta } from 'engine/time_handler.js';

const stations = [
    { id: 'desk', label: '방송 시작', view: '방송 데스크' },
    { id: 'shelf', label: '플레이 가이드', view: '레코드 선반' },
    { id: 'door', label: '게임 종료', view: '방문' }
];

export class TitleScene extends BaseScene {
    constructor(sceneSystem) {
        super(sceneSystem);
        this.events = new AbortController();
        this.root = document.createElement('main');
        this.root.className = 'studio-title';
        this.root.setAttribute('aria-label', 'I Can Fix Her! 타이틀');
        this.root.innerHTML = `
            <div class="studio-view" aria-hidden="true"></div>
            <header class="studio-header">
                <span class="studio-channel"><i aria-hidden="true">✳</i> AQUA STUDIO</span>
                <span class="studio-status"><i></i> STANDBY</span>
            </header>
            <div class="studio-copy">
                <div class="studio-home">
                    <h1 lang="en"><span>I Can</span><em>Fix Her!</em></h1>
                    <nav class="studio-menu" aria-label="타이틀 메뉴"></nav>
                </div>
                <section class="studio-detail" aria-labelledby="studio-detail-heading" hidden>
                    <h2 id="studio-detail-heading"></h2>
                    <div class="studio-detail-body"></div>
                    <div class="studio-actions"></div>
                </section>
            </div>
            <footer class="studio-footer">
                <span class="studio-keys"><kbd>↑</kbd><kbd>↓</kbd> 이동 <kbd>Enter</kbd> 선택</span>
                <span class="studio-caption"><i aria-hidden="true"></i><span>방 전경</span></span>
            </footer>`;
        this.host = this.root.querySelector('.studio-view');
        this.home = this.root.querySelector('.studio-home');
        this.panel = this.root.querySelector('.studio-detail');
        this.menu = this.root.querySelector('nav');
        this.caption = this.root.querySelector('.studio-caption span');
        this.buttons = stations.map(station => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = station.label;
            button.addEventListener('pointerenter', e => {
                if (e.pointerType !== 'touch') this.preview(station);
            });
            button.addEventListener('focus', () => this.preview(station));
            button.addEventListener('click', () => this.activate(station));
            this.menu.append(button);
            return button;
        });
        this.menu.addEventListener('pointerleave', () => {
            if (!this.busy && !this.home.hidden) this.overview();
        });
        document.body.append(this.root);
        window.addEventListener('keydown', e => this.onKey(e), { signal: this.events.signal });
        this.host.addEventListener('webglcontextlost', () => this.showStill(), { capture: true, signal: this.events.signal });
        this.ready = this.loadRoom();
    }

    async loadRoom() {
        try {
            const { StudioRoom } = await import('./_studio_room.js');
            if (this.events.signal.aborted) return;
            this.room = new StudioRoom(this.host);
            this.host.classList.add('is-rendered');
        } catch (error) {
            console.warn('[TitleScene] 정적 방송실 배경을 사용합니다.', error);
            this.showStill();
        }
    }

    showStill() {
        const room = this.room;
        this.room = null;
        this.host.classList.remove('is-rendered');
        room?.dispose();
    }

    whenReadyForTransition() { return this.ready; }
    resize() { this.room?.resize(); }
    draw() { this.room?.render(); }

    update() {
        const settled = this.room?.advance(getDelta()) ?? true;
        if (this.pending && settled) {
            const id = this.pending;
            this.pending = null;
            if (id === 'desk') {
                this.sceneSystem.startScene('aeroLive');
            } else {
                this.busy = false;
                this.showPanel(id);
            }
        }
    }

    overview() {
        this.room?.frame('overview');
        delete this.root.dataset.shot;
        this.caption.textContent = '방 전경';
        for (const button of this.buttons) button.classList.remove('is-selected');
    }

    preview(station) {
        if (this.busy || this.home.hidden) return;
        this.frameStation(station, 0.55);
    }

    frameStation(station, strength) {
        this.root.dataset.shot = station.id;
        this.caption.textContent = station.view;
        this.buttons.forEach((button, i) => button.classList.toggle('is-selected', stations[i] === station));
        this.room?.frame(station.id, strength);
    }

    activate(station) {
        if (this.busy || this.home.hidden) return;
        this.busy = true;
        this.pending = station.id;
        this.frameStation(station, 1);
    }

    showPanel(id) {
        this.home.hidden = true;
        this.panel.hidden = false;
        const heading = this.panel.querySelector('h2');
        const body = this.panel.querySelector('.studio-detail-body');
        const actions = this.panel.querySelector('.studio-actions');
        actions.replaceChildren();
        if (id === 'shelf') {
            heading.textContent = '플레이 가이드';
            body.innerHTML = '<dl><dt>방송 준비</dt><dd>닉네임을 입력하고 오늘 아쿠아가 방송할 주제를 고르세요.</dd><dt>채팅 관리</dt><dd>방송마다 세 번 채팅을 보낼 수 있어요. 핵심 채팅은 선택해서 삭제하거나 시청자를 강퇴할 수 있습니다.</dd><dt>후원 대응</dt><dd>시청자의 후원 메시지와 아쿠아의 상태를 살피며 방송을 이어가세요.</dd></dl>';
        } else if (id === 'door') {
            heading.textContent = '방송실을 나갈까요?';
            body.textContent = '타이틀 메뉴에서 게임을 종료합니다.';
        } else {
            heading.textContent = '방송실을 나왔어요.';
            body.textContent = '이제 이 탭을 닫아도 됩니다.';
        }
        const add = (label, action) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.addEventListener('click', action);
            actions.append(button);
            return button;
        };
        const back = add(id === 'door' ? '머무르기' : '타이틀로 돌아가기', () => this.returnHome());
        if (id === 'door') add('게임 종료', () => {
            if (window.nw?.Window && typeof window.Game?.close === 'function') window.Game.close();
            else this.showPanel('closed');
        });
        back.focus({ preventScroll: true });
    }

    returnHome() {
        const focusIndex = stations.findIndex(station => station.id === this.root.dataset.shot);
        this.panel.hidden = true;
        this.home.hidden = false;
        this.buttons[Math.max(0, focusIndex)].focus({ preventScroll: true });
        this.overview();
    }

    onKey(event) {
        if (event.altKey || event.ctrlKey || event.metaKey || this.busy) return;
        if (event.key === 'Escape') {
            if (!this.panel.hidden) this.returnHome();
            else this.overview();
            event.preventDefault();
            return;
        }
        const choices = this.home.hidden ? [...this.panel.querySelectorAll('button')] : this.buttons;
        const current = choices.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            const next = current < 0 ? (direction > 0 ? 0 : choices.length - 1)
                : (current + direction + choices.length) % choices.length;
            choices[next].focus({ preventScroll: true });
            event.preventDefault();
        } else if (event.key === 'Enter' && current < 0 && !event.repeat) {
            choices[0].click();
            event.preventDefault();
        }
    }

    destroy() {
        this.events.abort();
        this.pending = null;
        this.room?.dispose();
        this.room = null;
        this.root.remove();
    }
}
