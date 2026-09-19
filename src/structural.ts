export type Node2D = {
  id: number; x: number; y: number;
  fixX?: boolean; fixY?: boolean; fixR?: boolean;
  fx?: number; fy?: number; mz?: number;
}

export type Element2D = {
  id: number; n1: number; n2: number;
  E: number; A: number; I: number;
  qy?: number;
  section?: { b: number; h: number; cover: number; fck: number; fyk: number };
}

export type Model2D = { nodes: Node2D[]; elements: Element2D[] }

type Mat = number[][]
const zeros=(r:number,c:number):Mat=>Array.from({length:r},()=>Array(c).fill(0))
const mm=(a:Mat,b:Mat):Mat=>a.map((row)=>b[0].map((_,j)=>row.reduce((s,v,k)=>s+v*b[k][j],0)))
const mt=(a:Mat):Mat=>a[0].map((_,i)=>a.map(r=>r[i]))

function inv(a:Mat):Mat {
  const n=a.length, m=a.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>i===j?1:0)])
  for(let i=0;i<n;i++){
    let p=i
    for(let r=i+1;r<n;r++) if(Math.abs(m[r][i])>Math.abs(m[p][i])) p=r
    if(Math.abs(m[p][i])<1e-12) throw new Error('Matriz singular. Verifique apoios/estabilidade do modelo.')
    ;[m[i],m[p]]=[m[p],m[i]]
    const d=m[i][i]; for(let j=0;j<2*n;j++)m[i][j]/=d
    for(let r=0;r<n;r++) if(r!==i){ const f=m[r][i]; for(let j=0;j<2*n;j++)m[r][j]-=f*m[i][j] }
  }
  return m.map(r=>r.slice(n))
}

function localK(E:number,A:number,I:number,L:number):Mat {
  const EA=E*A/L, EI=E*I
  const a=12*EI/L**3, b=6*EI/L**2, c=4*EI/L, d=2*EI/L
  return [
    [EA,0,0,-EA,0,0],
    [0,a,b,0,-a,b],
    [0,b,c,0,-b,d],
    [-EA,0,0,EA,0,0],
    [0,-a,-b,0,a,-b],
    [0,b,d,0,-b,c]
  ]
}
function T(c:number,s:number):Mat { return [
  [c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],
  [0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]
]}

export function solveFrame(model:Model2D){
  const nd=model.nodes.length*3, K=zeros(nd,nd), F=Array(nd).fill(0)
  const nodeIndex=new Map(model.nodes.map((n,i)=>[n.id,i]))
  model.nodes.forEach((n,i)=>{F[3*i]=n.fx??0;F[3*i+1]=n.fy??0;F[3*i+2]=n.mz??0})
  const cache:any[]=[]
  for(const e of model.elements){
    const i=nodeIndex.get(e.n1)!, j=nodeIndex.get(e.n2)!, n1=model.nodes[i],n2=model.nodes[j]
    const dx=n2.x-n1.x,dy=n2.y-n1.y,L=Math.hypot(dx,dy),c=dx/L,s=dy/L
    const kl=localK(e.E,e.A,e.I,L), tr=T(c,s), kg=mm(mt(tr),mm(kl,tr))
    const dofs=[3*i,3*i+1,3*i+2,3*j,3*j+1,3*j+2]
    dofs.forEach((r,rr)=>dofs.forEach((cc,cc2)=>K[r][cc]+=kg[rr][cc2]))
    const q=e.qy??0
    const fl=[0,q*L/2,q*L*L/12,0,q*L/2,-q*L*L/12]
    const fg=mm(mt(tr),fl.map(v=>[v])).map(r=>r[0])
    dofs.forEach((dof,k)=>F[dof]+=fg[k])
    cache.push({e,i,j,L,c,s,tr,kl,dofs,fl})
  }
  const fixed:boolean[]=[]
  model.nodes.forEach(n=>fixed.push(!!n.fixX,!!n.fixY,!!n.fixR))
  const free=fixed.map((f,i)=>!f?i:-1).filter(i=>i>=0)
  const Kff=free.map(i=>free.map(j=>K[i][j])), Ff=free.map(i=>F[i])
  const uf=mm(inv(Kff),Ff.map(v=>[v])).map(r=>r[0]), U=Array(nd).fill(0)
  free.forEach((d,k)=>U[d]=uf[k])
  const R=K.map((row,i)=>row.reduce((s,v,j)=>s+v*U[j],0)-F[i])
  const members=cache.map(ca=>{
    const ug=ca.dofs.map((d:number)=>U[d]), ul=mm(ca.tr,ug.map((v:number)=>[v])).map(r=>r[0])
    const fint=mm(ca.kl,ul.map((v:number)=>[v])).map(r=>r[0]).map((v:number,k:number)=>v-ca.fl[k])
    return { id:ca.e.id, L:ca.L, localDisplacements:ul, endForces:fint }
  })
  return {U,R,members}
}

export function ec2RectangularBeam(input:{b:number,h:number,cover:number,fck:number,fyk:number,med:number,ved:number}){
  const {b,h,cover,fck,fyk,med,ved}=input
  const phi=16, d=h-cover-8-phi/2
  const fcd=fck/1.5, fyd=fyk/1.15
  const z=Math.min(0.95*d,0.9*d)
  const AsReq=Math.abs(med)*1e6/(fyd*z)
  const AsMin=Math.max(0.26*(0.3*fck**(2/3))/fyk*b*d,0.0013*b*d)
  const As=Math.max(AsReq,AsMin)
  const rho=As/(b*d)
  const k=Math.min(2,1+Math.sqrt(200/d))
  const vrdc=(0.18/1.5)*k*Math.cbrt(100*rho*fck)*b*d/1000
  const shearNeedsStirrups=Math.abs(ved)>vrdc
  const theta=45*Math.PI/180, fywd=fyd
  const aswPerS=shearNeedsStirrups ? Math.abs(ved)*1000/(z*fywd*(1/Math.tan(theta))) : 0
  return {d,fcd,fyd,z,AsReq,AsMin,As,rho,vrdc,shearNeedsStirrups,aswPerS}
}

export function chooseBars(As:number){
  const phis=[10,12,14,16,20,25,32]
  const sols:{phi:number,n:number,area:number}[]=[]
  for(const phi of phis)for(let n=2;n<=8;n++){const area=n*Math.PI*phi*phi/4;if(area>=As)sols.push({phi,n,area})}
  return sols.sort((a,b)=>a.area-b.area || a.n-b.n).slice(0,5)
}
