import {AbstractCanvas} from "./AbstractCanvas";

class Main {
   constructor() {
       this.mainCanvas = new AbstractCanvas("main-canvas");
       let grad = this.mainCanvas.ctx.createLinearGradient(0, 0,  500, 500);
       grad.addColorStop(0, "red");
       grad.addColorStop(0.5, "green");
       grad.addColorStop(1, "blue");
       this.mainCanvas.ctx.fillStyle = grad;
       this.mainCanvas.ctx.fillRect(0, 0, 500, 500);
   }
}


new Main();