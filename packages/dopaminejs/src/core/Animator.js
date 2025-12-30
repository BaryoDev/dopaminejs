import { Component } from '../core/Component.js';
import { Sprite } from './Sprite.js';

export class Animator extends Component {
    constructor() {
        super();
        this.animations = {}; // { name: { frames: [{x,y,w,h}], fps: 10, loop: true } }
        this.currentAnim = null;
        this.timer = 0;
        this.currentFrameIndex = 0;
        this.sprite = null;
    }

    onAttach() {
        this.sprite = this.gameObject.getComponent(Sprite);
        if (!this.sprite) {
            console.warn('Animator attached to GameObject without a Sprite component.');
        }
    }

    addAnimation(name, frames, fps = 10, loop = true) {
        this.animations[name] = { frames, fps, loop };
    }

    play(name) {
        if (this.currentAnim && this.currentAnim.name === name) return;

        if (this.animations[name]) {
            this.currentAnim = { name, ...this.animations[name] };
            this.currentFrameIndex = 0;
            this.timer = 0;
            this._updateFrame();
        }
    }

    update(dt) {
        if (!this.currentAnim || !this.sprite) return;

        this.timer += dt;
        const interval = 1.0 / this.currentAnim.fps;

        if (this.timer >= interval) {
            this.timer -= interval;
            this.currentFrameIndex++;

            if (this.currentFrameIndex >= this.currentAnim.frames.length) {
                if (this.currentAnim.loop) {
                    this.currentFrameIndex = 0;
                } else {
                    this.currentFrameIndex = this.currentAnim.frames.length - 1;
                    // Could emit 'animationComplete' here
                }
            }
            this._updateFrame();
        }
    }

    _updateFrame() {
        const frame = this.currentAnim.frames[this.currentFrameIndex];
        this.sprite.setFrame(frame.x, frame.y, frame.w, frame.h);
    }
}
