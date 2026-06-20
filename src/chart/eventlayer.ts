interface EventItem {
    startTime: number;
    endTime: number;
    start?: number;
    end?: number;
    value?: number;
    [key: string]: unknown;
}

interface SpeedEventItem {
    startTime: number;
    endTime: number;
    value: number;
    start?: number;
    end?: number;
    [key: string]: unknown;
}

export default class EventLayer
{
    speed: SpeedEventItem[];
    moveX: EventItem[];
    moveY: EventItem[];
    alpha: EventItem[];
    rotate: EventItem[];

    _speed: number;
    _posX: number;
    _posY: number;
    _alpha: number;
    _rotate: number;

    constructor()
    {
        this.speed  = [];
        this.moveX  = [];
        this.moveY  = [];
        this.alpha  = [];
        this.rotate = [];

        this._speed  = 0;
        this._posX   = 0;
        this._posY   = 0;
        this._alpha  = 0;
        this._rotate = 0;
    }

    sort(): void
    {
        const sorter = (a: { startTime: number }, b: { startTime: number }) => a.startTime - b.startTime;
        this.speed.sort(sorter);
        this.moveX.sort(sorter);
        this.moveY.sort(sorter);
        this.alpha.sort(sorter);
        this.rotate.sort(sorter);
    }

    calcTime(currentTime: number): void
    {
        this._posX   = valueCalculator(this.moveX, currentTime, this._posX);
        this._posY   = valueCalculator(this.moveY, currentTime, this._posY);
        this._alpha  = valueCalculator(this.alpha, currentTime, this._alpha);
        this._rotate = valueCalculator(this.rotate, currentTime, this._rotate);

        for (let i = 0, length = this.speed.length; i < length; i++)
        {
            let event = this.speed[i];
            if (event.endTime < currentTime) continue;
            if (event.startTime > currentTime) break;

            this._speed = event.value;
        }
    }
}

function valueCalculator(events: EventItem[], currentTime: number, originValue: number = 0): number
{
    for (let i = 0, length = events.length; i < length; i++)
    {
        let event = events[i];
        if (event.endTime < currentTime) continue;
        if (event.startTime > currentTime) break;
        if (event.start == event.end) return event.start as number;

        let timePercentEnd = (currentTime - event.startTime) / (event.endTime - event.startTime);
        let timePercentStart = 1 - timePercentEnd;

        return (event.start as number) * timePercentStart + (event.end as number) * timePercentEnd;
    }
    return originValue;
}
