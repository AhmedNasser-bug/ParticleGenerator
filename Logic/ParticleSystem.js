/**
 * Logic/ParticleSystem.js — LOGIC TIER. Pure physics, zero rendering logic.
 * Moved from Core/ParticleSystem.js. Import path for NoiseRegistry updated.
 */
import { resolveProvider } from './NoiseRegistry.js';

const O = Object.freeze({
    X:0,Y:1,VX:2,VY:3,LIFE:4,MAX_LIFE:5,SIZE:6,R:7,G:8,B:9,ALPHA:10,SHAPE:11,STRIDE:12,
});

const allocBuffer = (count) => {
    const bytes = count * O.STRIDE * Float32Array.BYTES_PER_ELEMENT;
    try { return new Float32Array(new SharedArrayBuffer(bytes)); }
    catch { return new Float32Array(bytes); }
};

class ParticleSystem {
    constructor(count, palette, shapeCount, noiseConfig, emissionCfg={}, physicsCfg={}, noiseCfg={}) {
        this.count=count; this.palette=palette; this.shapeCount=shapeCount;
        this.noiseConfig=noiseConfig; this.physicsCfg=physicsCfg; this.noiseCfg=noiseCfg;
        this.emissionRadius=emissionCfg.radius??1.0; this.falloff=emissionCfg.falloff??1.0;
        this._noise=resolveProvider(noiseConfig.active);
        this.particles=allocBuffer(count);
        this._spawnAll();
    }
    setNoiseType(name){this.noiseConfig.active=name;this._noise=resolveProvider(name);}
    setEmission(radius,falloff){this.emissionRadius=radius;this.falloff=falloff;}
    update(time){
        const p=this.particles;
        const{damping,viewportLimit,lifeMin,lifeRange,sizeMin,sizeRange,initialVelocityRange}=this.physicsCfg;
        const{mixing,providers}=this.noiseConfig;
        const timeScale=this.noiseCfg.timeScale??0.001;
        const flowMag=mixing?.flowStrength??0.004;
        const jitterAmp=(mixing?.jitterStrength??0.002)*(providers?.white?.amplitude??1.0);
        const perlinOpts={...(providers?.perlin||{}),timeScale};
        const noise=this._noise;
        for(let i=0;i<this.count;i++){
            const b=i*O.STRIDE;
            p[b+O.LIFE]-=1;
            if(p[b+O.LIFE]<=0){this._spawn(i);continue;}
            const x=p[b+O.X],y=p[b+O.Y];
            const[fx,fy]=noise.flow(x,y,time,perlinOpts);
            const[jx,jy]=noise.jitter(x,y,time,jitterAmp);
            p[b+O.VX]=(p[b+O.VX]+fx*flowMag+jx)*damping;
            p[b+O.VY]=(p[b+O.VY]+fy*flowMag+jy)*damping;
            p[b+O.X]+=p[b+O.VX]; p[b+O.Y]+=p[b+O.VY];
            const d=Math.sqrt(p[b+O.X]**2+p[b+O.Y]**2);
            p[b+O.ALPHA]=Math.max(0,Math.min(1,1-(d/this.emissionRadius)*this.falloff));
            if(d>viewportLimit||p[b+O.ALPHA]<=0)this._spawn(i);
        }
        return this.particles;
    }
    _spawn(i){
        const p=this.particles,b=i*O.STRIDE;
        const{lifeMin,lifeRange,sizeMin,sizeRange,initialVelocityRange}=this.physicsCfg;
        const angle=Math.random()*Math.PI*2,dist=Math.random()*this.emissionRadius;
        p[b+O.X]=Math.cos(angle)*dist; p[b+O.Y]=Math.sin(angle)*dist;
        p[b+O.VX]=(Math.random()-0.5)*initialVelocityRange;
        p[b+O.VY]=(Math.random()-0.5)*initialVelocityRange;
        p[b+O.LIFE]=p[b+O.MAX_LIFE]=lifeMin+Math.random()*lifeRange;
        p[b+O.SIZE]=sizeMin+Math.random()*sizeRange;
        if(this.palette.length){
            const hex=this.palette[Math.floor(Math.random()*this.palette.length)];
            p[b+O.R]=parseInt(hex.slice(1,3),16)/255;
            p[b+O.G]=parseInt(hex.slice(3,5),16)/255;
            p[b+O.B]=parseInt(hex.slice(5,7),16)/255;
        }
        p[b+O.ALPHA]=1.0; p[b+O.SHAPE]=Math.floor(Math.random()*this.shapeCount);
    }
    _spawnAll(){for(let i=0;i<this.count;i++)this._spawn(i);}
}

export { ParticleSystem, O };
