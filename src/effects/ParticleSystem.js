/**
 * Particle Effect System
 * Creates satisfying visual feedback for achievements and rewards
 */

export class ParticleSystem {
    constructor(config = {}) {
        this.canvasId = config.canvasId || 'dopamine-particle-canvas';
        this.canvas = document.getElementById(this.canvasId);

        if (!this.canvas) {
            // Create overlay canvas if it doesn't exist
            this.canvas = document.createElement('canvas');
            this.canvas.id = this.canvasId;
            this.canvas.style.position = 'fixed';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.zIndex = config.zIndex || '9999';
            document.body.appendChild(this.canvas);
        }

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.isAnimating = false;

        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    /**
     * Confetti explosion (for achievements, level ups)
     */
    confetti(x, y, count = 50) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#c06c84', '#6c5ce7'];

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10 - 5,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                life: 1.0,
                decay: 0.015 + Math.random() * 0.01,
                gravity: 0.3,
                type: 'confetti'
            });
        }

        this._startAnimation();
    }

    /**
     * Sparkle effect (for score milestones, combos)
     */
    sparkle(x, y, count = 20, color = '#ffd700') {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const speed = 2 + Math.random() * 3;

            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                size: Math.random() * 4 + 2,
                life: 1.0,
                decay: 0.02,
                gravity: -0.1, // Slight upward drift
                type: 'spark'
            });
        }

        this._startAnimation();
    }

    /**
     * Coin shower (for collecting coins)
     */
    coinShower(x, y, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 100,
                y: y - Math.random() * 50,
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * -2 - 3,
                color: '#ffd700',
                size: 12,
                life: 1.0,
                decay: 0.012,
                gravity: 0.4,
                type: 'coin'
            });
        }

        this._startAnimation();
    }

    /**
     * Fire particles (for streaks, combos)
     */
    fire(x, y, count = 15) {
        const colors = ['#ff6b00', '#ff8800', '#ffaa00', '#ff4400'];

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 3 - 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 6 + 3,
                life: 1.0,
                decay: 0.025,
                gravity: -0.2, // Upward
                type: 'fire'
            });
        }

        this._startAnimation();
    }

    /**
     * Star burst (for "perfect" moments)
     */
    starBurst(x, y, count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const speed = 4;

            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                rotation: angle,
                color: '#ffffff',
                size: 15,
                life: 1.0,
                decay: 0.03,
                gravity: 0,
                type: 'star'
            });
        }

        this._startAnimation();
    }

    _startAnimation() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this._animate();
        }
    }

    _animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Update physics
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;

            if (p.rotationSpeed) {
                p.rotation += p.rotationSpeed;
            }

            // Remove dead particles
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // Draw particle
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;

            if (p.type === 'confetti') {
                this.ctx.translate(p.x, p.y);
                this.ctx.rotate(p.rotation);
                this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 2);
            } else if (p.type === 'coin') {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                // Add shine
                this.ctx.fillStyle = '#ffee88';
                this.ctx.beginPath();
                this.ctx.arc(p.x - p.size / 3, p.y - p.size / 3, p.size / 3, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (p.type === 'star') {
                this._drawStar(p.x, p.y, 5, p.size, p.size / 2, p.rotation);
            } else {
                // Default: circle
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        }

        // Continue animation if particles remain
        if (this.particles.length > 0) {
            requestAnimationFrame(() => this._animate());
        } else {
            this.isAnimating = false;
        }
    }

    _drawStar(cx, cy, spikes, outerRadius, innerRadius, rotation) {
        let rot = Math.PI / 2 * 3 + rotation;
        const step = Math.PI / spikes;

        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            let x = cx + Math.cos(rot) * outerRadius;
            let y = cy + Math.sin(rot) * outerRadius;
            this.ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            this.ctx.lineTo(x, y);
            rot += step;
        }

        this.ctx.lineTo(cx, cy - outerRadius);
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
     * Clear all particles
     */
    clear() {
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
