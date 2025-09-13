/**
 * 事件层类
 * 用于管理判定线的各种事件，如速度、位置、透明度和旋转等
 */
export default class EventLayer
{
    /**
     * 构造函数
     */
    constructor()
    {
        // 各种事件数组
        this.speed  = [];   // 速度事件
        this.moveX  = [];   // X轴移动事件
        this.moveY  = [];   // Y轴移动事件
        this.alpha  = [];   // 透明度事件
        this.rotate = [];   // 旋转事件

        // 当前状态值
        this._speed  = 0;   // 当前速度
        this._posX   = 0;   // 当前X坐标
        this._posY   = 0;   // 当前Y坐标
        this._alpha  = 0;   // 当前透明度
        this._rotate = 0;   // 当前旋转角度
    }

    /**
     * 对事件按开始时间进行排序
     */
    sort()
    {
        const sorter = (a, b) => a.startTime - b.startTime;
        this.speed.sort(sorter);
        this.moveX.sort(sorter);
        this.moveY.sort(sorter);
        this.alpha.sort(sorter);
        this.rotate.sort(sorter);
    }

    /**
     * 计算指定时间点的各属性值
     * @param {number} currentTime - 当前时间
     */
    calcTime(currentTime)
    {
        this._posX   = valueCalculator(this.moveX, currentTime, this._posX);
        this._posY   = valueCalculator(this.moveY, currentTime, this._posY);
        this._alpha  = valueCalculator(this.alpha, currentTime, this._alpha);
        this._rotate = valueCalculator(this.rotate, currentTime, this._rotate);

        // 计算当前速度
        for (let i = 0, length = this.speed.length; i < length; i++)
        {
            let event = this.speed[i];
            if (event.endTime < currentTime) continue;
            if (event.startTime > currentTime) break;

            this._speed = event.value;
        }
    }
}

/**
 * 数值计算函数
 * 根据事件列表计算指定时间点的属性值
 * @param {Array} events - 事件数组
 * @param {number} currentTime - 当前时间
 * @param {number} originValue - 原始值
 * @returns {number} 计算后的值
 */
function valueCalculator(events, currentTime, originValue = 0)
{
    for (let i = 0, length = events.length; i < length; i++)
    {
        let event = events[i];
        if (event.endTime < currentTime) continue;
        if (event.startTime > currentTime) break;
        if (event.start == event.end) return event.start

        let timePercentEnd = (currentTime - event.startTime) / (event.endTime - event.startTime);
        let timePercentStart = 1 - timePercentEnd;

        return event.start * timePercentStart + event.end * timePercentEnd;
    }
    return originValue;
}