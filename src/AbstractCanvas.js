
export class AbstractCanvas {
    constructor(identifier) {
        this.canvas = document.getElementById(identifier);
        this.ctx = this.canvas.getContext("2d");
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }
}