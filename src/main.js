import {AbstractCanvas} from "./AbstractCanvas";
import {RotatingImage} from "./RotatingImage";
import {Vector} from "./Vector";
import {dopplerShift} from "./DopplerShift";
import {RotatingTranslatedImage} from "./RotatingTranslatedImage";
import {FrequencyShifter} from "./FrequencyShifter";

const SPEAKER_ANGULAR_VELOCITY = 1;
const SCALE = 0.1;

class Main {
    constructor() {
        this.mainCanvas = new AbstractCanvas("main-canvas");
        this.gradBase = 0;
        this.images = {
            "pinwheel": this.loadImage("img/pinwheel.png"),
            "backPinwheel": this.loadImage("img/BackPinwheel.png"),
            "rick": this.loadImage('img/rick.png'),
            "person": this.loadImage('img/person.png'),
            "speaker": this.loadImage('img/speaker.png')
        };

        this.wheel = new RotatingImage(this.images.pinwheel, 
            this.mainCanvas.width / 2, this.mainCanvas.height / 2, this.mainCanvas);
        this.backWheel = new RotatingImage(this.images.backPinwheel,
            this.mainCanvas.width / 2, this.mainCanvas.height / 2, this.mainCanvas);
        this.speaker = new RotatingTranslatedImage(this.images.speaker,
            this.mainCanvas.width / 2, this.mainCanvas.height / 2,
            this.mainCanvas, (this.images.backPinwheel.width / 2) - 46);
        this.obs = new RotatingTranslatedImage(this.images.person,
            this.mainCanvas.width / 2, this.mainCanvas.height / 2,
            this.mainCanvas, (this.images.pinwheel.width / 2) - 50);

        document.getElementById("tone-button").addEventListener("onclick", () => this.setOutputTypeTone());
        document.getElementById("mp3-button").addEventListener("onclick", () => this.setOutputTypeMp3());

        this.konami = new Konami(() => this.rickroll());
        
        this.rickrolled = false;

        this.shifter = undefined;
        this.setOutputTypeTone();

        window.requestAnimationFrame(() => this.render());
    }

    rickroll() {
        this.rickrolled = true;
        this.speaker.image = this.images.rick;
        this.createMusicNodeAndShifter("http://here-and-now.info/audio/rickastley_artists.mp3");
    }

    loadImage(url) {
            let img;
            img = new Image();
            img.src = url;
            return img;
    }

    render() {
        this.mainCanvas.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.backWheel.updateImage(this.getSpeakerAngularVelocity());
        this.wheel.updateImage(this.getObserverAngularVelocity());
        this.obs.updateImage(this.getObserverAngularVelocity());
        this.speaker.updateImage(this.getSpeakerAngularVelocity());
        if (this.inputNode.frequency) {
            this.inputNode.frequency.value = this.getFrequency();
        }
        this.shifter.setShift(this.dopplerScale());
        window.requestAnimationFrame(() => this.render());
    }

    setOutputTypeTone() {
        if (!this.rickrolled) {
            if (this.shifter) {
                this.shifter.stop();
            }
            let context = new AudioContext();
            this.inputNode = context.createOscillator();
            this.inputNode.frequency.value = this.getFrequency();
            this.inputNode.start();
            this.shifter = new FrequencyShifter(context, this.inputNode, context.destination);
            this.audio = undefined;
        }
    }

    setOutputTypeMp3() {
        if (!this.rickrolled) {
            this.createMusicNodeAndShifter(this.getMp3Url());
        }
    }
    
    createMusicNodeAndShifter(url) {
        if (this.shifter) {
            this.shifter.stop();
        }
        let context = new AudioContext();
        this.audio = new Audio(url);
        this.audio.crossOrigin = "anonymous";
        this.audio.autoplay = true;
        this.audio.loop = true;
        this.audio.play();
        this.inputNode = context.createMediaElementSource(this.audio);
        this.shifter = new FrequencyShifter(context, this.inputNode, context.destination);
    }

    getSpeakerAngularVelocity() {
        return SPEAKER_ANGULAR_VELOCITY * (+document.getElementById("speaker-velocity").value);
    }

    getObserverAngularVelocity() {
        return SPEAKER_ANGULAR_VELOCITY * (+document.getElementById("observer-velocity").value);
    }

    getMp3Url() {
        return document.getElementById("url-text");
    }

    getFrequency() {
        return (+document.getElementById("origin-frequency").value);
    }

    dopplerScale() {
        let startX = (this.images.pinwheel.width / 2) * Math.cos(this.wheel.angularLoc);
        let startY = (this.images.pinwheel.height / 2) * Math.sin(this.wheel.angularLoc);
        let speakerVelocity = this.getSpeakerAngularVelocity() * this.mainCanvas.width / 2;
        let speakerVel = new Vector(speakerVelocity * Math.cos(this.wheel.angularLoc + Math.PI / 2),
            speakerVelocity * Math.sin(this.wheel.angularLoc + Math.PI / 2));
        let observerVelocity = this.getObserverAngularVelocity() * this.mainCanvas.width / 2;
        let observerVel = new Vector(observerVelocity * Math.cos(this.wheel.angularLoc + Math.PI / 2),
            observerVelocity * Math.sin(this.wheel.angularLoc + Math.PI / 2));
        let observerVec = new Vector((Math.cos(this.obs.angularLoc) * this.obs.radius) + (this.mainCanvas.width / 2), (Math.sin(this.obs.angularLoc) * this.obs.radius) + (this.mainCanvas.height / 2));
        let speakerVec = new Vector((Math.cos(this.speaker.angularLoc) * this.speaker.radius) + (this.mainCanvas.width / 2), (Math.sin(this.speaker.angularLoc) * this.speaker.radius) + (this.mainCanvas.height / 2));
        let posVec = observerVec.sub(speakerVec);
        let posVec2 = speakerVec.sub(observerVec);
        return dopplerShift(0, speakerVel.component(posVec) * SCALE, 343);
    }
}

new Main();