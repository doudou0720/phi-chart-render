# Phi-Chart-Render 开发文档

## 项目概述

Phi-Chart-Render 是一个基于 [Pixi.js](https://pixijs.com) 的 Phigros 谱面渲染器，支持多种格式的音乐游戏谱面渲染，包括官方谱面、PhiEdit、Re:PhiEdit 和 PRPR 格式。

## 项目结构

```
phi-chart-render/
├── public/                 # 静态资源目录
│   ├── assets/             # 游戏资源（图片、音频等）
│   ├── fonts/              # 字体文件
│   └── icons/              # 图标文件
├── src/                    # 源代码目录
│   ├── audio/              # 音频处理模块
│   ├── chart/              # 谱面处理模块
│   │   └── convert/        # 谱面格式转换器
│   ├── effect/             # 特效处理模块
│   │   ├── reader/         # 特效读取器
│   │   └── shader/         # 着色器处理
│   │       └── presets/    # 着色器预设
│   ├── game/               # 游戏主逻辑
│   ├── html/               # HTML UI 组件
│   ├── judgement/          # 判定处理模块
│   │   └── input/          # 输入处理
│   ├── phizone/            # PhiZone 接口
│   ├── style/              # 样式文件
│   ├── index.js            # 主入口文件
│   ├── main.js             # 模块导出文件
│   └── verify.js           # 数据验证工具
├── tools/                  # 构建工具
├── index.html              # 主页面
├── package.json            # 项目配置文件
├── README.md               # 项目说明文档
└── vite.config.js          # Vite 配置文件
```

## 核心模块说明

### 1. 主入口 ([src/index.js](file:///./src/index.js))

这是项目的主入口文件，负责：

- 初始化游戏环境
- 加载资源文件
- 处理用户界面交互
- 管理文件选择和游戏启动流程
- 处理 URL 参数
- 显示游戏结果

### 2. 音频模块 ([src/audio/](file:///./src/audio))

音频处理模块包含以下组件：

- [index.js](file:///./src/audio/index.js) - 音频主类，封装 Web Audio API
- [timer.js](file:///./src/audio/timer.js) - 音频计时器
- [clock.js](file:///./src/audio/clock.js) - 音频时钟同步
- [unmute.js](file:///./src/audio/unmute.js) - 音频解静音处理

### 3. 谱面模块 ([src/chart/](file:///./src/chart))

谱面处理模块包含以下组件：

- [index.js](file:///./src/chart/index.js) - 谱面主类
- [judgeline.js](file:///./src/chart/judgeline.js) - 判定线处理
- [note.js](file:///./src/chart/note.js) - 音符处理
- [convert/](file:///./src/chart/convert) - 谱面格式转换器
  - [index.js](file:///./src/chart/convert/index.js) - 转换器导出
  - [official.js](file:///./src/chart/convert/official.js) - 官方格式转换器
  - [phiedit.js](file:///./src/chart/convert/phiedit.js) - PhiEdit 格式转换器
  - [rephiedit.js](file:///./src/chart/convert/rephiedit.js) - Re:PhiEdit 格式转换器
  - [utils.js](file:///./src/chart/convert/utils.js) - 转换工具函数

### 4. 特效模块 ([src/effect/](file:///./src/effect))

特效处理模块包含以下组件：

- [index.js](file:///./src/effect/index.js) - 特效主类
- [reader/](file:///./src/effect/reader) - 特效读取器
- [shader/](file:///./src/effect/shader) - 着色器处理
  - [index.js](file:///./src/effect/shader/index.js) - 着色器主类
  - [presets/](file:///./src/effect/shader/presets) - 着色器预设

### 5. 游戏模块 ([src/game/](file:///./src/game))

游戏主逻辑模块包含以下组件：

- [index.js](file:///./src/game/index.js) - 游戏主类
- [ticker.js](file:///./src/game/ticker.js) - 游戏帧更新处理
- [callback.js](file:///./src/game/callback.js) - 游戏回调函数

### 6. 判定模块 ([src/judgement/](file:///./src/judgement))

判定处理模块包含以下组件：

- [index.js](file:///./src/judgement/index.js) - 判定主类
- [score.js](file:///./src/judgement/score.js) - 分数计算
- [point.js](file:///./src/judgement/point.js) - 判定点处理
- [input/](file:///./src/judgement/input) - 输入处理
  - [index.js](file:///./src/judgement/input/index.js) - 输入主类
  - [callback.js](file:///./src/judgement/input/callback.js) - 输入回调函数
  - [point.js](file:///./src/judgement/input/point.js) - 输入点处理

### 7. 其他模块

- [src/main.js](src/main.js) - 模块导出文件
- [src/verify.js](src/verify.js) - 数据验证工具
- [src/phizone/](src/phizone) - PhiZone 接口
- [src/html/](src/html) - HTML UI 组件
- [src/style/](src/style) - 样式文件

## 运行逻辑

### 启动流程

1. 用户打开页面，加载 [index.html](index.html)
2. 加载 [src/index.js](src/index.js) 主入口文件
3. 初始化 DOM 元素和事件监听器
4. 加载基础资源（图片、音频、字体等）
5. 用户选择谱面文件
6. 解析谱面文件并创建游戏实例
7. 用户点击开始按钮，启动游戏
8. 游戏循环开始运行，处理音频同步、谱面渲染和用户输入判定

### 游戏循环

1. 使用 Pixi.js 的 ticker 进行帧更新
2. 每帧计算当前时间并更新谱面元素状态
3. 处理用户输入并进行判定
4. 更新特效和着色器
5. 更新 UI 元素（分数、连击数等）
6. 检查游戏是否结束

## 接口说明

### 主要类接口

#### Game 类 ([src/game/index.js](src/game/index.js))

游戏主类，管理整个游戏运行。

```javascript
// 构造函数
new Game(params)

// 主要方法
game.createSprites()  // 创建游戏精灵元素
game.start()          // 开始游戏
game.pause()          // 暂停/恢复游戏
game.restart()        // 重新开始游戏
game.destroy()        // 销毁游戏实例
```

#### Chart 类 ([src/chart/index.js](src/chart/index.js))

谱面类，处理谱面数据。

```javascript
// 构造函数
new Chart(params)

// 主要方法
chart.createSprites()  // 创建谱面精灵元素
chart.resizeSprites()  // 调整精灵元素尺寸
chart.reset()          // 重置谱面状态
```

#### Judgement 类 ([src/judgement/index.js](src/judgement/index.js))

判定类，处理音符判定逻辑。

```javascript
// 构造函数
new Judgement(params)

// 主要方法
judgement.calcTick()   // 计算判定帧更新
judgement.calcNote()   // 计算音符判定
```

### URL 参数接口

- `skip_config=true` - 跳过配置界面，直接开始游戏
- `chart_url=<url>` - 从指定 URL 加载谱面文件
- `phizone_url=<url>` - 从 PhiZone 加载谱面

## 参与开发

### 开发环境搭建

1. 确保安装了 Node.js 环境
2. 克隆项目仓库：
   ```bash
   git clone https://github.com/MisaLiu/phi-chart-render
   ```
3. 安装依赖：
   ```bash
   npm install
   ```
4. 启动开发服务器：
   ```bash
   npm run dev
   ```

### 构建项目

- 开发模式构建：

  ```bash
  npm run dev
  ```
- 生产模式构建：

  ```bash
  npm run build
  ```
