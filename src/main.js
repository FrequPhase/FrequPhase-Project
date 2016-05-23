import {AbstractCanvas} from "./AbstractCanvas";
import {RotatingImage} from "./RotatingImage";
import {Vector} from "./Vector";
import {dopplerShift} from "./DopplerShift";
import {RotatingTranslatedImage} from "./RotatingTranslatedImage";

const SPEAKER_ANGULAR_VELOCITY = 1;
const SCALE = 0.1;

class Main {
    constructor() {
        this.mainCanvas = new AbstractCanvas("main-canvas");
        this.gradBase = 0;
        this.images = {
            "pinwheel": this.loadImage("img/pinwheelMockup.png"),
            "rick": this.loadImage('img/person.png')
        };
        this.wheel = new RotatingImage(this.images.pinwheel, 
            this.mainCanvas.width / 2, this.mainCanvas.height / 2, this.mainCanvas);
        this.rick = new RotatingTranslatedImage(this.images.rick,
            this.mainCanvas.width / 2, this.mainCanvas.height / 2,
            this.mainCanvas, (this.images.pinwheel.width / 2) - 50);
        this.obsX = 900;
        this.obsY = 500;
        window.requestAnimationFrame(() => this.render());
    }

    loadImage(url) {
            let img;
            img = new Image();
            img.src = url;
            return img;
    }

    render() {
        this.mainCanvas.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.wheel.updateImage(this.getSpeakerAngularVelocity());
        let startX = (this.images.pinwheel.width / 2) * Math.cos(this.wheel.angularLoc);
        let startY = (this.images.pinwheel.height / 2) * Math.sin(this.wheel.angularLoc);
        let speakerVelocity = this.getSpeakerAngularVelocity() * this.mainCanvas.width / 2;
        this.speakerVel = new Vector(speakerVelocity * Math.cos(this.wheel.angularLoc + Math.PI / 2),
            speakerVelocity * Math.sin(this.wheel.angularLoc + Math.PI / 2));
        this.posVec = new Vector(this.speakerVel.x - this.obsX, this.speakerVel.y - this.obsY);
        console.log(dopplerShift(0, this.speakerVel.component(this.posVec) * SCALE, 100, 343));
        this.rick.updateImage(this.getSpeakerAngularVelocity());
        window.requestAnimationFrame(() => this.render());
    }

    getSpeakerAngularVelocity() {
        return SPEAKER_ANGULAR_VELOCITY * (+document.getElementById("speaker-velocity").value);
    }
}

new Main();