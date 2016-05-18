/**
 * Created by lazsb on 5/17/16.
 */

export class Vector{

    constructor(x, y){ 
        this.magnitude = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
        this.direction = Math.atan2(x, y);

    }
}