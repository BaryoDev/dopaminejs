/**
 * Particle Effect System
 * Creates satisfying visual feedback for achievements and rewards
 */

export class ParticleSystem {
    constructor(config = {}) {
        this.container = config.container ?
            (typeof config.container === 'string' ? document.querySelector(config.container) : config.container)
            : document.body;

        this.canvasId = config.canvasId || 'dopamine-particle-canvas';
        this.canvas = document.getElementById(this.canvasId);

        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = this.canvasId;
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.zIndex = config.zIndex || '9999';

            if (this.container === document.body) {
                this.canvas.style.position = 'fixed';
                this.canvas.style.top = '0';
                this.canvas.style.left = '0';
            } else {
                this.canvas.style.position = 'absolute';
                this.canvas.style.top = '0';
                this.canvas.style.left = '0';
                // Ensure container is positioned
                const style = window.getComputedStyle(this.container);
                if (style.position === 'static') {
                    this.container.style.position = 'relative';
                }
            }

            this.container.appendChild(this.canvas);
        }

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.pool = []; // Object pool
        this.sprites = new Map(); // key -> Image
        this.customEffects = new Map(); // key -> callback
        this.isAnimating = false;

        this._resize();
        // Use ResizeObserver for container resizing if supported, fallback to window resize
        if (window.ResizeObserver && this.container !== document.body) {
            new ResizeObserver(() => this._resize()).observe(this.container);
        } else {
            window.addEventListener('resize', () => this._resize());
        }
    }

    _resize() {
        if (this.container === document.body) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        } else {
            this.canvas.width = this.container.clientWidth;
            this.canvas.height = this.container.clientHeight;
        }
    }

    /**
     * Register a custom sprite image
     * @param {string} key 
     * @param {string} url 
     */
    registerSprite(key, url) {
        const img = new Image();
        img.src = url;
        this.sprites.set(key, img);
    }

    /**
     * Register a custom effect
     * @param {string} name 
     * @param {Function} callback - (x, y, ...args) => void
     */
    registerEffect(name, callback) {
        this.customEffects.set(name, callback);
    }

    /**
     * Play a registered effect
     */
    play(name, x, y, ...args) {
        const effect = this.customEffects.get(name);
        if (effect) {
            effect(x, y, ...args);
        } else {
            console.warn(`[DopamineJS] Effect '${name}' not found.`);
        }
    }

    /**
     * Emit particles with custom config
     * @param {Object} config 
     */
    emit(config) {
        const {
            x, y,
            count = 10,
            speed = 5,
            gravity = 0.1,
            decay = 0.02,
            life = 1.0,
            color = '#ffd700',
            sprite = null,
            spread = Math.PI * 2,
            angle = 0,
            size = 5
        } = config;

        for (let i = 0; i < count; i++) {
            const p = this._getParticle();
            const pAngle = angle + (Math.random() - 0.5) * spread;
            const pSpeed = Math.random() * speed;

            p.x = x;
            p.y = y;
            p.vx = Math.cos(pAngle) * pSpeed;
            p.vy = Math.sin(pAngle) * pSpeed;
            p.life = life;
            p.decay = decay * (0.8 + Math.random() * 0.4); // Randomize decay slightly
            p.gravity = gravity;
            p.color = Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color;
            p.size = size * (0.8 + Math.random() * 0.4);
            p.sprite = sprite;
            p.rotation = Math.random() * Math.PI * 2;
            p.rotationSpeed = (Math.random() - 0.5) * 0.2;

            this.particles.push(p);
        }

        this._startAnimation();
    }

    _getParticle() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return {}; // New particle object
    }

    _recycleParticle(p) {
        this.pool.push(p);
    }

    // --- Built-in Effects ---

    confetti(x, y, count = 50) {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#c06c84', '#6c5ce7'];
        this.emit({
            x, y, count,
            color: colors,
            speed: 10,
            gravity: 0.3,
            decay: 0.015,
            size: 8,
            spread: Math.PI * 2
        });
    }

    coinShower(x, y, count = 10) {
        this.emit({
            x, y, count,
            color: '#ffd700',
            speed: 4,
            gravity: 0.4,
            decay: 0.012,
            size: 12,
            angle: -Math.PI / 2, // Upwards initially
            spread: Math.PI / 2
        });
    }

    sparkle(x, y, count = 20, color = '#ffd700') {
        this.emit({
            x, y, count,
            color,
            speed: 3,
            gravity: -0.05, // Float up
            decay: 0.03,
            size: 3
        });
    }

    fire(x, y, count = 15) {
        const colors = ['#ff6b00', '#ff8800', '#ffaa00', '#ff4400'];
        this.emit({
            x, y, count,
            color: colors,
            speed: 3,
            gravity: -0.2,
            decay: 0.04,
            size: 5,
            angle: -Math.PI / 2,
            spread: Math.PI / 4
        });
    }

    starBurst(x, y, count = 8) {
        // Star burst is unique because of fixed angles, so we keep manual loop or use emit carefully
        // For simplicity, let's use emit but we lose the perfect star shape distribution
        // To keep it perfect, we'll manually push particles but use the pool
        for (let i = 0; i < count; i++) {
            const p = this._getParticle();
            const angle = (Math.PI * 2 / count) * i;
            const speed = 4;

            p.x = x;
            p.y = y;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.life = 1.0;
            p.decay = 0.03;
            p.gravity = 0;
            p.color = '#ffffff';
            p.size = 15;
            p.sprite = null;
            p.type = 'star'; // Special type for drawing logic
            p.rotation = angle;
            p.rotationSpeed = 0;

            this.particles.push(p);
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

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Physics
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;

            if (p.rotationSpeed) {
                p.rotation += p.rotationSpeed;
            }

            // Death
            if (p.life <= 0) {
                this._recycleParticle(p);
                this.particles.splice(i, 1);
                continue;
            }

            // Draw
            this.ctx.save();
            this.ctx.globalAlpha = p.life;
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);

            if (p.sprite && this.sprites.has(p.sprite)) {
                const img = this.sprites.get(p.sprite);
                if (img.complete) {
                    this.ctx.drawImage(img, -p.size / 2, -p.size / 2, p.size, p.size);
                }
            } else if (p.type === 'star') {
                this.ctx.fillStyle = p.color;
                this._drawStarPath(0, 0, 5, p.size, p.size / 2);
                this.ctx.fill();
            } else {
                this.ctx.fillStyle = p.color;
                // Default shape is square for performance/confetti, or circle
                // Let's usefillRect for speed unless it's a coin/sparkle which usually implies circle
                // For generic emit, let's assume circle if no sprite
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        }

        if (this.particles.length > 0) {
            requestAnimationFrame(() => this._animate());
        } else {
            this.isAnimating = false;
        }
    }

    _drawStarPath(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            this.ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            this.ctx.lineTo(x, y);
            rot += step;
        }
        this.ctx.lineTo(cx, cy - outerRadius);
        this.ctx.closePath();
    }

    clear() {
        // Recycle all
        this.particles.forEach(p => this._recycleParticle(p));
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
