import { Component } from '../core/Component.js';

export class Sprite extends Component {
    constructor(image) {
        super();
        this.image = image; // Image or Canvas element
        this.anchor = { x: 0.5, y: 0.5 };
        this.width = image ? image.width : 0;
        this.height = image ? image.height : 0;

        // Frame support (for spritesheets)
        this.frame = { x: 0, y: 0, w: this.width, h: this.height };
    }

    setFrame(x, y, w, h) {
        this.frame = { x, y, w, h };
        this.width = w;
        this.height = h;
    }

    setTexture(image) {
        this.image = image;
        // Reset frame if full texture
        if (image) {
            this.setFrame(0, 0, image.width, image.height);
        }
    }

    render(ctx) {
        if (!this.image) return;

        // The transform (pos, rot, scale) is already handled by the Scene/GO before calling render?
        // Wait, our GameObject implementation currently propagates render but doesn't apply context transform automatically in the base class loop?
        // Let's check GameObject.js.

        // Checking GameObject.js...
        // "ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation); ctx.scale(this.scale.x, this.scale.y); ... ctx.restore();"
        // YES, it handles logic. So we render at 0,0 local space.

        const w = this.frame.w;
        const h = this.frame.h;
        const offsetX = -w * this.anchor.x;
        const offsetY = -h * this.anchor.y;

        ctx.drawImage(
            this.image,
            this.frame.x, this.frame.y, w, h, // Source
            offsetX, offsetY, w, h            // Destination
        );
    }
}
