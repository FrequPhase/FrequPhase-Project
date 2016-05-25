

export class FrequencyShifter {
    constructor(context, inputNode, outputNode) {
        this.audioContext = context;
        this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);
        this.shifter = new Pitchshift(2048, this.audioContext.sampleRate, "FFT");
        this.processorNode.onaudioprocess = ((event) => this.processAudio(event));
        this.shiftMultiplier = 1;
        inputNode.connect(this.processorNode);
        this.processorNode.connect(outputNode);
    }

    setShift(mul) {
        this.shiftMultiplier = mul;
    }

    processAudio(event) {
        let outputData = [];
        outputData[0] = event.outputBuffer.getChannelData(0);
        let inputData = [];
        inputData[0] = event.inputBuffer.getChannelData(0);

        this.shifter.process(this.shiftMultiplier, inputdata[0].length, 4, inputdata[0]);

        let outData = outputData[0];
        for (i = 0; i < outData.length; ++i) {
            outData[i] = this.shifter.outdata[i];
        }
    }
}