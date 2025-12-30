/**
 * WebGL Particle System
 * 
 * High-performance particle renderer using WebGL for 10,000+ particles
 * Implements IParticleSystem interface
 */

export class WebGLParticleSystem {
    constructor(config = {}) {
        this.maxParticles = config.maxParticles || 10000;
        this.kernel = null;

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
        this.registeredEffects = new Map();
    }

    // ISystem interface
    init(kernel) {
        this.kernel = kernel;
        this._initWebGL();
        this._createShaders();
        this._createBuffers();

        console.log('[WebGLParticles] Initialized with max particles:', this.maxParticles);
    }

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
        if (this.gl) {
            this.gl.deleteProgram(this.program);
            this.gl.deleteBuffer(this.particleBuffer);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    // IParticleSystem interface
    registerSprite(key, url) {
        // WebGL particles use point sprites, not textures (for simplicity)
        console.warn('[WebGLParticles] Sprite registration not yet implemented');
    }

    registerEffect(name, callback) {
        this.registeredEffects.set(name, callback);
    }

    play(name, x, y, ...args) {
        const effect = this.registeredEffects.get(name);
        if (effect) {
            effect.call(this, x, y, ...args);
        }
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

        for (let i = 0; i < count; i++) {
            if (this.particleCount >= this.maxParticles) break;

            const idx = this.particleCount;

            // Position
            this.positions[idx * 2] = x + (Math.random() - 0.5) * spread;
            this.positions[idx * 2 + 1] = y + (Math.random() - 0.5) * spread;

            // Velocity
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 100;
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
    }

    clear() {
        this.particleCount = 0;
    }

    // Built-in effects
    confetti(x, y, count = 50) {
        const colors = [
            [1, 0, 0, 1],    // Red
            [0, 1, 0, 1],    // Green
            [0, 0, 1, 1],    // Blue
            [1, 1, 0, 1],    // Yellow
            [1, 0, 1, 1],    // Magenta
        ];

        for (let i = 0; i < count; i++) {
            this.emit({
                x, y,
                count: 1,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                lifetime: Math.random() * 2 + 1,
                velocity: { x: 0, y: -300 },
                spread: 100
            });
        }
    }

    sparkle(x, y, count = 20, color = [1, 1, 1, 1]) {
        this.emit({
            x, y,
            count,
            color,
            size: 3,
            lifetime: 0.5,
            velocity: { x: 0, y: -50 },
            spread: 30
        });
    }

    // Private methods
    _initWebGL() {
        // Create overlay canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        `;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        document.body.appendChild(this.canvas);

        // Get WebGL context
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) {
            console.error('[WebGLParticles] WebGL not supported');
            return;
        }

        // Setup WebGL state
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

        // Handle resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        });
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
