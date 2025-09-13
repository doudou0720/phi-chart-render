/**
 * 判定点类
 * 用于表示判定区域中的一个点，用于音符判定
 */
export default class JudgePoint
{
    /**
     * 构造函数
     * @param {Object} input - 输入点对象
     * @param {number} type - 判定类型 (1: tap, 2: flick, 3: hold)
     */
    constructor(input, type = 1)
    {
        this.x = input.x;      // X坐标
        this.y = input.y;      // Y坐标
        this.input = input;    // 输入点对象
        this.type  = type;     // 判定类型 (1: tap, 2: flick, 3: hold)
    }

    /**
     * 检查点是否在判定区域内
     * @param {number} x - 音符X坐标
     * @param {number} y - 音符Y坐标
     * @param {number} cosr - 判定线余弦值
     * @param {number} sinr - 判定线正弦值
     * @param {number} hw - 判定区域半宽
     * @returns {boolean} 点是否在判定区域内
     */
    isInArea(x, y, cosr, sinr, hw)
    {
        return Math.abs((this.x - x) * cosr + (this.y - y) * sinr) <= hw;
    }
}