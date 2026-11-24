import { BaseScene } from 'scene/_base_scene.js';
import { getDelta } from 'engine/time_handler.js';

const stations = [
    { id: 'door', label: '게임 종료' },
    { id: 'shelf', label: '플레이 가이드' },
    { id: 'desk', label: '방송 시작' }
];

export class TitleScene extends BaseScene {
    constructor(sceneSystem) {
        super(sceneSystem);
        this.events = new AbortController();
        this.root = document.createElement('main');
        this.root.className = 'studio-title';
        this.root.setAttribute('aria-label', '아쿠아 방송실');
        this.root.innerHTML = `
            <div class="studio-view" aria-hidden="true"></div>
            <div class="studio-hotspots" role="group" aria-label="방송실에서 상호 작용할 물건"></div>
            <section class="studio-detail" aria-labelledby="studio-detail-heading" hidden>
                <h2 id="studio-detail-heading"></h2>
                <div class="studio-detail-body"></div>
                <div class="studio-actions"></div>
            </section>`;
        this.host = this.root.querySelector('.studio-view');
        this.hotspots = this.root.querySelector('.studio-hotspots');
        this.panel = this.root.querySelector('.studio-detail');
        this.buttons = stations.map(station => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'studio-hotspot';
            button.dataset.station = station.id;
            button.setAttribute('aria-label', station.label);
            button.hidden = true;
            const label = document.createElement('span');
            label.className = 'studio-hotspot-label';
            label.textContent = station.label;
            label.setAttribute('aria-hidden', 'true');
            button.append(label);
            button.addEventListener('pointerenter', event => {
                if (event.pointerType !== 'touch') this.setHovered(station.id);
            });
            button.addEventListener('pointerleave', () => this.setHovered(null));
            button.addEventListener('focus', () => this.refreshHighlight());
            button.addEventListener('blur', () => this.refreshHighlight());
            button.addEventListener('click', event => {
                if (event.pointerType === 'touch' && this.touchSelection !== station.id) {
                    this.touchSelection = station.id;
                    this.refreshHighlight();
                    return;
                }
                this.activate(station);
            });
            this.hotspots.append(button);
            return button;
        });
        this.root.addEventListener('pointerdown', event => {
            if (this.touchSelection && !event.target.closest('.studio-hotspot')) {
                this.touchSelection = null;
                this.refreshHighlight();
            }
        });
        document.body.append(this.root);
        window.addEventListener('keydown', e => this.onKey(e), { signal: this.events.signal });
        this.host.addEventListener('webglcontextlost', () => this.showStill(), { capture: true, signal: this.events.signal });
        this.layout = new ResizeObserver(() => this.resize());
        this.layout.observe(this.host);
        this.roomRequest = 0;
        this.ready = this.loadRoom();
    }

    async loadRoom(still = false) {
        const request = ++this.roomRequest;
        try {
            const { StudioRoom } = await import('./_studio_room.js');
            const StillRenderer = still ? (await import('./_studio_still.js')).StudioStillRenderer : null;
            if (this.events.signal.aborted || request !== this.roomRequest) return;
            this.room = new StudioRoom(this.host, StillRenderer);
            const shot = this.root.dataset.shot;
            if (shot) this.room.frame(shot);
            this.root.classList.toggle('studio-still', this.room.isStill);
            this.positionHotspots();
            this.refreshHighlight();
        } catch (error) {
            if (this.events.signal.aborted || request !== this.roomRequest) return;
            if (!still) return this.showStill();
            console.warn('[TitleScene] 방송실 배경을 그릴 수 없습니다.', error);
        }
    }

    showStill() {
        const room = this.room;
        this.room = null;
        room?.dispose();
        return this.loadRoom(true);
    }

    whenReadyForTransition() { return this.ready; }
    resize() { this.room?.resize(); }
    draw() {
        if (this.room?.render() && !this.hotspots.hidden) this.positionHotspots();
        if (this.restoreFocus && !this.hotspots.hidden) {
            this.restoreFocus.focus({ preventScroll: true });
            this.restoreFocus = null;
        }
    }

    positionHotspots() {
        for (const button of this.buttons) {
            const bounds = this.room.targetBounds(button.dataset.station);
            button.hidden = !bounds;
            if (!bounds) continue;
            button.style.left = bounds.x + 'px';
            button.style.top = bounds.y + 'px';
            button.style.width = bounds.width + 'px';
            button.style.height = bounds.height + 'px';
        }
    }

    setHovered(id) {
        this.hovered = id;
        this.refreshHighlight();
    }

    refreshHighlight() {
        const focus = document.activeElement?.closest('.studio-hotspot:focus-visible');
        const selected = this.hotspots.hidden ? null
            : this.hovered ?? this.touchSelection ?? focus?.dataset.station ?? null;
        this.room?.highlight(selected);
        for (const button of this.buttons) {
            button.classList.toggle('is-highlighted', button.dataset.station === selected);
            button.classList.toggle('is-touch-selected', button.dataset.station === this.touchSelection);
        }
    }

    update() {
        const settled = this.room?.advance(getDelta()) ?? true;
        if (settled && this.returning) {
            this.returning = false;
            this.hotspots.hidden = false;
        }
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

    activate(station) {
        if (this.busy || this.hotspots.hidden) return;
        this.busy = true;
        this.pending = station.id;
        this.root.dataset.shot = station.id;
        this.hotspots.hidden = true;
        this.hovered = this.touchSelection = null;
        this.refreshHighlight();
        this.room?.frame(station.id);
    }

    showPanel(id) {
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
            body.textContent = '게임을 종료합니다.';
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
        const back = add(id === 'door' ? '머무르기' : '방으로 돌아가기', () => this.returnHome());
        if (id === 'door') add('게임 종료', () => {
            if (window.nw?.Window && typeof window.Game?.close === 'function') window.Game.close();
            else this.showPanel('closed');
        });
        back.focus({ preventScroll: true });
    }

    returnHome() {
        const previous = this.buttons.find(button => button.dataset.station === this.root.dataset.shot);
        if (this.panel.contains(document.activeElement) && document.activeElement.matches(':focus-visible')) {
            this.restoreFocus = previous;
        }
        this.panel.hidden = true;
        this.returning = true;
        delete this.root.dataset.shot;
        this.room?.frame('overview');
        this.refreshHighlight();
    }

    onKey(event) {
        if (event.altKey || event.ctrlKey || event.metaKey || this.busy || this.returning) return;
        if (event.key === 'Escape') {
            if (!this.panel.hidden) this.returnHome();
            else {
                this.touchSelection = null;
                this.refreshHighlight();
            }
            event.preventDefault();
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.key)) return;
        const choices = this.hotspots.hidden ? [...this.panel.querySelectorAll('button')]
            : this.buttons.filter(button => !button.hidden);
        if (!choices.length) return;
        const current = choices.indexOf(document.activeElement);
        const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
        const next = current < 0 ? (forward ? 0 : choices.length - 1)
            : (current + (forward ? 1 : -1) + choices.length) % choices.length;
        choices[next].focus({ preventScroll: true });
        this.refreshHighlight();
        event.preventDefault();
    }

    destroy() {
        this.events.abort();
        this.layout.disconnect();
        this.pending = null;
        this.room?.dispose();
        this.room = null;
        this.root.remove();
    }
}
