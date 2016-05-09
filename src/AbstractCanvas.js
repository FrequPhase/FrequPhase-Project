
export class AbstractCanvas {
    constructor(identifier) {
        this.canvas = document.getElementById(identifier);
        this.ctx = this.canvas.getContext("2d");
    }
}