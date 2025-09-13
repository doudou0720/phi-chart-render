/**
 * 计算游戏主循环
 * 处理游戏的每一帧更新，包括暂停按钮动画、游戏状态更新、判定线和音符位置计算等
 */
function calcTick()
{
    { // 为暂停按钮计算渐变
        let pauseButton = this.sprites.pauseButton; // 暂停按钮精灵
        if (pauseButton.clickCount === 1) // 按钮被点击一次
        {
            if (pauseButton.alpha < 1)
            { // 按钮刚被点击一次
                pauseButton.alpha = 0.5 + (0.5 * ((Date.now() - pauseButton.lastClickTime) / 200));
            }
            else if (pauseButton.alpha >= 1 && Date.now() - pauseButton.lastClickTime >= 2000)
            { // 按钮刚被点击一次，且 2s 后没有进一步操作
                pauseButton.clickCount = 0;
                pauseButton.lastRenderTime = Date.now();
                pauseButton.isEndRendering = true;
            }
            else if (pauseButton.alpha >= 1)
            { // 按钮被点击一次，且 200ms 后不透明度已到 1
                pauseButton.alpha = 1;
                pauseButton.lastRenderTime = Date.now();
            }
        }
        else if (pauseButton.clickCount === 0 && pauseButton.isEndRendering)
        {
            if (pauseButton.alpha > 0.5)
            {
                pauseButton.alpha = 1 - (0.5 * ((Date.now() - pauseButton.lastRenderTime) / 200));
            }
            else if (pauseButton.alpha <= 0.5)
            {
                pauseButton.alpha = 0.5;
                pauseButton.lastRenderTime = Date.now();
                pauseButton.isEndRendering = false;
            }
        }
    }

    // 根据动画状态处理不同逻辑
    switch (this._animateStatus)
    {
        case 0: // 游戏开始动画
        {
            this._calcGameAnimateTick(true);
            break;
        }
        case 1: // 游戏进行中
        {
            let { chart, effects, judgement, functions, processors, sprites, render, _settings: settings } = this;
            let currentTime = chart.music.currentTime - (chart.offset + settings.offset); // 当前时间（考虑偏移量）

            // 计算BPM相关参数
            for (let i = 0, length = chart.bpmList.length; i < length; i++)
            {
                let bpm = chart.bpmList[i];

                if (bpm.endTime < currentTime) continue;
                if (bpm.startTime > currentTime) break;

                judgement._holdBetween = bpm.holdBetween;
            };

            // 更新判定线状态
            for (let i = 0, length = chart.judgelines.length; i < length; i++)
            {
                const judgeline = chart.judgelines[i];
                judgeline.calcTime(currentTime, render.sizer);
                for (let x = 0, length = processors.judgeline.length; x < length; x++) processors.judgeline[x](judgeline, currentTime);
            };
            
            // 更新音符状态并进行判定
            for (let i = 0, length = chart.notes.length; i < length; i++)
            {
                const note = chart.notes[i];
                note.calcTime(currentTime, render.sizer);
                for (let x = 0, length = processors.note.length; x < length; x++) processors.note[x](note, currentTime);
                judgement.calcNote(currentTime, note);
            };

            // 非暂停状态下更新判定和特效
            if (!this._isPaused)
            {
                judgement.calcTick();
                for (let x = 0, length = functions.tick.length; x < length; x++) functions.tick[x](this, currentTime);

                // 更新着色器特效
                if (settings.shader)
                {
                    render.gameContainer.filters = [];
                    render.stage.filters = [];

                    for (let i = 0, length = effects.length; i < length; i++)
                    {
                        const effect = effects[i];
                        if (effect.shader === null) continue;
                        if (effect.endTime < currentTime) continue;
                        if (effect.startTime > currentTime) break;

                        effect.calcTime(currentTime, render.sizer.shaderScreenSize);
                        if (effect.isGlobal) render.stage.filters.push(effect.shader);
                        else render.gameContainer.filters.push(effect.shader);
                    }
                }
            }

            // 更新进度条
            sprites.progressBar.scale.x = chart.music.progress * sprites.progressBar.baseScaleX;

            break;
        }
        case 2: // 游戏结束动画
        {
            this._calcGameAnimateTick(false);
            break;
        }
        case 3: // 游戏完全结束
        {
            break;
        }
    }
}

/**
 * 计算游戏开始/结束动画
 * 处理游戏开始和结束时的过渡动画效果
 * @param {boolean} isStart - 是否为开始动画
 */
function calcGameAnimateTick(isStart = true)
{
    let _progress = (Date.now() - (isStart ? this._gameStartTime : this._gameEndTime)) / 1500, // 动画进度
        progress = (isStart ? 1 - Math.pow(1 - _progress, 4) : Math.pow(1 - _progress, 4));     // 缓动后的进度
    let sprites = {
        score: this.judgement.score.sprites,  // 分数精灵
        chart: this.chart.sprites             // 谱面精灵
    };

    // 更新分数显示位置
    sprites.score.combo.container.position.y = -(sprites.score.combo.container.height + sprites.score.acc.height) + ((sprites.score.combo.container.height + sprites.score.acc.height + (this.render.sizer.heightPercent * 41)) * progress);
    sprites.score.acc.position.y = sprites.score.combo.container.position.y + (this.render.sizer.heightPercent * 72);
    sprites.score.score.position.y = -(sprites.score.score.height) + ((sprites.score.score.height + (this.render.sizer.heightPercent * 61)) * progress);
    
    // 更新暂停按钮和进度条位置
    this.sprites.pauseButton.position.y = -(this.sprites.pauseButton.height) + ((this.sprites.pauseButton.height + (this.render.sizer.heightPercent * (61 + 14))) * progress);
    this.sprites.progressBar.position.y = -(this.render.sizer.heightPercent * 12) * (1 - progress);

    // 更新谱面信息位置
    sprites.chart.info.songName.position.y = (this.render.sizer.height + sprites.chart.info.songName.height) - ((sprites.chart.info.songName.height + (this.render.sizer.heightPercent * 66)) * progress);
    sprites.chart.info.songDiff.position.y = sprites.chart.info.songName.position.y + (this.render.sizer.heightPercent * 24);

    // 更新假判定线动画
    this.sprites.fakeJudgeline.width = this.render.sizer.width * progress;

    // 更新背景图亮度
    if (this.chart.sprites.bg && this.chart.sprites.bg.cover) this.chart.sprites.bg.cover.alpha = this._settings.bgDim * progress;

    // 动画完成后的处理
    if (_progress >= 1)
    {
        if (isStart)
        {
            this._animateStatus = 1; // 设置为游戏进行状态
            this.resize(true, false);

            setTimeout(async () =>
            {
                this.chart.music.play(true); // 播放音乐

                // 显示判定线和音符
                for (const judgeline of this.chart.judgelines)
                {
                    if (!judgeline.sprite) continue;

                    judgeline.sprite.alpha = 1;
                    if (judgeline.debugSprite) judgeline.debugSprite.visible = true;
                };
                for (const note of this.chart.notes)
                {
                    if (note.sprite) note.sprite.alpha = note.basicAlpha;
                };

                // 更新游戏状态
                this._isPaused = false;
                this._isEnded = false;
                this.sprites.fakeJudgeline.visible = false;

                this._runCallback('start'); // 执行开始回调
            }, 200);
        }
        else
        {
            this._animateStatus = 3;     // 设置为游戏完全结束状态
            this._isPaused = true;       // 设置为暂停状态
            this._isEnded = true;        // 设置为结束状态
            this._runCallback('end');    // 执行结束回调
        }
    }
}

// 导出函数
export {
    calcTick,
    calcGameAnimateTick
}