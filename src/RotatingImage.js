export class RotatingImage {
    
    constructor(img, centerX, centerY, canvas){
        this.angularLoc = 0;
        this.image = img;
        this.center = {"x": centerX, "y": centerY};
        this.canvas = canvas;
        this.isFirstTime = true;
        this.lastDrawTime = 0;
    }
    
    updateImage(angularVelocity) {
        let offset = (this.isFirstTime === true) ? 0 : (angularVelocity * ((Date.now() - this.lastDrawTime) / 1000));
        let rotation = this.angularLoc + offset;
        console.log(rotation);
        this.isFirstTime = false;
        this.canvas.ctx.save();
        this.canvas.ctx.translate(this.center.x, this.center.y);
        this.canvas.ctx.rotate(rotation);
        this.canvas.ctx.drawImage(this.image, -this.image.width / 2, -this.image.height / 2);
        this.canvas.ctx.restore();
        this.lastDrawTime = Date.now();
        this.angularLoc = rotation;
    }
    
}