/**
 * WebGL Particle System
 * 
 * Particle renderer using WebGL, for 10,000+ particles. It is a particles part
 * (`burst(kind, at, opts)` and `destroy()`) and runs its own animation loop
 * while particles are alive.
 */

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const WHITE = [1, 1, 1, 1];

// "#rgb" or "#rrggbb" to [r, g, b, 1]. Anything else is null.
function parseColor(value) {
    if (typeof value !== 'string') return null;
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
    if (!match) return null;
    const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Every built-in kind. `count` and `color` come from the caller and may be missing.
const BURSTS = {
    confetti: (s, x, y, count = 50, color) => {
        const colors = color ? [color] : [
            [1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1], [1, 1, 0, 1], [1, 0, 1, 1]
        ];
        const total = s._room(count);
        for (let i = 0; i < total; i++) {
            s.emit({
                x, y,
                count: 1,
                color: pick(colors),
                size: Math.random() * 8 + 4,
                lifetime: Math.random() * 2 + 1,
                velocity: { x: 0, y: -300 },
                spread: 100
            });
        }
    },
    sparkle: (s, x, y, count = 20, color) => {
        s.emit({ x, y, count, color: color || WHITE, size: 3, lifetime: 0.5, velocity: { x: 0, y: -50 }, spread: 30 });
    },
    fire: (s, x, y, count = 15, color) => {
        const colors = color ? [color] : [[1, 0.42, 0, 1], [1, 0.53, 0, 1], [1, 0.67, 0, 1], [1, 0.27, 0, 1]];
        const total = s._room(count);
        for (let i = 0; i < total; i++) {
            s.emit({ x, y, count: 1, color: pick(colors), size: 6, lifetime: 0.6, velocity: { x: 0, y: -250 }, spread: 20 });
        }
    },
    stars: (s, x, y, count = 8, color) => {
        const total = s._room(count);
        for (let i = 0; i < total; i++) {
            s.emit({
                x, y,
                count: 1,
                angle: (Math.PI * 2 / total) * i,
                speed: 250,
                color: color || WHITE,
                size: 12,
                lifetime: 0.8,
                velocity: { x: 0, y: 0 },
                spread: 0
            });
        }
    },
    coins: (s, x, y, count = 10, color) => {
        s.emit({ x, y, count, color: color || [1, 0.84, 0, 1], size: 10, lifetime: 1.2, velocity: { x: 0, y: -350 }, spread: 30 });
    }
};

export class WebGLParticleSystem {
    /**
     * @param {Object} [config]
     * @param {number} [config.maxParticles=10000]
     * @param {HTMLElement|string} [config.container=document.body] - Element or
     *   selector the overlay canvas is appended to. The drawing buffer is sized
     *   to this element, so particle coordinates share its coordinate space.
     * @param {boolean} [config.reducedMotion=false] - Draw nothing.
     */
    constructor(config = {}) {
        // Sizes six typed arrays, so it has to be a sane positive integer.
        this.maxParticles = Number.isFinite(config.maxParticles) && config.maxParticles >= 1
            ? Math.min(Math.floor(config.maxParticles), 1000000)
            : 10000;
        this.container = config.container || null;
        this.reducedMotion = config.reducedMotion === true;

        // WebGL context and resources
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.particleBuffer = null;

        // Particle data (flat arrays for GPU upload)
        this.positions = new Float32Array(this.maxParticles * 2); // x, y
        this.velocities = new Float32Array(this.maxParticles * 2); // vx, vy
        this.colors = new Float32Array(this.maxParticles * 4); // r, g, b, a
        this.sizes = new Float32Array(this.maxParticles);
        this.lifetimes = new Float32Array(this.maxParticles);
        this.ages = new Float32Array(this.maxParticles);

        this.particleCount = 0;
        this._raf = null;
        this._last = null;
        this._destroyed = false;
    }

    /**
     * Builds the canvas and the GL program.
     * @returns {boolean} false when WebGL is not available. Nothing is left in the page then.
     */
    init() {
        this._initWebGL();
        if (!this.gl) return false;

        this._createShaders();
        this._createBuffers();
        return true;
    }

    // One frame at a time, and only while there are particles.
    _startLoop() {
        if (this._raf !== null || this._destroyed || typeof requestAnimationFrame !== 'function') return;
        this._raf = requestAnimationFrame(this._tick);
    }

    _tick = (now) => {
        this._raf = null;
        if (this._destroyed) return;
        const dt = this._last === null ? 1 / 60 : Math.min(0.1, Math.max(0, (now - this._last) / 1000));
        this._last = now;
        this.update(dt);
        if (this.particleCount > 0) this._startLoop();
        else this._last = null;
    };

    update(dt) {
        // Update particle physics
        for (let i = 0; i < this.particleCount; i++) {
            // Update age
            this.ages[i] += dt;

            // Remove dead particles
            if (this.ages[i] >= this.lifetimes[i]) {
                this._removeParticle(i);
                i--; // Recheck this index
                continue;
            }

            // Update position
            this.positions[i * 2] += this.velocities[i * 2] * dt;
            this.positions[i * 2 + 1] += this.velocities[i * 2 + 1] * dt;

            // Apply gravity
            this.velocities[i * 2 + 1] += 500 * dt; // Gravity

            // Fade out
            const lifeRatio = this.ages[i] / this.lifetimes[i];
            this.colors[i * 4 + 3] = 1 - lifeRatio; // Alpha fade
        }

        // Render
        this._render();
    }

    destroy() {
        this._destroyed = true;
        if (this._raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf);
        this._raf = null;
        this.particleCount = 0;
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        if (this.canvas && this._onContextLost) {
            this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
            this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
        }
        if (this.gl && !this._contextLost) {
            this.gl.deleteProgram(this.program);
            this.gl.deleteBuffer(this.particleBuffer);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    /**
     * @param {'confetti'|'sparkle'|'fire'|'stars'|'coins'} kind
     * @param {{x: number, y: number}} [at] - Defaults to the middle of the canvas.
     * @param {{count?: number, color?: string}} [opts]
     */
    burst(kind, at, opts) {
        if (this._destroyed || this.reducedMotion || !this.gl) return;
        if (typeof kind !== 'string' || !hasOwn(BURSTS, kind)) return;
        const x = Number.isFinite(at?.x) ? at.x : this.canvas.width / 2;
        const y = Number.isFinite(at?.y) ? at.y : this.canvas.height / 2;
        const count = Number.isFinite(opts?.count) ? Math.max(0, Math.floor(opts.count)) : undefined;
        BURSTS[kind](this, x, y, count, parseColor(opts?.color));
    }

    /** How many of `count` particles fit right now. */
    _room(count) {
        return Math.max(0, Math.min(count, this.maxParticles - this.particleCount));
    }

    emit(config) {
        const {
            x = 0,
            y = 0,
            count = 10,
            color = [1, 1, 1, 1],
            size = 5,
            lifetime = 1,
            velocity = { x: 0, y: -100 },
            spread = 50
        } = config;
        const fixedAngle = Number.isFinite(config.angle) ? config.angle : null;
        const fixedSpeed = Number.isFinite(config.speed) ? config.speed : null;

        for (let i = 0; i < count; i++) {
            if (this.particleCount >= this.maxParticles) break;

            const idx = this.particleCount;

            // Position
            this.positions[idx * 2] = x + (Math.random() - 0.5) * spread;
            this.positions[idx * 2 + 1] = y + (Math.random() - 0.5) * spread;

            // Velocity
            const angle = fixedAngle ?? Math.random() * Math.PI * 2;
            const speed = fixedSpeed ?? Math.random() * 200 + 100;
            this.velocities[idx * 2] = Math.cos(angle) * speed + velocity.x;
            this.velocities[idx * 2 + 1] = Math.sin(angle) * speed + velocity.y;

            // Color
            this.colors[idx * 4] = color[0];
            this.colors[idx * 4 + 1] = color[1];
            this.colors[idx * 4 + 2] = color[2];
            this.colors[idx * 4 + 3] = color[3];

            // Size and lifetime
            this.sizes[idx] = size;
            this.lifetimes[idx] = lifetime;
            this.ages[idx] = 0;

            this.particleCount++;
        }
        if (this.particleCount > 0) this._startLoop();
    }

    clear() {
        this.particleCount = 0;
    }

    // Private methods
    _initWebGL() {
        // Create overlay canvas. Without a context there is nothing to keep.
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return;
        this.canvas = canvas;
        this.gl = gl;

        // Resolve the host element. Previously this looked for a hardcoded
        // '#game-container' id, which only worked for the one game it was
        // written against.
        const container = this._resolveContainer();
        const isBody = container === document.body;

        // The overlay must scale with its host so the two canvases stay
        // aligned; 100%/100% does that regardless of the backing store size.
        this.canvas.style.cssText = `
            position: ${isBody ? 'fixed' : 'absolute'};
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        `;

        if (!isBody && window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        this._container = container;
        container.appendChild(this.canvas);
        this._resizeCanvas();

        // Setup WebGL state
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // Named so destroy() can detach it.
        this._onResize = () => {
            this._resizeCanvas();
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        };
        window.addEventListener('resize', this._onResize);

        // The browser can take the context away (GPU reset, too many
        // contexts). The program and buffer die with it. preventDefault()
        // asks for it back; they are rebuilt when it returns.
        this._onContextLost = (event) => {
            event.preventDefault();
            this._contextLost = true;
        };
        this._onContextRestored = () => {
            this._contextLost = false;
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this._createShaders();
            this._createBuffers();
        };
        this.canvas.addEventListener('webglcontextlost', this._onContextLost);
        this.canvas.addEventListener('webglcontextrestored', this._onContextRestored);
    }

    /**
     * @returns {HTMLElement}
     * @private
     */
    _resolveContainer() {
        if (typeof this.container === 'string') {
            return document.querySelector(this.container) || document.body;
        }
        return this.container || document.body;
    }

    /**
     * Size the drawing buffer to the host element.
     * @private
     */
    _resizeCanvas() {
        const host = this._container;
        const width = host === document.body ? window.innerWidth : host.clientWidth;
        const height = host === document.body ? window.innerHeight : host.clientHeight;

        this.canvas.width = Math.max(1, width);
        this.canvas.height = Math.max(1, height);
    }

    _createShaders() {
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec4 a_color;
            attribute float a_size;
            
            uniform vec2 u_resolution;
            
            varying vec4 v_color;
            
            void main() {
                // Convert from pixels to clip space
                vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                gl_PointSize = a_size;
                v_color = a_color;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            varying vec4 v_color;
            
            void main() {
                // Circular point sprite
                vec2 coord = gl_PointCoord - vec2(0.5);
                if (length(coord) > 0.5) {
                    discard;
                }
                gl_FragColor = v_color;
            }
        `;

        const vertexShader = this._compileShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this._compileShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('[WebGLParticles] Shader program failed to link');
        }
    }

    _compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('[WebGLParticles] Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    _createBuffers() {
        this.particleBuffer = this.gl.createBuffer();
    }

    _render() {
        const gl = this.gl;
        if (!gl || this._contextLost) return;

        // Clear canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (this.particleCount === 0) return;

        // Use shader program
        gl.useProgram(this.program);

        // Set resolution uniform
        const resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
        gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);

        // Interleave particle data for GPU
        const vertexData = new Float32Array(this.particleCount * 7); // x, y, r, g, b, a, size
        for (let i = 0; i < this.particleCount; i++) {
            vertexData[i * 7] = this.positions[i * 2];
            vertexData[i * 7 + 1] = this.positions[i * 2 + 1];
            vertexData[i * 7 + 2] = this.colors[i * 4];
            vertexData[i * 7 + 3] = this.colors[i * 4 + 1];
            vertexData[i * 7 + 4] = this.colors[i * 4 + 2];
            vertexData[i * 7 + 5] = this.colors[i * 4 + 3];
            vertexData[i * 7 + 6] = this.sizes[i];
        }

        // Upload to GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);

        // Setup attributes
        const stride = 7 * 4; // 7 floats * 4 bytes

        const positionLocation = gl.getAttribLocation(this.program, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);

        const colorLocation = gl.getAttribLocation(this.program, 'a_color');
        gl.enableVertexAttribArray(colorLocation);
        gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, stride, 2 * 4);

        const sizeLocation = gl.getAttribLocation(this.program, 'a_size');
        gl.enableVertexAttribArray(sizeLocation);
        gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, stride, 6 * 4);

        // Draw particles
        gl.drawArrays(gl.POINTS, 0, this.particleCount);
    }

    _removeParticle(index) {
        // Swap with last particle and decrease count
        const last = this.particleCount - 1;
        if (index !== last) {
            // Copy last particle to this index
            this.positions[index * 2] = this.positions[last * 2];
            this.positions[index * 2 + 1] = this.positions[last * 2 + 1];
            this.velocities[index * 2] = this.velocities[last * 2];
            this.velocities[index * 2 + 1] = this.velocities[last * 2 + 1];
            this.colors[index * 4] = this.colors[last * 4];
            this.colors[index * 4 + 1] = this.colors[last * 4 + 1];
            this.colors[index * 4 + 2] = this.colors[last * 4 + 2];
            this.colors[index * 4 + 3] = this.colors[last * 4 + 3];
            this.sizes[index] = this.sizes[last];
            this.lifetimes[index] = this.lifetimes[last];
            this.ages[index] = this.ages[last];
        }
        this.particleCount--;
    }
}
