
export class Vector{

    constructor(x, y){
        this.x = x;
        this.y = y;

    }

    magnitude() {
        return(Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2)));
    }

    direction(){
        return(Math.atan2(this.x, this.y));
    }

    dot(otherVec) {
        return (otherVec.x * this.x) + (otherVec.y * this.y);
    }
    
    sub(otherVec) {
        return new Vector(this.x - otherVec.x, this.y - otherVec.y);
    }

    component(otherVec) {
        return (this.dot(otherVec) / otherVec.magnitude());
    }
}