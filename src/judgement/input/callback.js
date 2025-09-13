/**
 * 触摸开始事件处理函数
 * @param {TouchEvent} e - 触摸事件对象
 */
function touchStart(e)
{
    e.preventDefault();
    for (const i of e.changedTouches)
    {
        const { clientX, clientY, identifier } = i;
        this.addInput('touch', identifier, clientX - this.renderSize.widthOffset, clientY);
    }
}

/**
 * 触摸移动事件处理函数
 * @param {TouchEvent} e - 触摸事件对象
 */
function touchMove(e)
{
    e.preventDefault();
    for (const i of e.changedTouches)
    {
        const { clientX, clientY, identifier } = i;
        this.moveInput('touch', identifier, clientX - this.renderSize.widthOffset, clientY);
    }
}

/**
 * 触摸结束事件处理函数
 * @param {TouchEvent} e - 触摸事件对象
 */
function touchEnd(e)
{
    e.preventDefault();
    for (const i of e.changedTouches)
    {
        this.removeInput('touch', i.identifier);
    }
}

/**
 * 鼠标按下事件处理函数
 * @param {MouseEvent} e - 鼠标事件对象
 */
function mouseStart(e)
{
    e.preventDefault();
    const { clientX, clientY, button } = e;
    this.addInput('mouse', button, clientX - this.renderSize.widthOffset, clientY);
}

/**
 * 鼠标移动事件处理函数
 * @param {MouseEvent} e - 鼠标事件对象
 */
function mouseMove(e)
{
    const { clientX, clientY, button } = e;
    this.moveInput('mouse', button, clientX - this.renderSize.widthOffset, clientY);
}

/**
 * 鼠标抬起事件处理函数
 * @param {MouseEvent} e - 鼠标事件对象
 */
function mouseEnd(e)
{
    this.removeInput('mouse', e.button);
}

// 导出事件处理函数
export default {
    touchStart,
    touchMove,
    touchEnd,
    mouseStart,
    mouseMove,
    mouseEnd
}