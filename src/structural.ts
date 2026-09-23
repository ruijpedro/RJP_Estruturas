export type Node2D = {
  /** Coordenadas geométricas em metros. */
  id: number; x: number; y: number;
  fixX?: boolean; fixY?: boolean; fixR?: boolean;
  /** Cargas nodais: fx/fy em kN; mz em kNm. */
  fx?: number; fy?: number; mz?: number;
}

export type RCSection = { b:number; h:number; cover:number; fck:number; fyk:number }
export type ElementKind = 'frame'|'truss'
export type MemberLoad =
  | {id:number; type:'point'; x:number; py?:number; px?:number}
  | {id:number; type:'moment'; x:number; mz:number}
  | {id:number; type:'distributed'; a:number; b:number; qy1:number; qy2:number}

export type Element2D = {
  id: number; n1: number; n2: number;
  /** E em MPa=N/mm²; A em mm²; I em mm⁴. */
  E: number; A: number; I: number;
  /** Comportamento: pórtico 2D (default) ou barra de treliça axial. */
  kind?: ElementKind;
  /** Carga distribuída local uniforme legada em kN/m. Apenas para elementos frame. */
  qy?: number;
  /** Cargas aplicadas diretamente na barra, referidas aos eixos locais. */
  loads?: MemberLoad[];
  /** Libertações de rotação (rótulas) nas extremidades locais do elemento frame. */
  releaseR1?: boolean;
  releaseR2?: boolean;
  section?: RCSection;
}

export type Model2D = { nodes: Node2D[]; elements: Element2D[] }
export type MemberSample = {x:number; N:number; V:number; M:number}
export type MemberResult = {
  id:number;
  kind:ElementKind;
  /** Comprimento em m. */
  L:number;
  /** [u1,v1,r1,u2,v2,r2], translações em mm e rotações em rad. */
  localDisplacements:number[];
  /** [N1,V1,M1,N2,V2,M2] em N/Nmm. */
  endForces:number[];
  /** x em m; N/V em N; M em Nmm. */
  samples:MemberSample[]
}
export type FrameResult = { U:number[]; R:number[]; members:MemberResult[] }

type Mat = number[][]
const zeros=(r:number,c:number):Mat=>Array.from({length:r},()=>Array(c).fill(0))
const mm=(a:Mat,b:Mat):Mat=>a.map((row)=>b[0].map((_,j)=>row.reduce((s,v,k)=>s+v*b[k][j],0)))
const mt=(a:Mat):Mat=>a[0].map((_,i)=>a.map(r=>r[i]))

function inv(a:Mat):Mat {
  const n=a.length, m=a.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>i===j?1:0)])
  for(let i=0;i<n;i++){
    let p=i
    for(let r=i+1;r<n;r++) if(Math.abs(m[r][i])>Math.abs(m[p][i])) p=r
    if(Math.abs(m[p][i])<1e-12) throw new Error('Matriz singular. Verifique apoios, libertações e estabilidade do modelo.')
    ;[m[i],m[p]]=[m[p],m[i]]
    const d=m[i][i]
    for(let j=0;j<2*n;j++)m[i][j]/=d
    for(let r=0;r<n;r++) if(r!==i){
      const f=m[r][i]
      for(let j=0;j<2*n;j++)m[r][j]-=f*m[i][j]
    }
  }
  return m.map(r=>r.slice(n))
}

function localKFrame(E:number,A:number,I:number,Lmm:number):Mat {
  const EA=E*A/Lmm, EI=E*I
  const a=12*EI/Lmm**3, b=6*EI/Lmm**2, c=4*EI/Lmm, d=2*EI/Lmm
  return [
    [EA,0,0,-EA,0,0],
    [0,a,b,0,-a,b],
    [0,b,c,0,-b,d],
    [-EA,0,0,EA,0,0],
    [0,-a,-b,0,a,-b],
    [0,b,d,0,-b,c]
  ]
}

function localKTruss(E:number,A:number,Lmm:number):Mat {
  const EA=E*A/Lmm
  return [
    [EA,0,0,-EA,0,0],
    [0,0,0,0,0,0],
    [0,0,0,0,0,0],
    [-EA,0,0,EA,0,0],
    [0,0,0,0,0,0],
    [0,0,0,0,0,0]
  ]
}

function releasedFrameMatrices(kl:Mat,fl:number[],releaseR1:boolean,releaseR2:boolean):{k:Mat;f:number[];released:number[]}{
  const released:number[]=[]
  if(releaseR1)released.push(2)
  if(releaseR2)released.push(5)
  if(!released.length)return {k:kl.map(r=>[...r]),f:[...fl],released}
  const active=[0,1,2,3,4,5].filter(i=>!released.includes(i))
  const Kaa=active.map(i=>active.map(j=>kl[i][j]))
  const Kar=active.map(i=>released.map(j=>kl[i][j]))
  const Kra=released.map(i=>active.map(j=>kl[i][j]))
  const Krr=released.map(i=>released.map(j=>kl[i][j]))
  const fa=active.map(i=>fl[i]),fr=released.map(i=>fl[i])
  const invKrr=inv(Krr)
  const corrK=mm(Kar,mm(invKrr,Kra))
  const corrF=mm(Kar,mm(invKrr,fr.map(v=>[v]))).map(r=>r[0])
  const condensed=zeros(6,6),f=Array<number>(6).fill(0)
  active.forEach((ri,i)=>{
    f[ri]=fa[i]-corrF[i]
    active.forEach((cj,j)=>condensed[ri][cj]=Kaa[i][j]-corrK[i][j])
  })
  return {k:condensed,f,released}
}

function recoverReleasedLocalDisplacements(kl:Mat,fl:number[],uCondensed:number[],released:number[]):number[]{
  if(!released.length)return [...uCondensed]
  const active=[0,1,2,3,4,5].filter(i=>!released.includes(i))
  const Kra=released.map(i=>active.map(j=>kl[i][j]))
  const Krr=released.map(i=>released.map(j=>kl[i][j]))
  const ua=active.map(i=>uCondensed[i]),fr=released.map(i=>fl[i])
  const rhs=fr.map((v,i)=>v-Kra[i].reduce((sum,k,j)=>sum+k*ua[j],0))
  const ur=mm(inv(Krr),rhs.map(v=>[v])).map(r=>r[0])
  const out=[...uCondensed]
  released.forEach((idx,i)=>out[idx]=ur[i])
  return out
}

function T(c:number,s:number):Mat { return [
  [c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],
  [0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]
]}

const GL5_X=[-0.906179845938664,-0.538469310105683,0,0.538469310105683,0.906179845938664]
const GL5_W=[0.236926885056189,0.478628670499366,0.568888888888889,0.478628670499366,0.236926885056189]

function beamShape(x:number,L:number){
  const r=Math.max(0,Math.min(1,x/Math.max(L,1e-12))),r2=r*r,r3=r2*r
  return {
    v1:1-3*r2+2*r3, th1:L*(r-2*r2+r3), v2:3*r2-2*r3, th2:L*(-r2+r3),
    dv1:(-6*r+6*r2)/L, dth1:1-4*r+3*r2, dv2:(6*r-6*r2)/L, dth2:-2*r+3*r2
  }
}

function addDistributedEquivalent(f:number[],Lmm:number,aMm:number,bMm:number,q1:number,q2:number){
  const a=Math.max(0,Math.min(Lmm,aMm)),b=Math.max(a,Math.min(Lmm,bMm))
  if(b-a<1e-9)return
  const mid=(a+b)/2,half=(b-a)/2
  for(let i=0;i<GL5_X.length;i++){
    const x=mid+half*GL5_X[i],t=(x-a)/(b-a),q=q1+(q2-q1)*t,w=GL5_W[i]*half,n=beamShape(x,Lmm)
    f[1]+=q*n.v1*w;f[2]+=q*n.th1*w;f[4]+=q*n.v2*w;f[5]+=q*n.th2*w
  }
}

function memberEquivalentLoads(e:Element2D,Lmm:number):number[]{
  const f=Array<number>(6).fill(0)
  if((e.kind??'frame')!=='frame')return f
  if(e.qy) addDistributedEquivalent(f,Lmm,0,Lmm,e.qy,e.qy)
  for(const load of e.loads??[]){
    if(load.type==='distributed'){
      addDistributedEquivalent(f,Lmm,load.a*1000,load.b*1000,load.qy1,load.qy2)
    }else if(load.type==='point'){
      const x=Math.max(0,Math.min(Lmm,load.x*1000)),n=beamShape(x,Lmm)
      const py=(load.py??0)*1000,px=(load.px??0)*1000,r=x/Lmm
      f[0]+=px*(1-r);f[3]+=px*r
      f[1]+=py*n.v1;f[2]+=py*n.th1;f[4]+=py*n.v2;f[5]+=py*n.th2
    }else if(load.type==='moment'){
      const x=Math.max(0,Math.min(Lmm,load.x*1000)),n=beamShape(x,Lmm),m=load.mz*1e6
      f[1]+=m*n.dv1;f[2]+=m*n.dth1;f[4]+=m*n.dv2;f[5]+=m*n.dth2
    }
  }
  return f
}

function integrateDistributedTo(load:Extract<MemberLoad,{type:'distributed'}>,xmm:number,Lmm:number){
  const a=Math.max(0,Math.min(Lmm,load.a*1000)),b=Math.max(a,Math.min(Lmm,load.b*1000)),u=Math.min(Math.max(xmm,a),b)
  if(u<=a)return {force:0,moment:0}
  const mid=(a+u)/2,half=(u-a)/2
  let force=0,moment=0
  for(let i=0;i<GL5_X.length;i++){
    const s=mid+half*GL5_X[i],t=(s-a)/Math.max(b-a,1e-12),q=load.qy1+(load.qy2-load.qy1)*t,w=GL5_W[i]*half
    force+=q*w;moment+=q*(xmm-s)*w
  }
  return {force,moment}
}

function memberSamples(Lmm:number,e:Element2D,end:number[],kind:ElementKind,count=81):MemberSample[]{
  if(kind==='truss'){
    const N0=-end[0]
    return Array.from({length:count},(_,i)=>{
      const xmm=Lmm*i/(count-1)
      return {x:xmm/1000,N:N0,V:0,M:0}
    })
  }
  const M0=-end[2],V0=end[1],N0=-end[0]
  const fullUniform=e.qy??0
  const custom=e.loads??[]
  return Array.from({length:count},(_,i)=>{
    const xmm=Lmm*i/(count-1)
    let V=V0+fullUniform*xmm,M=M0+V0*xmm+fullUniform*xmm*xmm/2,N=N0
    for(const load of custom){
      if(load.type==='distributed'){const c=integrateDistributedTo(load,xmm,Lmm);V+=c.force;M+=c.moment}
      else if(load.type==='point'){const xp=Math.max(0,Math.min(Lmm,load.x*1000));if(xmm>=xp-1e-9){const py=(load.py??0)*1000,px=(load.px??0)*1000;V+=py;M+=py*(xmm-xp);N+=px}}
      else if(load.type==='moment'){const xp=Math.max(0,Math.min(Lmm,load.x*1000));if(xmm>=xp-1e-9)M-=load.mz*1e6}
    }
    return {x:xmm/1000,N,V,M}
  })
}

/**
 * Pórtico/treliça plana 2D por MEF.
 * Entrada: coordenadas [m], cargas nodais [kN/kNm], q [kN/m].
 * Internamente: N-mm, coerente com E [MPa], A [mm²] e I [mm⁴].
 */
export function solveFrame(model:Model2D):FrameResult{
  if(model.nodes.length<2) throw new Error('O modelo precisa de pelo menos dois nós.')
  if(!model.elements.length) throw new Error('O modelo não tem elementos.')

  const nd=model.nodes.length*3, K=zeros(nd,nd), F=Array<number>(nd).fill(0)
  const nodeIndex=new Map(model.nodes.map((n,i)=>[n.id,i]))
  model.nodes.forEach((n,i)=>{
    F[3*i]=(n.fx??0)*1000
    F[3*i+1]=(n.fy??0)*1000
    F[3*i+2]=(n.mz??0)*1e6
  })

  const rotationallyConnected=new Set<number>()
  for(const e of model.elements){
    if((e.kind??'frame')==='frame'){
      if(!e.releaseR1)rotationallyConnected.add(e.n1)
      if(!e.releaseR2)rotationallyConnected.add(e.n2)
    }
  }

  const cache:{e:Element2D;kind:ElementKind;i:number;j:number;Lmm:number;Lm:number;tr:Mat;kl:Mat;kc:Mat;dofs:number[];fl:number[];fc:number[];released:number[]}[]=[]
  for(const e of model.elements){
    const i=nodeIndex.get(e.n1), j=nodeIndex.get(e.n2)
    if(i===undefined||j===undefined) throw new Error(`Elemento E${e.id}: nó inexistente.`)
    const n1=model.nodes[i],n2=model.nodes[j]
    const dx=(n2.x-n1.x)*1000,dy=(n2.y-n1.y)*1000,Lmm=Math.hypot(dx,dy)
    if(Lmm<=1e-6) throw new Error(`Elemento E${e.id}: comprimento nulo.`)
    const Lm=Lmm/1000,c=dx/Lmm,s=dy/Lmm,kind=e.kind??'frame'
    const kl=kind==='truss'?localKTruss(e.E,e.A,Lmm):localKFrame(e.E,e.A,e.I,Lmm)
    const fl=kind==='frame'?memberEquivalentLoads(e,Lmm):[0,0,0,0,0,0]
    const release=kind==='frame'?releasedFrameMatrices(kl,fl,!!e.releaseR1,!!e.releaseR2):{k:kl,f:fl,released:[] as number[]}
    const kc=release.k,fc=release.f,released=release.released
    const tr=T(c,s), kg=mm(mt(tr),mm(kc,tr))
    const dofs=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2]
    dofs.forEach((r,rr)=>dofs.forEach((cc,cc2)=>K[r][cc]+=kg[rr][cc2]))
    const fg=mm(mt(tr),fc.map(v=>[v])).map(r=>r[0])
    dofs.forEach((dof,k)=>F[dof]+=fg[k])
    cache.push({e,kind,i,j,Lmm,Lm,tr,kl,kc,dofs,fl,fc,released})
  }

  const fixed:boolean[]=[]
  model.nodes.forEach(n=>{
    // Em nós exclusivamente de treliça a rotação não tem rigidez física: elimina-se o DOF rotacional.
    const autoFixR=!rotationallyConnected.has(n.id)
    fixed.push(!!n.fixX,!!n.fixY,!!n.fixR||autoFixR)
  })

  const free=fixed.map((f,i)=>!f?i:-1).filter(i=>i>=0)
  const U=Array<number>(nd).fill(0)
  if(free.length){
    const Kff=free.map(i=>free.map(j=>K[i][j])), Ff=free.map(i=>F[i])
    const uf=mm(inv(Kff),Ff.map(v=>[v])).map(r=>r[0])
    free.forEach((d,k)=>U[d]=uf[k])
  }
  const R=K.map((row,i)=>row.reduce((sum,v,j)=>sum+v*U[j],0)-F[i])

  const members:MemberResult[]=cache.map(ca=>{
    const ug=ca.dofs.map(d=>U[d]), ulCondensed=mm(ca.tr,ug.map(v=>[v])).map(r=>r[0])
    const ul=ca.kind==='frame'?recoverReleasedLocalDisplacements(ca.kl,ca.fl,ulCondensed,ca.released):ulCondensed
    const fint=mm(ca.kl,ul.map(v=>[v])).map(r=>r[0]).map((v,k)=>v-ca.fl[k])
    return {
      id:ca.e.id,
      kind:ca.kind,
      L:ca.Lm,
      localDisplacements:ul,
      endForces:fint,
      samples:memberSamples(ca.Lmm,ca.e,fint,ca.kind)
    }
  })
  return {U,R,members}
}
