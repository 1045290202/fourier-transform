/**
 * @Author SJK
 * @Time 2026/9/28 11:10
 * @File FourierTransformRender.ts
 * @Description 傅里叶变换渲染：只负责绘制，圆链数据由 FTCircleChain 提供
 */
import { _decorator, Component, Graphics, Color } from "cc";
import { FTCircleChain, FTDrawCircle, FTDrawPoint } from "db://assets/scripts/FTCircleChain";

const {ccclass, property} = _decorator;

/**
 * 固定帧间隔，单位：秒（约 60fps）
 */
const FRAME_INTERVAL: number = 0.016667;

@ccclass()
export class FourierTransformRender extends Component {
    @property(Graphics)
    circlesGraphics: Graphics | null = null;
    @property(Graphics)
    pathGraphics: Graphics | null = null;
    /**
     * 路径渐变起始颜色（对应最旧的点，即路径尾部）
     */
    @property(Color)
    pathColorStart: Color = new Color(0, 229, 255, 255);
    /**
     * 路径渐变结束颜色（对应最新的点，即画笔所在的头部）
     */
    @property(Color)
    pathColorEnd: Color = new Color(255, 45, 149, 255);
    /**
     * 圆链数据源，负责圆的创建与坐标计算
     */
    @property(FTCircleChain)
    chain: FTCircleChain | null = null;
    
    private _dtSum: number = 0;
    /**
     * 路径渐变插值复用的临时颜色，避免每段新建 Color 造成 GC 压力
     */
    private readonly _pathColor: Color = new Color();
    
    onLoad() {
        this._initGraphics();
        this._dtSum = 0;
        this._tryUpdateAll();
    }
    
    update(dt: number) {
        this._dtSum += dt;
        this._tryUpdateAll();
    }
    
    private _tryUpdateAll() {
        if (this._dtSum >= FRAME_INTERVAL) {
            this._dtSum -= FRAME_INTERVAL;
            this._onUpdate(FRAME_INTERVAL);
        }
    }
    
    private _onUpdate(dt: number) {
        this.chain?.updateChain(dt);
        this._clearBeforeUpdate();
        if (!this.chain) {
            return;
        }
        this._drawCircles(this.chain.drawCircles);
        this._drawPath(this.chain.drawPoints);
    }
    
    /**
     * 画圆
     * @param circles
     * @private
     */
    private _drawCircles(circles: FTDrawCircle[]) {
        if (!this.circlesGraphics) {
            return;
        }
        this.circlesGraphics.strokeColor = Color.WHITE;
        for (const circle of circles) {
            this._drawCircle(circle);
        }
    }
    
    /**
     * 画圆
     * @param options
     * @private
     */
    private _drawCircle(options: FTDrawCircle) {
        if (!this.circlesGraphics) {
            return;
        }
        this.circlesGraphics.circle(options.x, options.y, options.radius);
        this.circlesGraphics.stroke();
    }
    
    /**
     * 画路径：逐段描边，颜色沿路径从 pathColorStart 渐变到 pathColorEnd
     * @param points
     * @private
     */
    private _drawPath(points: FTDrawPoint[]) {
        if (!this.pathGraphics) {
            return;
        }
        if (points.length < 2) {
            return;
        }
        // 最后一个点的索引，同时作为渐变插值的分母（points.length >= 2 时恒大于 0）
        const lastIndex: number = points.length - 1;
        for (let i = 1; i < points.length; i++) {
            // 每段先设置插值颜色再描边；stroke 只处理上次描边后新增的路径段，故不会重复绘制之前的段
            Color.lerp(this._pathColor, this.pathColorStart, this.pathColorEnd, i / lastIndex);
            this.pathGraphics.strokeColor = this._pathColor;
            this.pathGraphics.moveTo(points[i - 1].x, points[i - 1].y);
            this.pathGraphics.lineTo(points[i].x, points[i].y);
            this.pathGraphics.stroke();
        }
    }
    
    /**
     * 在更新前清理
     * @private
     */
    private _clearBeforeUpdate() {
        this.circlesGraphics?.clear();
        this.pathGraphics?.clear();
    }
    
    /**
     * 初始化Graphics
     * @private
     */
    private _initGraphics() {
        if (this.circlesGraphics) {
            this.circlesGraphics.lineWidth = 3;
            this.circlesGraphics.lineCap = Graphics.LineCap.ROUND;
        }
        if (this.pathGraphics) {
            this.pathGraphics.lineWidth = 3;
            this.pathGraphics.lineCap = Graphics.LineCap.ROUND;
        }
    }
}
