

export class FrequencyShifter {
    constructor(context, inputNode, outputNode) {
        this.audioContext = context;
        this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);
        this.shifter = new Pitchshift(2048, this.audioContext.sampleRate, "FFT");
        this.processorNode.onaudioprocess = ((event) => this.processAudio(event));
        this.shiftMultiplier = 1;
        inputNode.connect(this.processorNode);
        this.processorNode.connect(outputNode);
        this.inputNode = inputNode;
    }

    setShift(mul) {
        this.shiftMultiplier = mul;
    }

    stop() {
        this.processorNode.disconnect();
        this.inputNode.disconnect();
        this.audioContext.close();
    }

    processAudio(event) {
        let outputBuffer = event.outputBuffer;
        let inputBuffer = event.inputBuffer;

        for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
            let inputData = inputBuffer.getChannelData(channel);
            let outputData = outputBuffer.getChannelData(channel);
            this.shifter.process(this.shiftMultiplier, inputData.length, 4, inputData);
            for (let i = 0; i < outputData.length; ++i) {
                outputData[i] = this.shifter.outdata[i];
            }
        }
    }
}