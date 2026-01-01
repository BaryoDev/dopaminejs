import { Component } from 'dopaminejs';

/**
 * Simple 2D canvas confetti particle component
 */
export class ConfettiParticle extends Component {
    constructor(color) {
        super();
        this.vx = (Math.random() - 0.5) * 200;
        this.vy = -Math.random() * 300 - 100;
        this.gravity = 500;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 10;
        this.color = color;
        this.size = Math.random() * 8 + 4;
        this.lifetime = 2;
        this.age = 0;
    }

    update(deltaTime) {
        if (!this.gameObject) return;

        this.age += deltaTime;
        if (this.age >= this.lifetime) {
            const director = this.kernel?.systems.get('director');
            const scene = director?.currentScene;
            if (scene) scene.remove(this.gameObject);
            return;
        }

        // Physics - update gameObject position directly
        this.gameObject.x += this.vx * deltaTime;
        this.gameObject.y += this.vy * deltaTime;
        this.vy += this.gravity * deltaTime;
        this.rotation += this.rotationSpeed * deltaTime;
    }

    render(ctx) {
        const alpha = 1 - (this.age / this.lifetime);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}
