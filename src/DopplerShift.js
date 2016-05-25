
export function dopplerShift(relVelO, relVelS, vSound) {
    let FreMult = (vSound + relVelO) / (vSound - relVelS);
    return FreMult;
}