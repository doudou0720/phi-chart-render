import type InputPoint from './input/point';

interface JudgePointInput {
    x: number;
    y: number;
    isFlicked?: boolean;
}

export default class JudgePoint
{
    x: number;
    y: number;
    input: InputPoint | JudgePointInput;
    type: number; // 1: tap, 2: flick, 3: hold

    constructor(input: InputPoint | JudgePointInput, type: number = 1)
    {
        this.x = input.x;
        this.y = input.y;
        this.input = input;
        this.type  = type; // 1: tap, 2: flick, 3: hold
    }

    isInArea(x: number, y: number, cosr: number, sinr: number, hw: number): boolean
    {
        return Math.abs((this.x - x) * cosr + (this.y - y) * sinr) <= hw;
    }
}
