export type Node2D = {
  /** Coordenadas geométricas em metros. */
  id: number; x: number; y: number;
  fixX?: boolean; fixY?: boolean; fixR?: boolean;
  /** Cargas nodais globais: fx/fy em kN; mz em kNm. */
  fx?: number; fy?: number; mz?: number;
}

export type RCSection = { b:number; h:number; cover:number; fck:number; fyk:number }
export type ElementKind = 'frame'|'truss'
export type MemberLoadType='uniform'|'triangular'|'trapezoidal'|'point'|'moment'
export type MemberLoadAxis='localY'|'localX'

/**
 * Ação aplicada diretamente numa barra.
 * - x/x1/x2 em metros medidos desde n1;
 * - P em kN; M em kNm; q1/q2 em kN/m;
 * - sinais seguem os eixos locais do elemento.
 */
export type MemberLoad={
  id:string;
  type:MemberLoadType;
  axis?:MemberLoadAxis;
  x?:number;
  x1?:number;
  x2?:number;
  P?:number;
  M?:number;
  q1?:number;
  q2?:number;
  label?:string;
}

export type Element2D = {
  id: number; n1: number; n2: number;
  /** E em MPa=N/mm²; A em mm²; I em mm⁴. */
  E: number; A: number; I: number;
  /** Comportamento: pórtico 2D (default) ou barra de treliça axial. */
  kind?: ElementKind;
  /** Compatibilidade com projetos antigos: carga distribuída uniforme local Y em kN/m. */
  qy?: number;
  /** V1.7.5: várias ações independentes na mesma barra. */
  loads?: MemberLoad[];
  /** Libertações rotacionais opcionais. Ausente/false = ligação rígida. */
  releaseStartR?: boolean;
  releaseEndR?: boolean;
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
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))

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

function T(c:number,s:number):Mat { return [
  [c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],
  [0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]
]}

const GL8_X=[-0.9602898564975363,-0.7966664774136267,-0.5255324099163290,-0.1834346424956498,0.1834346424956498,0.5255324099163290,0.7966664774136267,0.9602898564975363]
const GL8_W=[0.1012285362903763,0.2223810344533745,0.3137066458778873,0.3626837833783620,0.3626837833783620,0.3137066458778873,0.2223810344533745,0.1012285362903763]

function shapeBending(x:number,L:number){
  const r=clamp(x/Math.max(L,1e-12),0,1),r2=r*r,r3=r2*r
  return {
    N1:1-3*r2+2*r3,
    N2:L*(r-2*r2+r3),
    N3:3*r2-2*r3,
    N4:L*(-r2+r3),
    dN1:(-6*r+6*r2)/L,
    dN2:1-4*r+3*r2,
    dN3:(6*r-6*r2)/L,
    dN4:-2*r+3*r2
  }
}

function elementLoads(e:Element2D,Lm:number):MemberLoad[]{
  const loads=(e.loads??[]).map(x=>({...x}))
  if(e.qy!==undefined&&Math.abs(e.qy)>1e-12&&!loads.some(l=>l.id==='legacy-qy')){
    loads.unshift({id:'legacy-qy',type:'uniform',axis:'localY',x1:0,x2:Lm,q1:e.qy,q2:e.qy,label:'q'})
  }
  return loads
}

function normalizeLoad(load:MemberLoad,Lm:number):MemberLoad{
  const x=clamp(load.x??Lm/2,0,Lm)
  let x1=clamp(load.x1??0,0,Lm),x2=clamp(load.x2??Lm,0,Lm)
  if(x2<x1)[x1,x2]=[x2,x1]
  if(Math.abs(x2-x1)<1e-9)x2=Math.min(Lm,x1+1e-6)
  if(load.type==='uniform')return {...load,axis:'localY',x1,x2,q2:load.q1??load.q2??0,q1:load.q1??load.q2??0}
  if(load.type==='triangular')return {...load,axis:'localY',x1,x2,q1:load.q1??0,q2:load.q2??0}
  if(load.type==='trapezoidal')return {...load,axis:'localY',x1,x2,q1:load.q1??0,q2:load.q2??0}
  if(load.type==='point')return {...load,axis:load.axis??'localY',x,P:load.P??0}
  return {...load,axis:'localY',x,M:load.M??0}
}

function integrate(a:number,b:number,f:(x:number)=>number){
  if(b<=a)return 0
  const c=(a+b)/2,h=(b-a)/2
  let s=0
  for(let i=0;i<8;i++)s+=GL8_W[i]*f(c+h*GL8_X[i])
  return s*h
}

function distributedValue(load:MemberLoad,xm:number){
  const a=load.x1??0,b=load.x2??0
  if(xm<a-1e-12||xm>b+1e-12||b<=a)return 0
  const t=(xm-a)/(b-a),q1=load.q1??0,q2=load.q2??q1
  return q1+(q2-q1)*t
}

function equivalentLoadVector(e:Element2D,Lmm:number,kind:ElementKind):number[]{
  const fl=Array<number>(6).fill(0),Lm=Lmm/1000
  if(kind==='truss'){
    for(const raw of elementLoads(e,Lm)){
      const load=normalizeLoad(raw,Lm)
      if(load.type==='point'&&load.axis==='localX'){
        const x=(load.x??0)*1000,r=x/Lmm,P=(load.P??0)*1000
        fl[0]+=P*(1-r);fl[3]+=P*r
      }
    }
    return fl
  }
  for(const raw of elementLoads(e,Lm)){
    const load=normalizeLoad(raw,Lm)
    if(load.type==='uniform'||load.type==='triangular'||load.type==='trapezoidal'){
      const a=(load.x1??0)*1000,b=(load.x2??Lm)*1000
      for(let k=0;k<8;k++){
        const x=(a+b)/2+(b-a)/2*GL8_X[k],xm=x/1000,q=distributedValue(load,xm) // kN/m == N/mm
        const sh=shapeBending(x,Lmm),w=GL8_W[k]*(b-a)/2
        fl[1]+=sh.N1*q*w;fl[2]+=sh.N2*q*w;fl[4]+=sh.N3*q*w;fl[5]+=sh.N4*q*w
      }
    }else if(load.type==='point'){
      const x=(load.x??Lm/2)*1000,P=(load.P??0)*1000,r=x/Lmm
      if(load.axis==='localX'){fl[0]+=P*(1-r);fl[3]+=P*r}
      else{const sh=shapeBending(x,Lmm);fl[1]+=sh.N1*P;fl[2]+=sh.N2*P;fl[4]+=sh.N3*P;fl[5]+=sh.N4*P}
    }else if(load.type==='moment'){
      const x=(load.x??Lm/2)*1000,M=(load.M??0)*1e6,sh=shapeBending(x,Lmm)
      fl[1]+=sh.dN1*M;fl[2]+=sh.dN2*M;fl[4]+=sh.dN3*M;fl[5]+=sh.dN4*M
    }
  }
  return fl
}

function cumulativeDistributed(load:MemberLoad,xm:number,withLever=false){
  const a=load.x1??0,b=Math.min(load.x2??0,xm)
  if(b<=a)return 0
  return integrate(a,b,s=>{
    const q=distributedValue(load,s)*1000 // kN/m -> N/m
    return withLever?q*(xm-s):q
  })
}


function condenseFrameEndReleases(kl:Mat,fl:number[],releaseStart:boolean,releaseEnd:boolean){
  const released:number[]=[]
  if(releaseStart)released.push(2)
  if(releaseEnd)released.push(5)
  if(!released.length)return {klCond:kl.map(r=>[...r]),flCond:[...fl],released,retained:[0,1,2,3,4,5]}
  const retained=[0,1,2,3,4,5].filter(i=>!released.includes(i))
  const Krr=retained.map(i=>retained.map(j=>kl[i][j]))
  const Krq=retained.map(i=>released.map(j=>kl[i][j]))
  const Kqr=released.map(i=>retained.map(j=>kl[i][j]))
  const Kqq=released.map(i=>released.map(j=>kl[i][j]))
  const invQ=inv(Kqq)
  const correction=mm(Krq,mm(invQ,Kqr))
  const klCond=zeros(6,6)
  retained.forEach((ri,r)=>retained.forEach((cj,c)=>{klCond[ri][cj]=Krr[r][c]-correction[r][c]}))
  const fq=released.map(i=>[fl[i]])
  const adjust=mm(Krq,mm(invQ,fq)).map(r=>r[0])
  const flCond=Array<number>(6).fill(0)
  retained.forEach((ri,r)=>{flCond[ri]=fl[ri]-adjust[r]})
  return {klCond,flCond,released,retained}
}

function recoverReleasedLocalDisplacements(kl:Mat,fl:number[],ulNode:number[],released:number[],retained:number[]){
  if(!released.length)return [...ulNode]
  const Kqr=released.map(i=>retained.map(j=>kl[i][j]))
  const Kqq=released.map(i=>released.map(j=>kl[i][j]))
  const ur=retained.map(i=>[ulNode[i]])
  const rhs=released.map((i,r)=>[fl[i]-mm(Kqr,ur)[r][0]])
  const uq=mm(inv(Kqq),rhs).map(r=>r[0])
  const out=[...ulNode]
  released.forEach((i,k)=>out[i]=uq[k])
  return out
}

function memberSamples(Lm:number,end:number[],kind:ElementKind,loads:MemberLoad[],count=121):MemberSample[]{
  if(kind==='truss'){
    const N0=-end[0]
    return Array.from({length:count},(_,i)=>{
      const x=Lm*i/(count-1)
      let N=N0
      for(const raw of loads){const l=normalizeLoad(raw,Lm);if(l.type==='point'&&l.axis==='localX'&&(l.x??0)<=x+1e-10)N-=(l.P??0)*1000}
      return {x,N,V:0,M:0}
    })
  }
  const N0=-end[0],V0=-end[1],M0=-end[2]
  return Array.from({length:count},(_,i)=>{
    const x=Lm*i/(count-1)
    let N=N0,V=V0,M=M0+V0*x*1000
    for(const raw of loads){
      const l=normalizeLoad(raw,Lm)
      if(l.type==='uniform'||l.type==='triangular'||l.type==='trapezoidal'){
        const cq=cumulativeDistributed(l,x,false),cm=cumulativeDistributed(l,x,true)
        V-=cq;M-=cm*1000
      }else if(l.type==='point'&&(l.x??0)<=x+1e-10){
        if(l.axis==='localX')N-=(l.P??0)*1000
        else{V-=(l.P??0)*1000;M-=(l.P??0)*1000*(x-(l.x??0))*1000}
      }else if(l.type==='moment'&&(l.x??0)<=x+1e-10){M+=(l.M??0)*1e6}
    }
    return {x,N,V,M}
  })
}

/**
 * Pórtico/treliça plana 2D por MEF.
 * Entrada: coordenadas [m], cargas nodais [kN/kNm], ações de barra [kN, kNm, kN/m].
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

  const frameConnected=new Set<number>()
  for(const e of model.elements){
    if((e.kind??'frame')==='frame'){
      if(!e.releaseStartR)frameConnected.add(e.n1)
      if(!e.releaseEndR)frameConnected.add(e.n2)
    }
  }

  const cache:{e:Element2D;kind:ElementKind;i:number;j:number;Lmm:number;Lm:number;tr:Mat;kl:Mat;klCond:Mat;dofs:number[];fl:number[];flCond:number[];released:number[];retained:number[];loads:MemberLoad[]}[]= []
  for(const e of model.elements){
    const i=nodeIndex.get(e.n1), j=nodeIndex.get(e.n2)
    if(i===undefined||j===undefined) throw new Error(`Elemento E${e.id}: nó inexistente.`)
    const n1=model.nodes[i],n2=model.nodes[j]
    const dx=(n2.x-n1.x)*1000,dy=(n2.y-n1.y)*1000,Lmm=Math.hypot(dx,dy)
    if(Lmm<=1e-6) throw new Error(`Elemento E${e.id}: comprimento nulo.`)
    const Lm=Lmm/1000,c=dx/Lmm,s=dy/Lmm,kind=e.kind??'frame'
    const kl=kind==='truss'?localKTruss(e.E,e.A,Lmm):localKFrame(e.E,e.A,e.I,Lmm)
    const loads=elementLoads(e,Lm).map(l=>normalizeLoad(l,Lm))
    if(kind==='truss'&&loads.some(l=>l.type!=='point'||l.axis!=='localX')) throw new Error(`Elemento E${e.id}: em treliças, as ações de barra devem ser axiais. Use cargas nodais para ações transversais.`)
    const fl=equivalentLoadVector(e,Lmm,kind)
    const releaseData=kind==='frame'?condenseFrameEndReleases(kl,fl,!!e.releaseStartR,!!e.releaseEndR):{klCond:kl.map(r=>[...r]),flCond:[...fl],released:[],retained:[0,1,2,3,4,5]}
    const klCond=releaseData.klCond,flCond=releaseData.flCond
    const tr=T(c,s), kg=mm(mt(tr),mm(klCond,tr))
    const dofs=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2]
    dofs.forEach((r,rr)=>dofs.forEach((cc,cc2)=>K[r][cc]+=kg[rr][cc2]))
    const fg=mm(mt(tr),flCond.map(v=>[v])).map(r=>r[0])
    dofs.forEach((dof,k)=>F[dof]+=fg[k])
    cache.push({e,kind,i,j,Lmm,Lm,tr,kl,klCond,dofs,fl,flCond,released:releaseData.released,retained:releaseData.retained,loads})
  }

  const fixed:boolean[]=[]
  model.nodes.forEach(n=>{
    const autoFixR=!frameConnected.has(n.id)
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
    const ug=ca.dofs.map(d=>U[d]), ulNode=mm(ca.tr,ug.map(v=>[v])).map(r=>r[0])
    const ul=ca.kind==='frame'?recoverReleasedLocalDisplacements(ca.kl,ca.fl,ulNode,ca.released,ca.retained):ulNode
    const fint=mm(ca.kl,ul.map(v=>[v])).map(r=>r[0]).map((v,k)=>v-ca.fl[k])
    if(ca.e.releaseStartR)fint[2]=0
    if(ca.e.releaseEndR)fint[5]=0
    return {id:ca.e.id,kind:ca.kind,L:ca.Lm,localDisplacements:ul,endForces:fint,samples:memberSamples(ca.Lm,fint,ca.kind,ca.loads)}
  })
  return {U,R,members}
}
