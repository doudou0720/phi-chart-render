/**
 * 输入点类
 * 表示用户的触摸或鼠标输入点，用于处理输入状态和移动逻辑
 */
export default class InputPoint
{
    /**
     * 构造函数
     * @param {string} type - 输入类型 ('touch' 或 'mouse')
     * @param {number} id - 输入ID
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    constructor(type, id, x, y)
    {
        this.type = type;        // 输入类型
        this.id = id;            // 输入ID

        this.x = x;              // X坐标
        this.y = y;              // Y坐标

        this.isActive = true;    // 是否活跃
        this.isTapped = false;   // 是否已点击
        this.isMoving = false;   // 是否正在移动
        this.isFlickable = false; // 是否可滑动
        this.isFlicked = false;   // 是否已滑动

        this._deltaX = 0;        // X轴位移增量
        this._deltaY = 0;        // Y轴位移增量
        this._lastDeltaX = 0;    // 上一次X轴位移增量
        this._lastDeltaY = 0;    // 上一次Y轴位移增量
        this._currentTime = performance.now(); // 当前时间
        this._deltaTime = this._currentTime;   // 时间增量
    }

    /**
     * 移动输入点
     * @param {number} x - 新的X坐标
     * @param {number} y - 新的Y坐标
     */
    move(x, y)
    {
        this._lastDeltaX = this._deltaX;
        this._lastDeltaY = this._deltaY;

        this._deltaX = x - this.x;
        this._deltaY = y - this.y;

        this.x = x;
        this.y = y;

        this.isMoving = true;

        {
            let currentTime = performance.now();

            this._deltaTime = currentTime - this._currentTime;
            this._currentTime = currentTime;
        }

        {
            // 计算移动速度并更新滑动状态
            let moveSpeed = (this._deltaX * this._lastDeltaX + this._deltaY * this._lastDeltaY) / Math.sqrt(this._lastDeltaX ** 2 + this._lastDeltaY ** 2) / this._deltaTime;

            if (this.isFlickable && moveSpeed < 0.50)
            {
                this.isFlickable = false;
                this.isFlicked = false;
            }
            else if (!this.isFlickable && moveSpeed > 1.00)
            {
                this.isFlickable = true;
            }
        }
    }
}