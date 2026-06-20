import * as presets from './presets';
import { Filter } from 'pixi.js';

const defaultValueReg: RegExp = /uniform\s+(\w+)\s+(\w+);\s+\/\/\s+%([^%]+)%/g;

export default class Shader extends Filter {
    public defaultValues: Record<string, number | number[]>;
    public name: string;

    constructor(_shaderText: string, name: string) {
        const shaderText: string = "// " + _shaderText.replace(/uv/g, 'vTextureCoord').replace(/screenTexture/g, 'uSampler');
        const defaultValues: Record<string, number | number[]> = {};
        let uniforms: Record<string, any> = {
            time: 0,
            screenSize: [0, 0],
            UVScale: [0, 0]
        };

        [...shaderText.matchAll(defaultValueReg)].map((uniform) => {
            const type: string = uniform[1];
            const name: string = uniform[2];
            const value: string = uniform[3];

            switch (type) {
                case 'float': {
                    defaultValues[name] = parseFloat(value);
                    break;
                }
                case 'vec2':
                case 'vec4': {
                    defaultValues[name] = value.split(',').map(v => parseFloat(v.trim()));
                    break;
                }
                default: {
                    throw Error('Unknown type: ' + type);
                }
            }
        });

        uniforms = { ...defaultValues, ...uniforms };
        super(undefined, shaderText, uniforms);

        for (const name in uniforms) this.uniforms[name] = uniforms[name];
        this.defaultValues = defaultValues;

        this.name = name;
    }

    static from(shaderText: string, name: string): Shader {
        const canvas: HTMLCanvasElement = document.createElement('canvas');
        const gl: WebGLRenderingContext | null = canvas.getContext('webgl');

        if (!gl) throw 'Your browser doesn\'t support WebGL.';

        // Clear canvas
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Init shader
        const shader: WebGLShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(shader, shaderText);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw `An error occurred compiling the shaders.\n${gl.getShaderInfoLog(shader)}`;
        }

        return new Shader(shaderText, name);
    }

    static get presets(): typeof import('./presets') {
        return presets;
    }

    update(uniforms: Record<string, any>): void {
        for (const name in uniforms) this.uniforms[name] = uniforms[name];
    }
}
