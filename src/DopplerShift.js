
export function dopplerShift(relVel1, relVel2, originFre, vSound) {
    let newFre = originFre * (vSound + relVel1) / (vSound - relVel2);
    return newFre;
}