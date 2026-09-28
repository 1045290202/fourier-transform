/**
 * @Author SJK
 * @Time 2026/9/28 14:00
 * @File FTCircleChain.ts
 * @Description 傅里叶圆链：负责圆的创建与链式坐标计算，不涉及任何渲染逻辑
 */
import { _decorator, Component } from "cc";
import { FTCircle } from "db://assets/scripts/circle";

const {ccclass, property} = _decorator;

/**
 * 圆配置
 * radius 半径，单位：像素；frequency 频率 即角速度，单位：弧度/秒，负值表示反向旋转；phase 相位 即初始角度，单位：弧度
 */
export interface FTCircleConfig {
    radius: number;
    frequency: number;
    phase: number;
}

/**
 * 待绘制圆数据：圆心坐标与半径，单位：像素
 */
export interface FTDrawCircle {
    x: number;
    y: number;
    radius: number;
}

/**
 * 待绘制路径点数据，单位：像素
 */
export interface FTDrawPoint {
    x: number;
    y: number;
}

/**
 * 固定生成的圆配置（首圆不转，仅使用半径）
 */
const FIXED_CIRCLES: FTCircleConfig[] = [
    {radius: 100, frequency: 0, phase: 0},
    {radius: 50, frequency: 1, phase: Math.PI / 2},
    {radius: 25, frequency: -2, phase: Math.PI},
    {radius: 12.5, frequency: 3, phase: Math.PI / 2},
    {radius: 6.25, frequency: -4, phase: Math.PI},
];

@ccclass()
export class FTCircleChain extends Component {
    /**
     * 圆配置，默认使用固定配置，可在编辑器中修改
     */
    @property({type: [Object]})
    circlesConfig: FTCircleConfig[] = FIXED_CIRCLES.map((item) => ({...item}));
    /**
     * 是否按半径从大到小排序，使圆呈现由外向内的嵌套效果
     */
    @property
    sortRadiusDesc: boolean = true;
    /**
     * 路径最大点数，超出后丢弃最旧的点
     */
    @property
    maxPoints: number = 1000;
    
    ftCircles: FTCircle[] = [];
    drawCircles: FTDrawCircle[] = [];
    drawPoints: FTDrawPoint[] = [];
    
    onLoad() {
        this.initCircles();
    }
    
    /**
     * 按当前配置生成一组傅里叶圆，可在运行时调用以重置
     */
    initCircles() {
        this.ftCircles = this._createCircles();
        this.drawCircles = [];
        this.drawPoints = [];
    }
    
    /**
     * 推进一帧：更新各圆角度，并计算链式圆心坐标与路径点
     * @param dt 时间间隔，单位：秒
     */
    updateChain(dt: number) {
        if (this.ftCircles.length === 0) {
            return;
        }
        this.drawCircles = [];
        let x: number = 0;
        let y: number = 0;
        // 首圆不转
        this.drawCircles.push({x, y, radius: this.ftCircles[0].radius});
        for (let i = 1; i < this.ftCircles.length; i++) {
            const circle = this.ftCircles[i];
            circle.update(dt);
            x += circle.radius * Math.cos(circle.angle);
            y += circle.radius * Math.sin(circle.angle);
            this.drawCircles.push({x, y, radius: circle.radius});
        }
        // 保持最多 maxPoints 个点
        const exceedCount = this.drawPoints.length - this.maxPoints;
        if (exceedCount > 0) {
            this.drawPoints.splice(0, exceedCount);
        }
        this.drawPoints.push({x, y});
    }
    
    /**
     * 按配置创建圆数组
     * @private
     */
    private _createCircles(): FTCircle[] {
        const circles: FTCircle[] = this.circlesConfig
            .filter((item) => item.radius > 0)
            .map((item) => new FTCircle(item.radius, item.frequency, item.phase));
        if (this.sortRadiusDesc) {
            circles.sort((a, b) => b.radius - a.radius);
        }
        return circles;
    }
}
