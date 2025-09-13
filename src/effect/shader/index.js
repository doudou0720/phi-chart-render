import * as presets from './presets';
import { Filter } from 'pixi.js';

// 匹配默认值的正则表达式
const defaultValueReg = /uniform\s+(\w+)\s+(\w+);\s+\/\/\s+%([^%]+)%/g;

/**
 * 着色器类
 * 继承自Pixi.js的Filter类，用于创建和管理GLSL着色器
 */
export default class Shader extends Filter {
    /**
     * 构造函数
     * @param {string} _shaderText - 着色器文本
     * @param {string} name - 着色器名称
     */
    constructor(_shaderText, name)
    {
        // 处理着色器文本，替换变量名
        const shaderText = "// " + _shaderText.replaceAll('uv', 'vTextureCoord').replaceAll('screenTexture', 'uSampler');
        const defaultValues = {}; // 默认值对象
        let uniforms = {          // 统一变量
            time: 0,              // 时间
            screenSize: [ 0, 0 ], // 屏幕尺寸
            UVScale: [ 0, 0 ]     // UV缩放
        };
        
        // 提取并解析默认值
        [ ...shaderText.matchAll(defaultValueReg) ].map((uniform) =>
            {
                const type = uniform[1];  // 变量类型
                const name = uniform[2];  // 变量名称
                const value = uniform[3]; // 默认值

                // 根据变量类型解析默认值
                switch (type)
                {
                    case 'float': // 浮点数
                    {
                        defaultValues[name] = parseFloat(value);
                        break;
                    }
                    case 'vec2':  // 二维向量
                    case 'vec4':  // 四维向量
                    {
                        defaultValues[name] = value.split(',').map(v => parseFloat(v.trim()));
                        break;
                    }
                    default:      // 未知类型
                    {
                        throw Error('Unknown type: ' + typeName);
                    }
                }
            }
        );

        // 合并统一变量
        uniforms = { ...defaultValues, ...uniforms };
        super(null, shaderText, uniforms);

        // 设置统一变量
        for (const name in uniforms) this.uniforms[name] = uniforms[name];
        this.defaultValues = defaultValues; // 保存默认值

        this.name = name; // 着色器名称
    }

    /**
     * 从着色器文本创建Shader实例
     * @param {string} shaderText - 着色器文本
     * @param {string} name - 着色器名称
     * @returns {Shader} 创建的Shader实例
     */
    static from(shaderText, name)
    {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');

        if (!gl) throw 'Your browser doesn\'t support WebGL.';

        // 清空画布
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 初始化着色器
        const shader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(shader, shaderText);
        gl.compileShader(shader);

        // 检查编译状态
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        {
            throw `An error occurred compiling the shaders.\n${gl.getShaderInfoLog(shader)}`;
        }

        return new Shader(shaderText, name);
    }
    
    /**
     * 获取预设着色器
     * @returns {Object} 预设着色器对象
     */
    static get presets()
    {
        return presets;
    }

    /**
     * 更新统一变量
     * @param {Object} uniforms - 统一变量对象
     */
    update(uniforms) {
        for (const name in uniforms) this.uniforms[name] = uniforms[name];
    }
}