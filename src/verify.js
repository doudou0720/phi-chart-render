/**
 * 验证并转换布尔值
 * @param {*} bool - 待验证的值
 * @param {boolean} defaultValue - 默认值，默认为false
 * @returns {boolean} 验证后的布尔值
 */
function bool(bool, defaultValue = false)
{
    return (typeof bool === 'boolean') ? !!bool : defaultValue;
}

/**
 * 验证并转换数值
 * @param {*} number - 待验证的值
 * @param {number} defaultValue - 默认值，默认为0
 * @param {number} min - 最小值，默认为-Infinity
 * @param {number} max - 最大值，默认为Infinity
 * @returns {number} 验证后的数值
 */
function number(number, defaultValue = 0, min = -Infinity, max = Infinity)
{
    return (!isNaN(number) && min <= parseFloat(number) && parseFloat(number) <= max ? parseFloat(number) : defaultValue);
}

/**
 * 验证并转换字符串
 * @param {*} text - 待验证的值
 * @param {string} defaultValue - 默认值，默认为空字符串
 * @returns {string} 验证后的字符串
 */
function text(text, defaultValue = '')
{
    return ((typeof text === 'string') && text != '') ? text : defaultValue;
}

// 导出验证函数
export {
    bool,
    number,
    text
}