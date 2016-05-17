/**
 * Created by lazsb on 5/17/16.
 */

export class Vector{

    constructor(x, y){
        this.magnitude = sqrt(x**2 + y**2);
        this.direction = Math.atan2(x,y);

    }
}