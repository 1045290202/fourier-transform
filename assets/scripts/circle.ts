/**
 * @Author SJK
 * @Time 2026/9/28 11:28
 * @File circle.ts
 * @Description
 */

export class FTCircle {
    /**
     * 半径，单位：像素
     */
    private readonly _radius: number;
    /**
     * 频率 即角速度，单位：弧度/秒
     */
    private readonly _frequency: number;
    /**
     * 相位 即初始角度，单位：弧度
     */
    private readonly _phase: number;
    /**
     * 当前角度，单位：弧度
     */
    private _angle: number;
    
    get radius(): number {
        return this._radius;
    }
    
    get frequency(): number {
        return this._frequency;
    }
    
    get phase(): number {
        return this._phase;
    }
    
    get angle(): number {
        return this._angle;
    }
    
    /**
     * 构造函数
     * @param radius 半径
     * @param frequency 频率 即角速度
     * @param phase 相位 即初始角度
     */
    constructor(radius: number, frequency: number, phase: number) {
        this._radius = radius;
        this._frequency = frequency;
        this._phase = phase;
        this._angle = phase;
    }
    
    /**
     * 更新
     * @param dt 时间间隔，单位：秒（即 Component.update 的 dt）
     */
    update(dt: number) {
        // 更新角度
        this._angle += this._frequency * dt;
    }
    
    /**
     * 重置
     */
    reset() {
        this._angle = this._phase;
    }
}