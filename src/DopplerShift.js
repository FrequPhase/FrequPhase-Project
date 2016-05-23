
export function dopplerShift(relVelO, relVelS, originFre, vSound) {
    let newFre = originFre * (vSound + relVelO) / (vSound - relVelS);
    return newFre;
}