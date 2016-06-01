import MikoPitchShift from "pitch-shift";
import pool from "typedarray-pool";

const FRAME_SIZE = 2048;

export class FrequencyShifter {
    constructor(context, inputNode, outputNode) {
        this.audioContext = context;
        this.processorNode = this.audioContext.createScriptProcessor(FRAME_SIZE, 1, 1);
        this.queue = [];
        this.shifter = MikoPitchShift((data) => this.useData(data), () => this.getShift(), {
                frameSize: FRAME_SIZE
            });
        //Add some bogus data so it doesn't run out of stuff
        this.shifter(new Float32Array(FRAME_SIZE));
        this.shifter(new Float32Array(FRAME_SIZE));
        this.shifter(new Float32Array(FRAME_SIZE));
        this.shifter(new Float32Array(FRAME_SIZE));
        this.shifter(new Float32Array(FRAME_SIZE));
        this.processorNode.onaudioprocess = ((event) => this.processAudio(event));
        this.shiftMultiplier = 1;
        inputNode.connect(this.processorNode);
        this.processorNode.connect(outputNode);
        this.inputNode = inputNode;
    }

    useData(data) {
        let buf = pool.mallocFloat32(data.length);
        buf.set(data);
        this.queue.push(buf);
    }

    setShift(mul) {
        this.shiftMultiplier = mul;
    }

    getShift() {
        return this.shiftMultiplier || 1;
    }

    stop() {
        this.processorNode.disconnect();
        this.inputNode.disconnect();
        this.audioContext.close();
    }

    processAudio(event) {
        this.shifter(event.inputBuffer.getChannelData(0));
        let out = event.outputBuffer.getChannelData(0);
        let q = this.queue[0];
        this.queue.shift();
        out.set(q);
        pool.freeFloat32(q);
    }
}