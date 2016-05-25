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
            "pinwheel": this.loadImage("img/pinwheel.png"),
            "rick": this.loadImage('img/rick.png'),
            "person": this.loadImage('img/person.png')
        };

        this.wheel = new RotatingImage(this.images.pinwheel, 
            this.mainCanvas.width / 2, this.mainCanvas.height / 2, this.mainCanvas);
        this.backWheel = new RotatingImage(this.images.pinwheel,
            this.mainCanvas.width / 2, this.mainCanvas.height / 2, this.mainCanvas);
        this.rick = new RotatingTranslatedImage(this.images.rick,
            this.mainCanvas.width / 2, this.mainCanvas.height / 2,
            this.mainCanvas, (this.images.pinwheel.width / 2) + 100);
        this.obs = new RotatingTranslatedImage(this.images.person,
            this.mainCanvas.width / 2, this.mainCanvas.height / 2,
            this.mainCanvas, (this.images.pinwheel.width / 2) - 50);

        document.getElementById("tone-button").addEventListener("onclick", () => this.setOutputTypeTone());
        document.getElementById("mp3-button").addEventListener("onclick", () => this.setOutputTypeMp3());

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
        this.wheel.updateImage(this.getObserverAngularVelocity());
        let startX = (this.images.pinwheel.width / 2) * Math.cos(this.wheel.angularLoc);
        let startY = (this.images.pinwheel.height / 2) * Math.sin(this.wheel.angularLoc);
        let speakerVelocity = this.getSpeakerAngularVelocity() * this.mainCanvas.width / 2;
        this.speakerVel = new Vector(speakerVelocity * Math.cos(this.wheel.angularLoc + Math.PI / 2),
            speakerVelocity * Math.sin(this.wheel.angularLoc + Math.PI / 2));
        this.observerVec = new Vector((Math.cos(this.obs.angularLoc) * this.obs.radius) + (this.mainCanvas.width / 2), (Math.sin(this.obs.angularLoc) * this.obs.radius) + (this.mainCanvas.height / 2));
        this.speakerVec = new Vector((Math.cos(this.rick.angularLoc) * this.rick.radius) + (this.mainCanvas.width / 2), (Math.sin(this.rick.angularLoc) * this.rick.radius) + (this.mainCanvas.height / 2));
        this.posVec = this.observerVec.sub(this.speakerVec);
        console.log(+document.getElementById('origin-frequency').value * dopplerShift(0, this.speakerVel.component(this.posVec) * SCALE, 343));
        //console.log(this.speakerVel.component(this.posVec) * SCALE);
        this.obs.updateImage(this.getObserverAngularVelocity());
        this.rick.updateImage(this.getSpeakerAngularVelocity());
        console.log(document.getElementById("tone-button").checked);
        window.requestAnimationFrame(() => this.render());
    }

    setOutputTypeTone() {

    }

    setOutputTypeMp3() {
        
    }

    getSpeakerAngularVelocity() {
        return SPEAKER_ANGULAR_VELOCITY * (+document.getElementById("speaker-velocity").value);
    }

    getObserverAngularVelocity() {
        return SPEAKER_ANGULAR_VELOCITY * (+document.getElementById("observer-velocity").value);
    }
}

new Main();