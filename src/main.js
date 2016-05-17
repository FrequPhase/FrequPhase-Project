import {AbstractCanvas} from "./AbstractCanvas";
import {rotatingImage} from "./RotatingImage";

class Main {
    constructor() {
        this.mainCanvas = new AbstractCanvas("main-canvas");
        this.gradBase = 0;
        this.drawGrad();
        this.images = {
            "pinwheel": this.loadImage("img/pinwheelMockup.png")
        };
        this.wheel = new rotatingImage(this.images.pinwheel, 50, 50, this.mainCanvas);
        
    }

    loadImage(url) {

            let img;
            img = new Image();
            img.src = url;

            return img;

    }



    makeGrad(width, height, colors) {
        // Makes a gradient that extends far beyond the screen. This allows for a smooth transition from
        // the end of the screen in the bottom right back to the top left. Otherwise, the colors would pop back and
        // forth, because the canvas API doesn't support wrapping.
        colors = colors || ["red", "green", "blue"];
        let grad = this.mainCanvas.ctx.createLinearGradient(-width, -height, 2 * width, 2 * height);
        var colorLoc = this.gradBase;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < colors.length; j++) { 
                grad.addColorStop((colorLoc + (j / ( 3 * colors.length))) % 1, colors[j]);
            }
            colorLoc = (colorLoc + (1 / 3)) % 1;
        }
        return grad;
    }

    render() {
        this.mainCanvas.ctx.clearRect(0, 0, 500, 500);
        this.gradBase += 0.01;
        this.drawGrad();

    }



    drawGrad() {
        this.mainCanvas.ctx.fillStyle = this.makeGrad(this.mainCanvas.canvas.width, this.mainCanvas.canvas.height,
            ["red", "orange", "yellow", "green", "blue", "purple"]);
        this.mainCanvas.ctx.fillRect(220, 200, 100, 100);
        this.mainCanvas.ctx.fillRect(250, 250, 100, 100);
        this.mainCanvas.ctx.beginPath();
        this.mainCanvas.ctx.moveTo(100, 100);
        this.mainCanvas.ctx.lineTo(150, 150);
        this.mainCanvas.ctx.lineTo(100, 150);
        this.mainCanvas.ctx.fill();
        window.requestAnimationFrame(() => this.render());
    }
}

new Main();