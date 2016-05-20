
export class Vector{

    constructor(x, y){
        this.x = x;
        this.y = y;

    }

    magnitude() {
        return(Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));
    }

    direction(){
        return(Math.atan2(x, y));
    }

    dot(otherVec) {
        return (otherVec.x * this.x) + (otherVec.y * this.y);
    }
    
    sub(otherVec) {
        return new Vector(otherVec.x - this.x, otherVec.y - this.y);
    }

    component(otherVec) {
        return (this.dot(otherVec) / otherVec.magnitude());
    }
}