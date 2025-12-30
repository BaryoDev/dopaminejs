/**
 * Generates procedural textures for prototyping.
 */
export class TextureGenerator {
    static createGround(width, height, color = '#333') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);

        // Noise / Grit
        for (let i = 0; i < 1000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#444' : '#222';
            const size = Math.random() * 4 + 2;
            ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
        }

        // Grid lines overlay (faint)
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= width; i += 64) {
            ctx.moveTo(i, 0); ctx.lineTo(i, height);
        }
        for (let i = 0; i <= height; i += 64) {
            ctx.moveTo(0, i); ctx.lineTo(width, i);
        }
        ctx.stroke();

        return canvas;
    }

    static createCharacterSheet(colorBody, colorDetail) {
        // Create a 4-frame walk cycle strip (Vertical or Horizontal)
        // Let's do Horizontal: 64x64 frames, 4 frames -> 256x64 image
        const cellW = 64;
        const cellH = 64;
        const canvas = document.createElement('canvas');
        canvas.width = cellW * 4;
        canvas.height = cellH;
        const ctx = canvas.getContext('2d');

        for (let i = 0; i < 4; i++) {
            const x = i * cellW;
            const y = 0;
            const cx = x + cellW / 2;
            const cy = y + cellH / 2;

            // -- Frame Animation Variances --
            // Bobbing effect
            const bob = (i % 2 === 0) ? 0 : -2;
            // Leg swing (simulated by shape change or just simple offset)
            const legOffset = (i === 1) ? 5 : (i === 3 ? -5 : 0);

            // Body
            ctx.fillStyle = colorBody;
            ctx.beginPath();
            ctx.arc(cx, cy + bob, 20, 0, Math.PI * 2);
            ctx.fill();

            // Shoulders/Hands (Top Down)
            ctx.fillStyle = colorDetail;
            ctx.beginPath();
            ctx.arc(cx - 15, cy + bob + legOffset, 8, 0, Math.PI * 2); // Left hand
            ctx.arc(cx + 15, cy + bob - legOffset, 8, 0, Math.PI * 2); // Right hand
            ctx.fill();

            // Head/Helmet
            ctx.fillStyle = adjustColor(colorBody, -20);
            ctx.beginPath();
            ctx.arc(cx, cy + bob, 15, 0, Math.PI * 2);
            ctx.fill();

            // Gun (if soldier)
            if (colorDetail === '#333') { // Hacky check
                ctx.fillStyle = '#000';
                ctx.fillRect(cx + 10, cy + bob - 5, 25, 6);
            }
        }

        return canvas;
    }
}

function adjustColor(color, amount) {
    return color; // Placeholder for color darkening logic
}
