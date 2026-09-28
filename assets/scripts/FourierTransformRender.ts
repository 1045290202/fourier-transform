/**
 * @Author SJK
 * @Time 2026/9/28 11:10
 * @File FourierTransformRender.ts
 * @Description 傅里叶变换渲染：只负责绘制，圆链数据由 FTCircleChain 提供
 */
import { _decorator, Component, Graphics, Color, Node, UITransform } from "cc";
import { FTCircleChain, FTDrawCircle, FTDrawPoint } from "db://assets/scripts/FTCircleChain";

const {ccclass, property} = _decorator;

/**
 * 固定帧间隔，单位：秒（约 60fps）
 */
const FRAME_INTERVAL: number = 0.016667;

@ccclass()
export class FourierTransformRender extends Component {
    @property(Graphics)
    axisGraphics: Graphics | null = null;
    @property(Graphics)
    circlesGraphics: Graphics | null = null;
    @property(Graphics)
    pathGraphics: Graphics | null = null;
    @property(Graphics)
    yWaveGraphics: Graphics | null = null;
    @property(Graphics)
    xWaveGraphics: Graphics | null = null;
    /**
     * y 分量波形描边颜色
     */
    @property(Color)
    yWaveColor: Color = new Color(126, 255, 152, 255);
    /**
     * x 分量波形描边颜色
     */
    @property(Color)
    xWaveColor: Color = new Color(255, 200, 87, 255);
    /**
     * y 分量波形相邻采样点的水平间距，单位：像素；正值波形向 +x 延伸，负值向 -x 延伸
     */
    @property
    yWaveStep: number = 1;
    /**
     * x 分量波形相邻采样点的垂直间距，单位：像素；正值波形沿 Y 轴向上延伸，负值向下滚动
     */
    @property
    xWaveStep: number = 1;
    /**
     * 波形最多保留的采样点数，超出后丢弃最旧的采样点（两条波形共用）
     */
    @property
    maxWavePoints: number = 800;
    /**
     * 坐标轴描边颜色（轴线、刻度、网格共用）
     */
    @property(Color)
    axisColor: Color = new Color(255, 255, 255, 80);
    /**
     * 刻度间隔，单位：像素；<=0 表示不画刻度；开网格时间隔过小会产生大量线段，建议不低于 20
     */
    @property
    axisTickStep: number = 50;
    /**
     * 刻度线半长，单位：像素（axisShowGrid 为 true 时忽略，刻度线会延伸成网格线）
     */
    @property
    axisTickSize: number = 6;
    /**
     * 是否把刻度线延伸为贯穿整个可见区域的网格线
     */
    @property
    axisShowGrid: boolean = false;
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
    /**
     * y 分量波形采样值（圆链末端点的 y），索引 0 为最新采样，向后依次为更早的采样
     */
    private readonly _yWaveValues: number[] = [];
    /**
     * x 分量波形采样值（圆链末端点的 x），索引 0 为最新采样，向后依次为更早的采样
     */
    private readonly _xWaveValues: number[] = [];
    
    onLoad() {
        this._initGraphics();
        this._dtSum = 0;
        this._tryUpdateAll();
        // 坐标轴为静态图形，只画一次，不参与每帧清理与重绘
        this._drawAxis();
    }
    
    onEnable() {
        // 节点尺寸（Widget 全屏对齐、分辨率变化）或锚点变化时可见区域跟着变，需重画坐标轴
        const axisNode: Node | undefined = this.axisGraphics?.node;
        axisNode?.on(Node.EventType.SIZE_CHANGED, this._drawAxis, this);
        axisNode?.on(Node.EventType.ANCHOR_CHANGED, this._drawAxis, this);
    }
    
    onDisable() {
        const axisNode: Node | undefined = this.axisGraphics?.node;
        axisNode?.off(Node.EventType.SIZE_CHANGED, this._drawAxis, this);
        axisNode?.off(Node.EventType.ANCHOR_CHANGED, this._drawAxis, this);
    }
    
    update(dt: number) {
        this._dtSum += dt;
        this._tryUpdateAll();
    }
    
    /**
     * 清空波形采样数据，重新生成圆链（FTCircleChain.initCircles）后调用，避免新旧波形混在一起
     */
    resetWave() {
        this._yWaveValues.length = 0;
        this._xWaveValues.length = 0;
        this.yWaveGraphics?.clear();
        this.xWaveGraphics?.clear();
    }
    
    /**
     * 重绘坐标轴；运行时修改 axis* 属性后调用（节点尺寸变化会自动重绘）
     */
    redrawAxis() {
        this._drawAxis();
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
        this._sampleWave(this.chain.drawPoints);
        this._drawYWave();
        this._drawXWave();
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
     * 采样波形：取圆链末端点（画笔）的 y / x 作为当前时刻两条波形的采样值
     * @param points
     * @private
     */
    private _sampleWave(points: FTDrawPoint[]) {
        if (points.length === 0) {
            return;
        }
        const lastPoint: FTDrawPoint = points[points.length - 1];
        // 最新采样插到头部，使索引 0 恒为波形起点
        this._yWaveValues.unshift(lastPoint.y);
        this._xWaveValues.unshift(lastPoint.x);
        const maxCount: number = Math.max(0, Math.floor(this.maxWavePoints));
        if (this._yWaveValues.length > maxCount) {
            this._yWaveValues.length = maxCount;
        }
        if (this._xWaveValues.length > maxCount) {
            this._xWaveValues.length = maxCount;
        }
    }
    
    /**
     * 画 y 分量波形：以 yWaveGraphics 节点原点为波形起点，采样值作 y，沿 x 轴按 yWaveStep 依次连接历史采样，形成随时间水平滚动的曲线
     * @private
     */
    private _drawYWave() {
        const graphics: Graphics | null = this.yWaveGraphics;
        if (!graphics) {
            return;
        }
        const values: number[] = this._yWaveValues;
        if (values.length < 2) {
            return;
        }
        // 波形为单色，整条曲线只在末尾描边一次，避免逐段 stroke 产生多余批次
        graphics.strokeColor = this.yWaveColor;
        graphics.moveTo(0, values[0]);
        for (let i = 1; i < values.length; i++) {
            graphics.lineTo(i * this.yWaveStep, values[i]);
        }
        graphics.stroke();
    }
    
    /**
     * 画 x 分量波形：以 xWaveGraphics 节点原点为波形起点，采样值作 x，沿 y 轴按 xWaveStep 依次连接历史采样，形成紧贴 Y 轴随时间垂直滚动的曲线
     * @private
     */
    private _drawXWave() {
        const graphics: Graphics | null = this.xWaveGraphics;
        if (!graphics) {
            return;
        }
        const values: number[] = this._xWaveValues;
        if (values.length < 2) {
            return;
        }
        // 波形为单色，整条曲线只在末尾描边一次，避免逐段 stroke 产生多余批次
        graphics.strokeColor = this.xWaveColor;
        graphics.moveTo(values[0], 0);
        for (let i = 1; i < values.length; i++) {
            graphics.lineTo(values[i], i * this.xWaveStep);
        }
        graphics.stroke();
    }
    
    /**
     * 画坐标轴：以 axisGraphics 节点原点为交点，横轴与纵轴贯穿节点 UITransform 覆盖的整个可见区域
     * @private
     */
    private _drawAxis() {
        const axisGraphics = this.axisGraphics;
        if (!axisGraphics) {
            return;
        }
        axisGraphics.clear();
        const uiTransform: UITransform | null = axisGraphics.node.getComponent(UITransform);
        if (!uiTransform || uiTransform.width <= 0 || uiTransform.height <= 0) {
            return;
        }
        // Graphics 的坐标就是节点局部坐标，故按锚点把尺寸换算成局部坐标系下的可见范围
        const width: number = uiTransform.width;
        const height: number = uiTransform.height;
        const minX: number = -uiTransform.anchorPoint.x * width;
        const maxX: number = (1 - uiTransform.anchorPoint.x) * width;
        const minY: number = -uiTransform.anchorPoint.y * height;
        const maxY: number = (1 - uiTransform.anchorPoint.y) * height;
        // 轴线、刻度、网格同色，所有路径攒完后只描边一次，避免拆成多个批次
        axisGraphics.strokeColor = this.axisColor;
        this._drawAxisTicks(axisGraphics, minX, maxX, minY, maxY);
        // 横轴（时间轴）与纵轴（幅值轴），两端都顶到可见区域边界
        axisGraphics.moveTo(minX, 0);
        axisGraphics.lineTo(maxX, 0);
        axisGraphics.moveTo(0, minY);
        axisGraphics.lineTo(0, maxY);
        axisGraphics.stroke();
    }
    
    /**
     * 画刻度：沿两根轴从原点向两侧按 axisTickStep 等距铺开直到可见区域边界，axisShowGrid 为 true 时刻度线延伸为网格线
     * @param axisGraphics
     * @param minX 可见区域左边界
     * @param maxX 可见区域右边界
     * @param minY 可见区域下边界
     * @param maxY 可见区域上边界
     * @private
     */
    private _drawAxisTicks(axisGraphics: Graphics, minX: number, maxX: number, minY: number, maxY: number) {
        const step: number = this.axisTickStep;
        if (step <= 0 || (!this.axisShowGrid && this.axisTickSize <= 0)) {
            return;
        }
        // 竖直线（横轴刻度）与水平线（纵轴刻度）在两种模式下的两个端点
        const bottom: number = this.axisShowGrid ? minY : -this.axisTickSize;
        const top: number = this.axisShowGrid ? maxY : this.axisTickSize;
        const left: number = this.axisShowGrid ? minX : -this.axisTickSize;
        const right: number = this.axisShowGrid ? maxX : this.axisTickSize;
        // 用 i * step 而不是逐次累加，避免浮点误差随刻度数量放大；i 从 1 开始，跳过原点处的轴线
        for (let i = 1; i * step <= maxX; i++) {
            const x: number = i * step;
            axisGraphics.moveTo(x, bottom);
            axisGraphics.lineTo(x, top);
        }
        for (let i = 1; -i * step >= minX; i++) {
            const x: number = -i * step;
            axisGraphics.moveTo(x, bottom);
            axisGraphics.lineTo(x, top);
        }
        for (let i = 1; i * step <= maxY; i++) {
            const y: number = i * step;
            axisGraphics.moveTo(left, y);
            axisGraphics.lineTo(right, y);
        }
        for (let i = 1; -i * step >= minY; i++) {
            const y: number = -i * step;
            axisGraphics.moveTo(left, y);
            axisGraphics.lineTo(right, y);
        }
    }
    
    /**
     * 在更新前清理
     * @private
     */
    private _clearBeforeUpdate() {
        // axisGraphics 为静态图形，不在此清理，否则每帧重画白耗开销
        this.circlesGraphics?.clear();
        this.pathGraphics?.clear();
        this.yWaveGraphics?.clear();
        this.xWaveGraphics?.clear();
    }
    
    /**
     * 初始化Graphics
     * @private
     */
    private _initGraphics() {
        if (this.axisGraphics) {
            this.axisGraphics.lineWidth = 3;
            this.axisGraphics.lineCap = Graphics.LineCap.BUTT;
        }
        if (this.circlesGraphics) {
            this.circlesGraphics.lineWidth = 3;
            // this.circlesGraphics.lineCap = Graphics.LineCap.ROUND;
            this.circlesGraphics.strokeColor = new Color(175, 175, 175, 255);
        }
        if (this.pathGraphics) {
            this.pathGraphics.lineWidth = 3;
            // this.pathGraphics.lineCap = Graphics.LineCap.ROUND;
        }
        if (this.yWaveGraphics) {
            this.yWaveGraphics.lineWidth = 3;
            // 波形采样点密集，用 BEVEL/BUTT 避免 ROUND 拐角细分导致三角形数量膨胀
            this.yWaveGraphics.lineJoin = Graphics.LineJoin.BEVEL;
            this.yWaveGraphics.lineCap = Graphics.LineCap.BUTT;
        }
        if (this.xWaveGraphics) {
            this.xWaveGraphics.lineWidth = 3;
            this.xWaveGraphics.lineJoin = Graphics.LineJoin.BEVEL;
            this.xWaveGraphics.lineCap = Graphics.LineCap.BUTT;
        }
    }
}
