export type EC2Status = 'OK' | 'WARN' | 'FAIL' | 'NA'

export type EC2Check = {
  id: string
  title: string
  status: EC2Status
  demand?: number
  resistance?: number
  utilization?: number
  unit?: string
  formula?: string
  note?: string
}

export type EC2MaterialInput = {
  fck: number
  fyk: number
  alphaCC?: number
  gammaC?: number
  gammaS?: number
}

export type BeamInput = EC2MaterialInput & {
  b: number
  h: number
  cover: number
  phiLong?: number
  phiSt?: number
  MEd: number
  VEd: number
  TEd?: number
  Mser?: number
  Mqp?: number
  span?: number
  AsProv?: number
  AsTopProv?: number
  AswPerSProv?: number
  cotTheta?: number
  exposure?: ExposureClass
  structuralClass?: number
  deltaCdev?: number
  dg?: number
  phiBars?: number
  nBars?: number
  phiStProv?: number
  stirrupSpacing?: number
  phiAnchor?: number
  goodBond?: boolean
}

export type ColumnInput = EC2MaterialInput & {
  b: number
  h: number
  cover: number
  NEd: number
  M01: number
  M02: number
  l0: number
  phiLong?: number
  phiTie?: number
  tieSpacing?: number
  AsProv?: number
  creepPhi?: number
  rm?: number
  exposure?: ExposureClass
  deltaCdev?: number
}

export type SlabInput = EC2MaterialInput & {
  h: number
  cover: number
  MEdPerM: number
  VEdPerM?: number
  span: number
  phi?: number
  spacing?: number
  MserPerM?: number
  exposure?: ExposureClass
  deltaCdev?: number
}

export type PunchingInput = EC2MaterialInput & {
  c1: number
  c2: number
  h: number
  cover: number
  phi?: number
  VEd: number
  rhoL?: number
  beta?: number
  sigmaCp?: number
}

export type FootingInput = EC2MaterialInput & {
  B: number
  L: number
  h: number
  cover: number
  colB: number
  colL: number
  NEd: number
  phi?: number
  qEd?: number
}

export type ExposureClass = 'X0'|'XC1'|'XC2'|'XC3'|'XC4'|'XD1'|'XD2'|'XD3'|'XS1'|'XS2'|'XS3'

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))

export function concreteProps(fck:number, alphaCC=0.85, gammaC=1.5){
  const fcm=fck+8
  const fctm=fck<=50 ? 0.3*Math.pow(fck,2/3) : 2.12*Math.log(1+fcm/10)
  const fctk005=0.7*fctm
  const fcd=alphaCC*fck/gammaC
  const fctd=fctk005/gammaC
  const Ecm=22*Math.pow(fcm/10,0.3)*1000
  const epsC2=fck<=50?2:2+0.085*Math.pow(fck-50,0.53)
  const epsCu2=fck<=50?3.5:2.6+35*Math.pow((90-fck)/100,4)
  const lambda=fck<=50?0.8:0.8-(fck-50)/400
  const eta=fck<=50?1:1-(fck-50)/200
  const nu1=0.6*(1-fck/250)
  return {fcm,fctm,fctk005,fcd,fctd,Ecm,epsC2,epsCu2,lambda,eta,nu1}
}

export function steelProps(fyk:number,gammaS=1.15){
  const fyd=fyk/gammaS
  const Es=200000
  const epsYd=fyd/Es
  return {fyd,Es,epsYd}
}

export function effectiveDepth(h:number,cover:number,phiSt=8,phiLong=16){return h-cover-phiSt-phiLong/2}

export function minLongitudinalSpacing(phi:number,dg=20){return Math.max(phi,dg+5,20)}

export function durabilityCover(exposure:ExposureClass='XC2', structuralClass=4, deltaCdev=10, phi=16){
  const s4:Record<ExposureClass,number>={X0:10,XC1:15,XC2:25,XC3:25,XC4:30,XD1:35,XD2:40,XD3:45,XS1:35,XS2:40,XS3:45}
  // Approximate EC2 Table 4.4N structural-class shift: 5 mm per class from S4, bounded at 10 mm.
  const cminDur=Math.max(10,s4[exposure]+(structuralClass-4)*5)
  const cminB=phi
  const cmin=Math.max(cminDur,cminB,10)
  const cnom=cmin+deltaCdev
  return {cminDur,cminB,cmin,cnom,exposure,structuralClass}
}

function momentResistanceRect(b:number,d:number,As:number,fcd:number,fyd:number,lambda:number,eta:number){
  if(As<=0||b<=0||d<=0) return {x:0,z:0,MRd:0,xOverD:0}
  const x=As*fyd/(eta*fcd*b*lambda)
  const z=d-0.5*lambda*x
  const MRd=As*fyd*Math.max(z,0)/1e6
  return {x,z,MRd,xOverD:x/d}
}

function requiredAsForMoment(b:number,d:number,MEd:number,fcd:number,fyd:number,lambda:number,eta:number){
  const target=Math.abs(MEd)*1e6
  if(target<=0) return 0
  let lo=0,hi=b*d*0.08
  for(let i=0;i<100;i++){
    const mid=(lo+hi)/2
    const r=momentResistanceRect(b,d,mid,fcd,fyd,lambda,eta).MRd*1e6
    if(r>=target) hi=mid; else lo=mid
  }
  return hi
}

export function beamFlexure(input:BeamInput){
  const {b,h,cover,fck,fyk,MEd}=input
  const phiLong=input.phiLong??16, phiSt=input.phiSt??8
  const d=effectiveDepth(h,cover,phiSt,phiLong)
  const c=concreteProps(fck,input.alphaCC,input.gammaC)
  const s=steelProps(fyk,input.gammaS)
  const AsReq0=requiredAsForMoment(b,d,MEd,c.fcd,s.fyd,c.lambda,c.eta)
  const AsMin=Math.max(0.26*c.fctm/fyk*b*d,0.0013*b*d)
  const AsMax=0.04*b*h
  const AsReq=Math.max(AsReq0,AsMin)
  const AsProv=input.AsProv??AsReq
  const resist=momentResistanceRect(b,d,AsProv,c.fcd,s.fyd,c.lambda,c.eta)
  const check:EC2Check={id:'flexure',title:'ELU · Flexão',status:resist.MRd+1e-9>=Math.abs(MEd)?'OK':'FAIL',demand:Math.abs(MEd),resistance:resist.MRd,utilization:resist.MRd>0?Math.abs(MEd)/resist.MRd:Infinity,unit:'kNm',formula:'M_Rd = A_s f_yd z'}
  const minCheck:EC2Check={id:'asmin',title:'Armadura longitudinal mínima',status:AsProv>=AsMin?'OK':'FAIL',demand:AsMin,resistance:AsProv,utilization:AsProv>0?AsMin/AsProv:Infinity,unit:'mm²'}
  const maxCheck:EC2Check={id:'asmax',title:'Armadura longitudinal máxima',status:AsProv<=AsMax?'OK':'FAIL',demand:AsProv,resistance:AsMax,utilization:AsMax>0?AsProv/AsMax:Infinity,unit:'mm²'}
  return {d,...c,...s,AsReq0,AsMin,AsMax,AsReq,AsProv,...resist,checks:[check,minCheck,maxCheck]}
}

export function chooseBarsEC2(AsReq:number,b:number,cover:number,phiSt=8,dg=20){
  const phis=[8,10,12,14,16,20,25,32]
  const sols:{phi:number,n:number,area:number,clear:number,layers:number,status:EC2Status}[]=[]
  for(const phi of phis){
    for(let n=2;n<=12;n++){
      const area=n*Math.PI*phi*phi/4
      if(area+1e-6<AsReq) continue
      const available=b-2*(cover+phiSt)-2*phi/2
      const clear=n>1?(available-(n-1)*phi)/(n-1):available
      const minClear=minLongitudinalSpacing(phi,dg)
      if(clear>=minClear) sols.push({phi,n,area,clear,layers:1,status:'OK'})
      else {
        const perLayer=Math.max(2,Math.floor((b-2*(cover+phiSt)+minClear)/(phi+minClear)))
        const layers=Math.ceil(n/perLayer)
        if(layers<=3) sols.push({phi,n,area,clear,layers,status:'WARN'})
      }
    }
  }
  return sols.sort((a,b2)=>a.layers-b2.layers || a.area-b2.area || a.n-b2.n).slice(0,8)
}

export function beamShear(input:BeamInput, flex=beamFlexure(input)){
  const {b,fck,fyk,VEd}=input
  const d=flex.d,z=0.9*d
  const c=concreteProps(fck,input.alphaCC,input.gammaC), s=steelProps(fyk,input.gammaS)
  const rhoL=clamp(flex.AsProv/(b*d),0,0.02)
  const k=Math.min(2,1+Math.sqrt(200/d))
  const sigmaCp=0
  const C=0.18/(input.gammaC??1.5)
  const vmin=0.035*Math.pow(k,1.5)*Math.sqrt(fck)
  const vrdcStress=Math.max(C*k*Math.cbrt(100*rhoL*fck)+0.15*sigmaCp,vmin+0.15*sigmaCp)
  const VRdc=vrdcStress*b*d/1000
  const cotTheta=clamp(input.cotTheta??1,1,2.5)
  const tanTheta=1/cotTheta
  const alphaCw=1
  const VRdMax=alphaCw*b*z*c.nu1*c.fcd/(cotTheta+tanTheta)/1000
  const AswPerSReq=Math.abs(VEd)*1000/(z*s.fyd*cotTheta)
  const AswPerSMin=0.08*Math.sqrt(fck)/fyk*b
  const AswPerS=Math.max(AswPerSReq,AswPerSMin)
  const prov=input.AswPerSProv??AswPerS
  const VRds=prov*z*s.fyd*cotTheta/1000
  const checks:EC2Check[]=[
    {id:'vrdc',title:'ELU · Corte sem armadura transversal',status:Math.abs(VEd)<=VRdc?'OK':'WARN',demand:Math.abs(VEd),resistance:VRdc,utilization:VRdc>0?Math.abs(VEd)/VRdc:Infinity,unit:'kN'},
    {id:'vrdmax',title:'ELU · Bielas comprimidas (VRd,max)',status:Math.abs(VEd)<=VRdMax?'OK':'FAIL',demand:Math.abs(VEd),resistance:VRdMax,utilization:VRdMax>0?Math.abs(VEd)/VRdMax:Infinity,unit:'kN'},
    {id:'vrds',title:'ELU · Estribos (VRd,s)',status:Math.abs(VEd)<=VRds?'OK':'FAIL',demand:Math.abs(VEd),resistance:VRds,utilization:VRds>0?Math.abs(VEd)/VRds:Infinity,unit:'kN'},
    {id:'aswmin',title:'Armadura transversal mínima',status:prov>=AswPerSMin?'OK':'FAIL',demand:AswPerSMin,resistance:prov,utilization:prov>0?AswPerSMin/prov:Infinity,unit:'mm²/mm'}
  ]
  return {d,z,rhoL,k,vmin,vrdcStress,VRdc,VRdMax,cotTheta,AswPerSReq,AswPerSMin,AswPerS,AswPerSProv:prov,VRds,checks}
}

export function torsionCheck(input:BeamInput, flex=beamFlexure(input), shear=beamShear(input,flex)){
  const TEd=Math.abs(input.TEd??0)
  const {b,h,cover,fyk}=input
  const c=concreteProps(input.fck,input.alphaCC,input.gammaC), s=steelProps(fyk,input.gammaS)
  const tEff=Math.max(20,Math.min(b,h)/6)
  const bk=Math.max(10,b-2*(cover+tEff/2)), hk=Math.max(10,h-2*(cover+tEff/2))
  const Ak=bk*hk, uk=2*(bk+hk)
  const cotTheta=shear.cotTheta, tanTheta=1/cotTheta
  const TRdMax=2*c.nu1*c.fcd*Ak*tEff/(cotTheta+tanTheta)/1e6
  const AswPerS_T=TEd>0?TEd*1e6*uk/(2*Ak*s.fyd*cotTheta):0
  const Asl_T=TEd>0?TEd*1e6*uk*cotTheta/(2*Ak*s.fyd):0
  const interaction=(shear.VRdMax>0?Math.abs(input.VEd)/shear.VRdMax:0)+(TRdMax>0?TEd/TRdMax:0)
  const check:EC2Check={id:'torsion',title:'ELU · Torção / interação V+T',status:TEd===0?'NA':interaction<=1?'OK':'FAIL',demand:interaction,resistance:1,utilization:interaction,unit:'ratio',note:'Modelo de tubo de paredes finas para secção retangular maciça.'}
  return {TEd,tEff,Ak,uk,TRdMax,AswPerS_T,Asl_T,interaction,checks:[check]}
}

export function crackWidthCheck(input:BeamInput, flex=beamFlexure(input)){
  const Mser=Math.abs(input.Mser??0.7*input.MEd)
  const phi=input.phiBars??input.phiLong??16
  const As=flex.AsProv
  const cNom=input.cover
  const hceff=Math.min(2.5*(input.h-flex.d),(input.h-flex.x)/3,input.h/2)
  const Aceff=Math.max(input.b*hceff,1)
  const rho=As/Aceff
  const alphaE=flex.Es/flex.Ecm
  const z=Math.max(0.75*flex.d,flex.z)
  const sigmaS=As>0?Mser*1e6/(As*z):0
  const kt=0.4
  const k1=0.8,k2=0.5,k3=3.4,k4=0.425
  const srMax=k3*cNom+k1*k2*k4*phi/Math.max(rho,1e-6)
  const epsDiff=Math.max((sigmaS-kt*flex.fctm/Math.max(rho,1e-6)*(1+alphaE*rho))/flex.Es,0.6*sigmaS/flex.Es)
  const wk=srMax*Math.max(epsDiff,0)
  const wlim=0.3
  const check:EC2Check={id:'crack',title:'ELS · Abertura de fendas',status:wk<=wlim?'OK':'FAIL',demand:wk,resistance:wlim,utilization:wlim>0?wk/wlim:Infinity,unit:'mm',formula:'w_k = s_r,max (ε_sm-ε_cm)'}
  return {Mser,hceff,Aceff,rho,alphaE,sigmaS,srMax,epsDiff,wk,wlim,checks:[check]}
}

export function deflectionCheck(input:BeamInput, flex=beamFlexure(input)){
  const L=(input.span??5)*1000
  const Mqp=Math.abs(input.Mqp??0.5*input.MEd)*1e6
  const Ig=input.b*Math.pow(input.h,3)/12
  const W=input.b*Math.pow(input.h,2)/6
  const Mcr=flex.fctm*W
  const beta=0.5 // long-term/repeated loading
  const zeta=Mqp<=Mcr?0:clamp(1-beta*Math.pow(Mcr/Math.max(Mqp,1),2),0,1)
  const Icr=Math.max(0.25*Ig,input.b*Math.pow(flex.d,3)/12*0.35)
  const Ieff=1/((1-zeta)/Ig+zeta/Icr)
  const phiEff=2.0
  const Eeff=flex.Ecm/(1+phiEff)
  const delta=5*Mqp*Math.pow(L,2)/(48*Eeff*Ieff) // simply-supported equivalent curvature proxy
  const limit=L/250
  const check:EC2Check={id:'deflection',title:'ELS · Deformação',status:delta<=limit?'OK':'FAIL',demand:delta,resistance:limit,utilization:limit>0?delta/limit:Infinity,unit:'mm',note:'Estimativa por rigidez efetiva fissurada + fluência; usar análise global para geometrias complexas.'}
  return {L,Mqp,Ig,Icr,Ieff,Mcr,zeta,phiEff,Eeff,delta,limit,checks:[check]}
}


export function serviceStressCheck(input:BeamInput, flex=beamFlexure(input)){
  const Mser=Math.abs(input.Mser??0.7*input.MEd)*1e6
  const As=Math.max(flex.AsProv,1e-9)
  const alphaE=flex.Es/flex.Ecm
  // Secção retangular fissurada, armadura tracionada concentrada à profundidade d.
  const a=alphaE*As
  const x=(-a+Math.sqrt(a*a+2*input.b*a*flex.d))/input.b
  const Icr=input.b*Math.pow(x,3)/3+alphaE*As*Math.pow(flex.d-x,2)
  const sigmaC=Icr>0?Mser*x/Icr:Infinity
  const sigmaS=Icr>0?alphaE*Mser*(flex.d-x)/Icr:Infinity
  const sigmaCLim=0.60*input.fck
  const sigmaSLim=0.80*input.fyk
  const cCheck:EC2Check={id:'stress-c',title:'ELS · Tensão de compressão no betão',status:sigmaC<=sigmaCLim?'OK':'FAIL',demand:sigmaC,resistance:sigmaCLim,utilization:sigmaCLim>0?sigmaC/sigmaCLim:Infinity,unit:'MPa',note:'Verificação elástica fissurada; limite 0,60 fck para triagem da combinação de serviço.'}
  const sCheck:EC2Check={id:'stress-s',title:'ELS · Tensão no aço',status:sigmaS<=sigmaSLim?'OK':'WARN',demand:sigmaS,resistance:sigmaSLim,utilization:sigmaSLim>0?sigmaS/sigmaSLim:Infinity,unit:'MPa',note:'Triagem de tensão no aço; confirmar o limite aplicável à combinação e natureza da ação.'}
  return {Mser,alphaE,x,Icr,sigmaC,sigmaS,sigmaCLim,sigmaSLim,checks:[cCheck,sCheck]}
}

export function anchorageCheck(input:BeamInput, flex=beamFlexure(input)){
  const phi=input.phiAnchor??input.phiLong??16
  const eta1=input.goodBond===false?0.7:1
  const eta2=phi<=32?1:(132-phi)/100
  const fbd=2.25*eta1*eta2*flex.fctd
  const sigmaSd=flex.fyd
  const lbRqd=(phi/4)*(sigmaSd/fbd)
  const alpha=1
  const lbd=Math.max(alpha*lbRqd,0.3*lbRqd,10*phi,100)
  const rho1=25
  const alpha6=clamp(Math.sqrt(rho1/25),1,1.5)
  const l0=Math.max(alpha6*lbRqd,0.3*alpha6*lbRqd,15*phi,200)
  return {phi,eta1,eta2,fbd,sigmaSd,lbRqd,lbd,l0,checks:[
    {id:'anchor',title:'Pormenorização · Comprimento de amarração',status:'OK',demand:lbd,unit:'mm',note:'Comprimento de projeto calculado; geometria real da ancoragem deve caber na peça.'},
    {id:'lap',title:'Pormenorização · Emenda por sobreposição',status:'OK',demand:l0,unit:'mm',note:'Valor base para barras tracionadas; ajustar percentagem/posição real das emendas.'}
  ] as EC2Check[]}
}

export function spacingAndDetailing(input:BeamInput, flex=beamFlexure(input)){
  const phi=input.phiBars??input.phiLong??16
  const n=input.nBars??4
  const dg=input.dg??20
  const minClear=minLongitudinalSpacing(phi,dg)
  const clear=(input.b-2*(input.cover+(input.phiStProv??8))-n*phi)/Math.max(1,n-1)
  const stirrupSpacing=input.stirrupSpacing??150
  const smaxShear=Math.min(0.75*flex.d,600)
  return {phi,n,dg,minClear,clear,stirrupSpacing,smaxShear,checks:[
    {id:'clear-spacing',title:'Pormenorização · Espaçamento livre longitudinal',status:clear>=minClear?'OK':'FAIL',demand:minClear,resistance:clear,utilization:clear>0?minClear/clear:Infinity,unit:'mm'},
    {id:'stirrup-spacing',title:'Pormenorização · Espaçamento de estribos',status:stirrupSpacing<=smaxShear?'OK':'FAIL',demand:stirrupSpacing,resistance:smaxShear,utilization:smaxShear>0?stirrupSpacing/smaxShear:Infinity,unit:'mm'}
  ] as EC2Check[]}
}

export function beamEC2(input:BeamInput){
  const flex=beamFlexure(input)
  const shear=beamShear(input,flex)
  const torsion=torsionCheck(input,flex,shear)
  const crack=crackWidthCheck(input,flex)
  const deflection=deflectionCheck(input,flex)
  const stresses=serviceStressCheck(input,flex)
  const anchorage=anchorageCheck(input,flex)
  const detailing=spacingAndDetailing(input,flex)
  const dur=durabilityCover(input.exposure??'XC2',input.structuralClass??4,input.deltaCdev??10,input.phiLong??16)
  const coverCheck:EC2Check={id:'cover',title:'Durabilidade · Recobrimento nominal',status:input.cover>=dur.cnom?'OK':'FAIL',demand:dur.cnom,resistance:input.cover,utilization:input.cover>0?dur.cnom/input.cover:Infinity,unit:'mm'}
  const checks=[...flex.checks,...shear.checks,...torsion.checks,...crack.checks,...deflection.checks,...stresses.checks,coverCheck,...anchorage.checks,...detailing.checks]
  return {flex,shear,torsion,crack,deflection,stresses,dur,anchorage,detailing,checks}
}

export function columnEC2(input:ColumnInput){
  const c=concreteProps(input.fck,input.alphaCC,input.gammaC), s=steelProps(input.fyk,input.gammaS)
  const Ac=input.b*input.h
  const d=effectiveDepth(input.h,input.cover,input.phiTie??8,input.phiLong??16)
  const i=input.h/Math.sqrt(12)
  const lambda=input.l0*1000/i
  const M02=Math.max(Math.abs(input.M01),Math.abs(input.M02))
  const M01=Math.min(Math.abs(input.M01),Math.abs(input.M02))
  const M0e=Math.max(0.6*M02+0.4*M01,0.4*M02)
  const M0min=Math.abs(input.NEd)*Math.max(input.h/30/1000,0.02)
  const n=Math.abs(input.NEd)*1000/(Ac*c.fcd)
  const AsMin=Math.max(0.10*Math.abs(input.NEd)*1000/s.fyd,0.002*Ac)
  const AsMax=0.04*Ac
  const AsProv=input.AsProv??AsMin
  const omega=AsProv*s.fyd/(Ac*c.fcd)
  const A=1/(1+0.2*(input.creepPhi??2))
  const B=Math.sqrt(1+2*omega)
  const rm=input.rm??0
  const C=1.7-rm
  const lambdaLim=n>0?20*A*B*C/Math.sqrt(n):Infinity
  const secondOrderRequired=lambda>lambdaLim
  const epsYd=s.epsYd
  const r0=epsYd/(0.45*d)
  const Kr=clamp((1+omega-n)/(Math.max(0.1,1+omega-0.4)),0.4,1)
  const beta=clamp(0.35+input.fck/200-lambda/150,0,1)
  const Kphi=Math.max(1+beta*(input.creepPhi??2),1)
  const curvature=Kr*Kphi*r0
  const e2=secondOrderRequired?curvature*Math.pow(input.l0*1000,2)/10:0
  const M2=Math.abs(input.NEd)*e2/1000
  const MEd=Math.max(M0e+M2,M02,M0min)
  const NRd0=(c.fcd*(Ac-AsProv)+s.fyd*AsProv)/1000
  const axialUtil=NRd0>0?Math.abs(input.NEd)/NRd0:Infinity
  // Interação N-M conservadora para disposição simétrica: metade da armadura total é tomada na face tracionada.
  // O módulo de diagrama de interação por compatibilidade de deformações será a referência para casos biaxiais/especiais.
  const mApprox=momentResistanceRect(input.b,d,Math.max(AsProv/2,1e-9),c.fcd,s.fyd,c.lambda,c.eta).MRd
  const momentUtil=mApprox>0?MEd/mApprox:Infinity
  const interaction=axialUtil+momentUtil
  const phiLong=input.phiLong??16, phiTie=input.phiTie??8
  const tieMinDia=Math.max(6,0.25*phiLong)
  const tieMaxSpacing=Math.min(20*phiLong,Math.min(input.b,input.h),400)
  const tieSpacing=input.tieSpacing??Math.min(200,tieMaxSpacing)
  const checks:EC2Check[]=[
    {id:'column-axial',title:'Pilar · Resistência axial de referência',status:axialUtil<=1?'OK':'FAIL',demand:Math.abs(input.NEd),resistance:NRd0,utilization:axialUtil,unit:'kN'},
    {id:'column-nm',title:'Pilar · Interação N-M (triagem conservadora)',status:interaction<=1?'OK':'WARN',demand:interaction,resistance:1,utilization:interaction,unit:'ratio',note:'Triagem N/NRd + M/MRd; confirmar por diagrama de interação nos casos críticos/biaxiais.'},
    {id:'column-tie-dia',title:'Pilar · Diâmetro mínimo das cintas',status:phiTie>=tieMinDia?'OK':'FAIL',demand:tieMinDia,resistance:phiTie,unit:'mm'},
    {id:'column-tie-space',title:'Pilar · Espaçamento máximo das cintas',status:tieSpacing<=tieMaxSpacing?'OK':'FAIL',demand:tieSpacing,resistance:tieMaxSpacing,utilization:tieMaxSpacing>0?tieSpacing/tieMaxSpacing:Infinity,unit:'mm'},
    {id:'column-asmin',title:'Pilar · Armadura mínima',status:AsProv>=AsMin?'OK':'FAIL',demand:AsMin,resistance:AsProv,unit:'mm²'},
    {id:'column-asmax',title:'Pilar · Armadura máxima',status:AsProv<=AsMax?'OK':'FAIL',demand:AsProv,resistance:AsMax,unit:'mm²'},
    {id:'column-slender',title:'Pilar · Esbelteza / 2.ª ordem',status:secondOrderRequired?'WARN':'OK',demand:lambda,resistance:lambdaLim,utilization:lambdaLim>0?lambda/lambdaLim:0,unit:'',note:secondOrderRequired?'Incluído M2 pelo método da curvatura nominal.':'Efeitos de 2.ª ordem dispensáveis pelo critério de esbelteza.'},
    {id:'column-minmom',title:'Pilar · Momento mínimo',status:MEd>=M0min?'OK':'FAIL',demand:M0min,resistance:MEd,unit:'kNm'}
  ]
  return {Ac,d,i,lambda,M01,M02,M0e,M0min,n,AsMin,AsMax,AsProv,omega,A,B,C,lambdaLim,secondOrderRequired,Kr,beta,Kphi,curvature,e2,M2,MEd,NRd0,MRdApprox:mApprox,axialUtil,momentUtil,interaction,phiLong,phiTie,tieMinDia,tieMaxSpacing,tieSpacing,checks}
}

export function biaxialColumnCheck(MEdy:number,MRdy:number,MEdz:number,MRdz:number,NEd:number,NRd:number){
  const ratioN=NRd>0?Math.abs(NEd)/NRd:1
  const a=clamp(1+ratioN,1,2)
  const util=Math.pow(Math.abs(MEdy)/Math.max(MRdy,1e-9),a)+Math.pow(Math.abs(MEdz)/Math.max(MRdz,1e-9),a)
  return {a,util,check:{id:'biaxial',title:'Pilar · Flexão biaxial',status:util<=1?'OK':'FAIL',demand:util,resistance:1,utilization:util,unit:'ratio'} as EC2Check}
}

export function slabEC2(input:SlabInput){
  const beam:BeamInput={...input,b:1000,MEd:input.MEdPerM,VEd:input.VEdPerM??0,Mser:input.MserPerM??0.7*input.MEdPerM,span:input.span,phiLong:input.phi??12,phiSt:0,phiBars:input.phi??12,nBars:Math.max(2,Math.round(1000/(input.spacing??150))),cover:input.cover}
  const design=beamEC2(beam)
  const sMain=input.spacing??150
  const sMax=Math.min(3*input.h,400)
  const spacingCheck:EC2Check={id:'slab-spacing',title:'Laje · Espaçamento armadura principal',status:sMain<=sMax?'OK':'FAIL',demand:sMain,resistance:sMax,unit:'mm',utilization:sMain/sMax}
  return {...design,sMain,sMax,checks:[...design.checks,spacingCheck]}
}

export function punchingEC2(input:PunchingInput){
  const c=concreteProps(input.fck,input.alphaCC,input.gammaC)
  const d=effectiveDepth(input.h,input.cover,0,input.phi??12)
  const u1=2*(input.c1+input.c2)+4*Math.PI*d
  const beta=input.beta??1.15
  const vEd=beta*Math.abs(input.VEd)*1000/(u1*d)
  const rho=clamp(input.rhoL??0.005,0,0.02)
  const k=Math.min(2,1+Math.sqrt(200/d))
  const C=0.18/(input.gammaC??1.5)
  const vmin=0.035*Math.pow(k,1.5)*Math.sqrt(input.fck)
  const vRdc=Math.max(C*k*Math.cbrt(100*rho*input.fck)+0.1*(input.sigmaCp??0),vmin+0.1*(input.sigmaCp??0))
  const vRdmax=0.5*c.nu1*c.fcd
  const check:EC2Check={id:'punch',title:'ELU · Punçoamento em u1',status:vEd<=vRdc?'OK':vEd<=vRdmax?'WARN':'FAIL',demand:vEd,resistance:vRdc,utilization:vRdc>0?vEd/vRdc:Infinity,unit:'MPa',note:vEd>vRdc&&vEd<=vRdmax?'Necessária armadura de punçoamento.':undefined}
  return {d,u1,beta,vEd,rho,k,vRdc,vRdmax,checks:[check]}
}

export function footingEC2(input:FootingInput){
  const area=input.B*input.L
  const qEd=input.qEd??Math.abs(input.NEd)/area
  const ax=(input.B-input.colB)/2, ay=(input.L-input.colL)/2
  const Mx=qEd*input.L*ax*ax/2
  const My=qEd*input.B*ay*ay/2
  const slabX=slabEC2({...input,h:input.h,cover:input.cover,MEdPerM:Mx/input.L,span:ax,phi:input.phi??16,spacing:150})
  const slabY=slabEC2({...input,h:input.h,cover:input.cover,MEdPerM:My/input.B,span:ay,phi:input.phi??16,spacing:150})
  const punch=punchingEC2({...input,c1:input.colB*1000,c2:input.colL*1000,h:input.h,cover:input.cover,VEd:Math.abs(input.NEd),phi:input.phi??16})
  return {area,qEd,ax,ay,Mx,My,slabX,slabY,punch,checks:[...slabX.checks,...slabY.checks,...punch.checks]}
}

export function fatigueQuickCheck(deltaSigmaS:number,limitS=175,deltaSigmaC?:number,limitC?:number){
  const steel:EC2Check={id:'fatigue-steel',title:'Fadiga · Variação de tensão no aço',status:deltaSigmaS<=limitS?'OK':'FAIL',demand:deltaSigmaS,resistance:limitS,utilization:deltaSigmaS/limitS,unit:'MPa',note:'Verificação simplificada; detalhes soldados, ciclos e curvas S-N específicas exigem parâmetros adicionais.'}
  const concrete:EC2Check|undefined=deltaSigmaC!==undefined&&limitC!==undefined?{id:'fatigue-concrete',title:'Fadiga · Betão',status:deltaSigmaC<=limitC?'OK':'FAIL',demand:deltaSigmaC,resistance:limitC,utilization:deltaSigmaC/limitC,unit:'MPa'}:undefined
  return {checks:concrete?[steel,concrete]:[steel]}
}

export function firePrecheck(element:'beam'|'slab'|'column',R:30|60|90|120,b:number,h:number,axisDistance:number){
  // Conservative quick-screen values. Final fire design requires EN 1992-1-2 thermal/mechanical verification or exact tabular method.
  const beam:Record<number,[number,number]>={30:[120,25],60:[160,35],90:[200,45],120:[240,55]}
  const slab:Record<number,[number,number]>={30:[60,10],60:[80,20],90:[100,30],120:[120,40]}
  const column:Record<number,[number,number]>={30:[200,25],60:[250,35],90:[300,45],120:[350,55]}
  const t=element==='beam'?beam[R]:element==='slab'?slab[R]:column[R]
  const minDim=element==='slab'?h:Math.min(b,h)
  const ok=minDim>=t[0]&&axisDistance>=t[1]
  return {minDimReq:t[0],axisReq:t[1],check:{id:'fire',title:`Incêndio · Pré-verificação R${R}`,status:ok?'OK':'WARN',demand:minDim,resistance:t[0],unit:'mm',note:'Triagem conservadora. Confirmar pela EN 1992-1-2 com o caso estrutural, nível de carga e configuração real.'} as EC2Check}
}

export type StirrupSolution = {phi:number;legs:number;spacing:number;AswPerS:number;utilization:number}

/** Seleciona uma disposição prática de estribos que satisfaça Asw/s e smax. */
export function chooseStirrupsEC2(AswPerSReq:number,d:number){
  const phis=[6,8,10,12]
  const legs=[2,4]
  const spacings=[300,250,225,200,175,150,125,100,75]
  const smax=Math.min(0.75*d,600)
  const out:StirrupSolution[]=[]
  for(const phi of phis) for(const nLegs of legs) for(const spacing of spacings){
    if(spacing>smax+1e-9) continue
    const Asw=nLegs*Math.PI*phi*phi/4
    const AswPerS=Asw/spacing
    if(AswPerS+1e-12>=AswPerSReq){
      out.push({phi,legs:nLegs,spacing,AswPerS,utilization:AswPerSReq/AswPerS})
    }
  }
  return out.sort((a,b)=>a.AswPerS-b.AswPerS || b.spacing-a.spacing || a.phi-b.phi).slice(0,8)
}

export type ColumnBarSolution = {phi:number;n:number;area:number;clearX:number;status:EC2Status}

/** Seleção esquemática de armadura longitudinal simétrica para pilares retangulares. */
export function chooseColumnBarsEC2(AsReq:number,b:number,h:number,cover:number,phiTie=8,dg=20){
  const phis=[12,14,16,20,25,32]
  const counts=[4,6,8,10,12,16]
  const out:ColumnBarSolution[]=[]
  for(const phi of phis) for(const n of counts){
    const area=n*Math.PI*phi*phi/4
    if(area+1e-9<AsReq) continue
    const barsOnFace=Math.max(2,Math.ceil(n/4)+1)
    const clearX=(b-2*(cover+phiTie)-2*phi)/(Math.max(1,barsOnFace-1))
    const minClear=minLongitudinalSpacing(phi,dg)
    out.push({phi,n,area,clearX,status:clearX>=minClear?'OK':'WARN'})
  }
  return out.sort((a,b2)=>(a.status==='OK'?0:1)-(b2.status==='OK'?0:1) || a.area-b2.area || a.n-b2.n).slice(0,8)
}
