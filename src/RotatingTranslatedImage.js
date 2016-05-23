import {RotatingImage} from "./RotatingImage";

export class RotatingTranslatedImage extends RotatingImage {

    constructor(img, centerX, centerY, canvas, radius) {
        super(img, centerX, centerY, canvas);
        this.radius = radius;
    }

    updateImage(angularVelocity) {
        let offset = (this.isFirstTime === true) ? 0 : (angularVelocity * ((Date.now() - this.lastDrawTime) / 1000));
        let rotation = this.angularLoc + offset;
        this.isFirstTime = false;
        this.lastDrawTime = Date.now();
        this.angularLoc = rotation;
        let positionX = this.radius * Math.cos(rotation) + this.center.x - (0.5 * this.image.width);
        let positionY = this.radius * Math.sin(rotation) + this.center.y - (0.5 * this.image.height);
        this.canvas.ctx.drawImage(this.image, positionX, positionY);

    }
}