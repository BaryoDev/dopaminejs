import { Component } from 'dopaminejs';

/**
 * Reusable component for fading text that floats upwards.
 */
export class FloatingText extends Component {
    constructor(text, options = {}) {
        super();
        this.text = text;
        this.color = options.color || '#FFFFFF';
        this.fontSize = options.fontSize || 24;
        this.fontFamily = options.fontFamily || 'Outfit';
        this.alpha = 1;
        this.velocityY = options.velocityY || -100;
        this.lifetime = options.lifetime || 1.0;
        this.maxLifetime = this.lifetime;
    }

    update(deltaTime) {
        if (!this.gameObject) return;
        this.gameObject.y += this.velocityY * deltaTime;
        this.lifetime -= deltaTime;
        this.alpha = Math.max(0, this.lifetime / this.maxLifetime);

        if (this.lifetime <= 0) {
            // Get scene from Director system
            const director = this.kernel?.systems.get('director');
            const scene = director?.currentScene;
            if (scene) scene.remove(this.gameObject);
        }
    }

    render(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.fontSize}px ${this.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(this.text, 0, 0);
        ctx.restore();
    }
}
