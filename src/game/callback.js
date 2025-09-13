/**
 * 键盘按键回调函数
 * 处理键盘按键事件，用于自动播放模式下的快进和快退
 * @param {Event} e - 键盘事件对象
 */
function onKeyPressCallback(e)
{
    let keyCode     = e.keyCode,      // 按键码
        isHoldCtrl  = e.ctrlKey,      // 是否按住Ctrl键
        isHoldShift = e.shiftKey,     // 是否按住Shift键
        skipTime    = 0;              // 跳转时间

    // 检查游戏状态是否允许操作
    if (this._isPaused) return;
    if (!this._settings.autoPlay) return;
    if (this._animateStatus !== 1) return;

    // 根据按键设置跳转时间
    switch (keyCode)
    {
        case 37: { // 左箭头键，快退
            skipTime = -2;
            break;
        }
        case 39: { // 右箭头键，快进
            skipTime = 2;
            break;
        }
        default: {
            return;
        }
    }
    
    // 根据组合键调整跳转时间
    if (isHoldCtrl && isHoldShift) skipTime *= 5;
    else if (isHoldCtrl) skipTime *= 2;
    else if (isHoldShift) skipTime *= 0.5;

    {
        let currentTime = this.chart.music.currentTime; // 当前音乐时间
        let calcedNoteCount = 0;                        // 已计算的音符数量

        // 重置已判定的音符
        for (const note of this.chart.notes)
        {
            if (note.isFake) continue;
            if (note.score <= 0) break;
            if (note.time < currentTime)
            {
                calcedNoteCount++;
                continue;
            }

            note.reset();
        }

        // 重置判定分数和连击数
        this.judgement.score.perfect = this.judgement.score.judgedNotes = this.judgement.score.combo = this.judgement.score.maxCombo = calcedNoteCount;
        this.judgement.score._score = (this.judgement.score.scorePerNote + this.judgement.score.scorePerCombo) * calcedNoteCount;

        // 更新显示分数和连击数
        if (this.judgement.score.sprites)
        {
            this.judgement.score.sprites.combo.number.text = this.judgement.score.combo;

            this.judgement.score.sprites.acc.text = 'ACCURACY ' + (this.judgement.score.acc * 100).toFixed(2) + '%';
            this.judgement.score.sprites.score.text = fillZero((this.judgement.score.score).toFixed(0), 7);

            this.judgement.score.sprites.combo.text.position.x = this.judgement.score.sprites.combo.number.width + this.render.sizer.heightPercent * 6;
        }

        /**
         * 补零函数
         * @param {string|number} num - 数字
         * @param {number} length - 目标长度
         * @returns {string} 补零后的字符串
         */
        function fillZero(num, length = 3)
        {
            let result = num + '';
            while (result.length < length)
            {
                result = '0' + result;
            }
            return result;
        }
    }

    // 跳转音乐播放位置
    this.chart.music.seek(skipTime);
}

/**
 * 暂停按钮点击回调函数
 * 处理暂停按钮的点击事件，双击暂停游戏
 */
function pauseBtnClickCallback()
{
    let pauseButton = this.sprites.pauseButton; // 暂停按钮精灵
    pauseButton.clickCount++;                   // 点击计数
    // 双击且在2秒内则暂停游戏
    if (pauseButton.clickCount >= 2 && Date.now() - pauseButton.lastClickTime <= 2000)
    {
        this.pause();

        pauseButton.lastRenderTime = Date.now();
        pauseButton.isEndRendering = true;
        pauseButton.clickCount = 0;
    }
    pauseButton.lastClickTime = Date.now();
}

/**
 * 游戏结束回调函数
 * 处理游戏结束时的各种操作
 */
function gameEndCallback()
{
    this._animateStatus = 2;           // 动画状态设为结束
    this._gameEndTime = Date.now();    // 记录游戏结束时间
    this.sprites.fakeJudgeline.visible = true; // 显示假判定线

    // 清空点击粒子容器
    this.judgement.clickParticleContainer.removeChildren()

    // 显示AP状态
    if (this._settings.showAPStatus)
    {
        if (this.judgement.score.APType === 1) this.sprites.fakeJudgeline.tint = 0xB4E1FF;
        else if (this.judgement.score.APType === 0) this.sprites.fakeJudgeline.tint = 0xFFFFFF;
    }
    
    // 隐藏所有判定线和音符
    for (const judgeline of this.chart.judgelines)
    {
        if (!judgeline.sprite) continue;

        judgeline.sprite.alpha = 0;
        if (judgeline.debugSprite) judgeline.debugSprite.visible = false;
    };
    for (const note of this.chart.notes)
    {
        if (!note.sprite) continue;

        note.sprite.alpha = 0;
        if (note.debugSprite) note.debugSprite.visible = false;
    };

    // 清空输入精灵
    if (this.judgement.input.sprite) this.judgement.input.sprite.clear();
}

/**
 * 运行回调函数
 * 执行指定类型的回调函数
 * @param {string} type - 回调函数类型
 */
function runCallback(type)
{
    if (!this.functions[type]) return;
    this.functions[type].forEach((callback) => callback(this));
}

// 导出回调函数
export {
    onKeyPressCallback,
    pauseBtnClickCallback,
    gameEndCallback,
    runCallback
}