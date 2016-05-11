import {AbstractCanvas} from "./AbstractCanvas";

class Main {
    constructor() {
        this.mainCanvas = new AbstractCanvas("main-canvas");
        this.gradBase = 0;
        this.mainCanvas.ctx.fillStyle = this.makeGrad(["red", "orange", "yellow", "green", "blue", "purple"]);
        this.mainCanvas.ctx.fillRect(0, 0, 500, 500);
        window.requestAnimationFrame(() => this.render());
    }

    makeGrad(colors) {
        // Makes a gradient that extends far beyond the screen. This allows for a smooth transition from
        // the end of the screen in the bottom right back to the top left. Otherwise, the colors would pop back and
        // forth, because the canvas API doesn't support wrapping.
        colors = colors || ["red", "green", "blue"];
        let grad = this.mainCanvas.ctx.createLinearGradient(-500, -500,  1000, 1000);
        var colorLoc = this.gradBase;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < colors.length; j++) {
                grad.addColorStop((colorLoc + (j / (3 * colors.length))) % 1, colors[j]);
            }
            colorLoc = (colorLoc + (1/3)) % 1;
        }
        return grad;
    }

    render() {
        this.mainCanvas.ctx.clearRect(0, 0, 500, 500);
        this.gradBase += 0.01;
        this.mainCanvas.ctx.fillStyle = this.makeGrad(["red", "orange", "yellow", "green", "blue", "purple"]);
        this.mainCanvas.ctx.fillRect(0, 0, 500, 500);
        window.requestAnimationFrame(() => this.render());
    }
}


new Main();