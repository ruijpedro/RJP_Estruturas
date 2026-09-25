import {ChangeEvent,useEffect,useMemo,useState} from 'react'
import {FrameResult,MemberLoad,MemberLoadType,MemberResult,Model2D,Node2D,solveFrame} from './structural'
import {
  beamEC2,chooseBarsEC2,chooseColumnBarsEC2,chooseStirrupsEC2,columnEC2,concreteProps,EC2Check,
  ExposureClass,firePrecheck,footingEC2,slabEC2,punchingEC2,fatigueQuickCheck
} from './ec2'

type Mode='Viga'|'Pórtico 2D'|'Treliça 2D'
type Tab='Modelo'|'Cargas'|'Resultados'|'EC2'|'Pormenorização'|'Relatório'|'Definições'
type AnalysisState={ok:true;data:FrameResult}|{ok:false;error:string}
type Tool='Selecionar'|'Nó'|'Barra'|'Apoio'|'Carga'|'Mover'|'Apagar'
type CanvasResult='Deformada'|'N'|'V'|'M'
type StartPreset='Padrão'|'Em branco'|'Apoios'|'Barra'|'Barra + nós'|'Nós'

type Settings={
  fck:number; fyk:number; cover:number; exposure:ExposureClass; cotTheta:number;
  beamSpan:number; beamQ:number; beamP:number; beamB:number; beamH:number;
  frameWidth:number; frameHeight:number; frameQ:number; frameHLoad:number; colB:number; colH:number;
  trussSpan:number; trussHeight:number; trussP:number; trussA:number;
}

type LoadComponent='fx'|'fy'|'mz'
type SupportOverride={nodeId:number;fixX:boolean;fixY:boolean;fixR:boolean}
type NodalLoadOverride={nodeId:number;fx:number;fy:number;mz:number}
type DistributedLoadOverride={elementId:number;qy:number}
type ModelEdits={
  removedSupports:number[]
  removedNodalLoads:{nodeId:number;component:LoadComponent}[]
  removedDistributedLoads:number[]
  supportOverrides:SupportOverride[]
  nodalLoadOverrides:NodalLoadOverride[]
  distributedLoadOverrides:DistributedLoadOverride[]
}
type EditsByMode=Record<Mode,ModelEdits>
type UiSettings={fontScale:number;canvasTextScale:number;highContrast:boolean;largeTargets:boolean}
type BarDraft={x:number;y:number;nodeId?:number}|null
type EditorDialog={kind:'support';nodeId:number}|{kind:'nodal';nodeId:number}|{kind:'member';elementId:number;loadId?:string}|null
type NodalForm={fx:number;fy:number;mz:number}
type MemberForm={type:MemberLoadType;axis:'localY'|'localX';P:number;M:number;x:number;x1:number;x2:number;q1:number;q2:number}
type ProjectFile={version:string;mode:Mode;settings:Settings;projectName?:string;edits?:EditsByMode;ui?:UiSettings;customModels?:Partial<Record<Mode,Model2D>>;showNodes?:boolean;savedAt?:string}

type RebarRow={mark:string;description:string;phi:number;qty:number;lengthM:number;weightKg:number}
type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed';platform:string}>}

function emptyModelEdits():ModelEdits{return {removedSupports:[],removedNodalLoads:[],removedDistributedLoads:[],supportOverrides:[],nodalLoadOverrides:[],distributedLoadOverrides:[]}}
function emptyEditsByMode():EditsByMode{return {'Viga':emptyModelEdits(),'Pórtico 2D':emptyModelEdits(),'Treliça 2D':emptyModelEdits()}}
function normalizeModelEdits(v?:Partial<ModelEdits>):ModelEdits{
  return {
    removedSupports:v?.removedSupports??[],
    removedNodalLoads:v?.removedNodalLoads??[],
    removedDistributedLoads:v?.removedDistributedLoads??[],
    supportOverrides:v?.supportOverrides??[],
    nodalLoadOverrides:v?.nodalLoadOverrides??[],
    distributedLoadOverrides:v?.distributedLoadOverrides??[]
  }
}
function applyModelEdits(base:Model2D,edits:ModelEdits):Model2D{
  const supportSet=new Set(edits.removedSupports)
  const nodalSet=new Set(edits.removedNodalLoads.map(x=>`${x.nodeId}:${x.component}`))
  const distSet=new Set(edits.removedDistributedLoads)
  const supportMap=new Map(edits.supportOverrides.map(x=>[x.nodeId,x]))
  const nodalMap=new Map(edits.nodalLoadOverrides.map(x=>[x.nodeId,x]))
  const distMap=new Map(edits.distributedLoadOverrides.map(x=>[x.elementId,x.qy]))
  return {
    nodes:base.nodes.map(n=>{
      const out={...n}
      const support=supportMap.get(n.id)
      if(support){out.fixX=support.fixX;out.fixY=support.fixY;out.fixR=support.fixR}
      const load=nodalMap.get(n.id)
      if(load){out.fx=load.fx;out.fy=load.fy;out.mz=load.mz}
      if(supportSet.has(n.id)){out.fixX=false;out.fixY=false;out.fixR=false}
      if(nodalSet.has(`${n.id}:fx`))out.fx=0
      if(nodalSet.has(`${n.id}:fy`))out.fy=0
      if(nodalSet.has(`${n.id}:mz`))out.mz=0
      return out
    }),
    elements:base.elements.map(e=>{
      const overridden=distMap.has(e.id)?{...e,qy:distMap.get(e.id)}:{...e}
      return distSet.has(e.id)?{...overridden,qy:0}:overridden
    })
  }
}

const DEFAULT_SETTINGS:Settings={
  fck:30,fyk:500,cover:35,exposure:'XC2',cotTheta:1,
  beamSpan:6,beamQ:8,beamP:25,beamB:300,beamH:500,
  frameWidth:5,frameHeight:3,frameQ:10,frameHLoad:12,colB:300,colH:300,
  trussSpan:6,trussHeight:3,trussP:20,trussA:2500
}
const DEFAULT_UI:UiSettings={fontScale:1,canvasTextScale:1,highContrast:false,largeTargets:false}

function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}
function fmt(v:number|undefined,d=2){return v!==undefined&&Number.isFinite(v)?v.toFixed(d):'—'}
function statusLabel(s:EC2Check['status']){return s==='OK'?'✓ CUMPRE':s==='FAIL'?'✕ NÃO CUMPRE':s==='WARN'?'⚠ VERIFICAR':'— NÃO VERIFICADO'}
function maxAbs(values:number[]){return values.reduce((m,v)=>Math.max(m,Math.abs(v)),0)}
function kgPerM(phi:number){return phi*phi/162}
function barWeight(phi:number,qty:number,lengthM:number){return kgPerM(phi)*qty*lengthM}

function criticalSample(member:MemberResult|undefined,key:'N'|'V'|'M'){
  if(!member?.samples.length) return {value:0,x:0}
  return member.samples.reduce((best,s)=>Math.abs(s[key])>Math.abs(best.value)?{value:s[key],x:s.x}:best,{value:member.samples[0][key],x:member.samples[0].x})
}

function momentExtrema(member:MemberResult|undefined){
  if(!member?.samples.length) return {positive:0,negative:0}
  let positive=0,negative=0
  for(const s of member.samples){
    positive=Math.max(positive,s.M)
    negative=Math.max(negative,-s.M)
  }
  return {positive:positive/1e6,negative:negative/1e6}
}

function makeModel(mode:Mode,s:Settings):Model2D{
  const Erc=concreteProps(s.fck).Ecm
  const beamSection={b:s.beamB,h:s.beamH,cover:s.cover,fck:s.fck,fyk:s.fyk}
  const colSection={b:s.colB,h:s.colH,cover:s.cover,fck:s.fck,fyk:s.fyk}
  if(mode==='Viga'){
    const L=Math.max(1,s.beamSpan)
    return {
      nodes:[
        {id:1,x:0,y:0,fixX:true,fixY:true},
        {id:2,x:L/2,y:0,fy:-Math.abs(s.beamP)},
        {id:3,x:L,y:0,fixY:true}
      ],
      elements:[
        {id:1,n1:1,n2:2,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,loads:[{id:'q1',type:'uniform',axis:'localY',x1:0,x2:L/2,q1:-Math.abs(s.beamQ),q2:-Math.abs(s.beamQ),label:'q'}],section:beamSection},
        {id:2,n1:2,n2:3,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,loads:[{id:'q2',type:'uniform',axis:'localY',x1:0,x2:L/2,q1:-Math.abs(s.beamQ),q2:-Math.abs(s.beamQ),label:'q'}],section:beamSection}
      ]
    }
  }
  if(mode==='Pórtico 2D'){
    const W=Math.max(1,s.frameWidth),H=Math.max(1,s.frameHeight)
    return {
      nodes:[
        {id:1,x:0,y:0,fixX:true,fixY:true,fixR:true},
        {id:2,x:0,y:H},
        {id:3,x:W,y:H,fx:Math.abs(s.frameHLoad)},
        {id:4,x:W,y:0,fixX:true,fixY:true,fixR:true}
      ],
      elements:[
        {id:1,n1:1,n2:2,E:Erc,A:s.colB*s.colH,I:s.colB*s.colH**3/12,section:colSection},
        {id:2,n1:2,n2:3,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,loads:[{id:'qf',type:'uniform',axis:'localY',x1:0,x2:W,q1:-Math.abs(s.frameQ),q2:-Math.abs(s.frameQ),label:'q'}],section:beamSection},
        {id:3,n1:3,n2:4,E:Erc,A:s.colB*s.colH,I:s.colB*s.colH**3/12,section:colSection}
      ]
    }
  }
  const L=Math.max(1,s.trussSpan),H=Math.max(.5,s.trussHeight)
  const ESteel=210_000
  return {
    nodes:[
      {id:1,x:0,y:0,fixX:true,fixY:true},
      {id:2,x:L/2,y:H,fy:-Math.abs(s.trussP)},
      {id:3,x:L,y:0,fixY:true},
      {id:4,x:L/2,y:0}
    ],
    elements:[
      {id:1,n1:1,n2:2,E:ESteel,A:s.trussA,I:0,kind:'truss'},
      {id:2,n1:2,n2:3,E:ESteel,A:s.trussA,I:0,kind:'truss'},
      {id:3,n1:1,n2:4,E:ESteel,A:s.trussA,I:0,kind:'truss'},
      {id:4,n1:4,n2:3,E:ESteel,A:s.trussA,I:0,kind:'truss'},
      {id:5,n1:2,n2:4,E:ESteel,A:s.trussA,I:0,kind:'truss'}
    ]
  }
}

function starterModel(mode:Mode,preset:StartPreset,s:Settings):Model2D|null{
  if(preset==='Padrão')return null
  if(preset==='Em branco')return {nodes:[],elements:[]}
  const Erc=concreteProps(s.fck).Ecm
  const beamSection={b:s.beamB,h:s.beamH,cover:s.cover,fck:s.fck,fyk:s.fyk}
  const L=mode==='Pórtico 2D'?Math.max(1,s.frameWidth):mode==='Treliça 2D'?Math.max(1,s.trussSpan):Math.max(1,s.beamSpan)
  if(preset==='Apoios')return {nodes:[{id:1,x:0,y:0,fixX:true,fixY:true},{id:2,x:L,y:0,fixY:true}],elements:[]}
  if(preset==='Nós')return {nodes:[{id:1,x:0,y:2},{id:2,x:L,y:2}],elements:[]}
  const nodes:Node2D[]=[{id:1,x:0,y:2},{id:2,x:L,y:2}]
  if(mode==='Treliça 2D')return {nodes,elements:[{id:1,n1:1,n2:2,E:210000,A:s.trussA,I:0,kind:'truss'}]}
  return {nodes,elements:[{id:1,n1:1,n2:2,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,kind:'frame',releaseStartR:false,releaseEndR:false,section:beamSection}]}
}

function applyCurrentElementProperties(base:Model2D,mode:Mode,s:Settings):Model2D{
  if(!base.elements.length)return base
  const Erc=concreteProps(s.fck).Ecm
  const nodeMap=new Map(base.nodes.map(n=>[n.id,n]))
  return {nodes:base.nodes.map(n=>({...n})),elements:base.elements.map(e=>{
    if((e.kind??(mode==='Treliça 2D'?'truss':'frame'))==='truss')return {...e,kind:'truss' as const,E:210000,A:s.trussA,I:0,section:undefined}
    const a=nodeMap.get(e.n1),b=nodeMap.get(e.n2)
    const vertical=mode==='Pórtico 2D'&&!!(a&&b&&Math.abs(b.y-a.y)>Math.abs(b.x-a.x)*1.2)
    const bw=vertical?s.colB:s.beamB,hh=vertical?s.colH:s.beamH
    return {...e,kind:'frame' as const,E:Erc,A:bw*hh,I:bw*hh**3/12,section:{b:bw,h:hh,cover:s.cover,fck:s.fck,fyk:s.fyk}}
  })}
}

function cloneModel(m:Model2D):Model2D{return {nodes:m.nodes.map(n=>({...n})),elements:m.elements.map(e=>({...e,loads:e.loads?.map(l=>({...l})),section:e.section?{...e.section}:undefined}))}}

function NumInput({label,value,onChange,unit,step=1,min}:{label:string;value:number;onChange:(v:number)=>void;unit?:string;step?:number;min?:number}){
  return <label className="field"><span>{label}</span><div><input type="number" value={Number.isFinite(value)?value:''} step={step} min={min} onChange={(e:ChangeEvent<HTMLInputElement>)=>{const n=Number(e.target.value);if(Number.isFinite(n))onChange(min!==undefined?Math.max(min,n):n)}}/>{unit&&<small>{unit}</small>}</div></label>
}

function actionTypeName(t:MemberLoadType){return t==='uniform'?'Distribuída uniforme':t==='triangular'?'Triangular':t==='trapezoidal'?'Trapezoidal':t==='point'?'Concentrada':'Momento'}
function actionSummary(l:MemberLoad){
  if(l.type==='point')return `${actionTypeName(l.type)} ${l.axis==='localX'?'axial':'transversal'} · P=${fmt(l.P)} kN · x=${fmt(l.x)} m`
  if(l.type==='moment')return `Momento · M=${fmt(l.M)} kNm · x=${fmt(l.x)} m`
  return `${actionTypeName(l.type)} · q1=${fmt(l.q1)} · q2=${fmt(l.q2)} kN/m · ${fmt(l.x1)}–${fmt(l.x2)} m`
}
function displayLoads(e:any,L:number):MemberLoad[]{
  const arr=(e.loads??[]).map((l:MemberLoad)=>({...l}))
  if(e.qy!==undefined&&Math.abs(e.qy)>1e-12&&!arr.some((l:MemberLoad)=>l.id==='legacy-qy'))arr.unshift({id:'legacy-qy',type:'uniform',axis:'localY',x1:0,x2:L,q1:e.qy,q2:e.qy,label:'q'})
  return arr
}

function ModelView({model,result,selected,setSelected,diagram,zoom,setZoom,showGrid,showLabels,showLoads,showNodes,tool,barDraft,onCanvasPoint,onDeleteSupport,onDeleteNodalLoad,onDeleteMemberLoad,onOpenSupport,onOpenNodalLoad,onOpenMemberLoad,onDeleteElement,onDeleteNode,onMoveNode}:{model:Model2D,result:FrameResult|null,selected:number,setSelected:(n:number)=>void,diagram:CanvasResult,zoom:number,setZoom:(z:number)=>void,showGrid:boolean,showLabels:boolean,showLoads:boolean,showNodes:boolean,tool:Tool,barDraft:BarDraft,onCanvasPoint:(x:number,y:number)=>void,onDeleteSupport:(nodeId:number)=>void,onDeleteNodalLoad:(nodeId:number,component:LoadComponent)=>void,onDeleteMemberLoad:(elementId:number,loadId:string)=>void,onOpenSupport:(nodeId:number)=>void,onOpenNodalLoad:(nodeId:number)=>void,onOpenMemberLoad:(elementId:number,loadId?:string)=>void,onDeleteElement:(elementId:number)=>void,onDeleteNode:(nodeId:number)=>void,onMoveNode:(nodeId:number,x:number,y:number)=>void}){
  const [hoverWorld,setHoverWorld]=useState<{x:number;y:number}|null>(null)
  const [dragNodeId,setDragNodeId]=useState<number|null>(null)
  const xs=model.nodes.map(n=>n.x),ys=model.nodes.map(n=>n.y)
  const rawMinX=xs.length?Math.min(...xs):0,rawMaxX=xs.length?Math.max(...xs):10,rawMinY=ys.length?Math.min(...ys):0,rawMaxY=ys.length?Math.max(...ys):6
  // Janela base estável: evita que o desenho salte enquanto se move um nó ou se desenha uma barra.
  const minX=Math.min(-1,rawMinX-1),maxX=Math.max(11,rawMaxX+1),minY=Math.min(-2,rawMinY-1),maxY=Math.max(6,rawMaxY+1)
  const spanX=maxX-minX,spanY=maxY-minY
  const W=940,H=520,p=62,sx=(W-2*p)/spanX,sy=(H-2*p)/spanY,sc=Math.min(sx,sy)
  const P=(n:{x:number;y:number})=>({x:p+(n.x-minX)*sc,y:H-p-(n.y-minY)*sc})
  const nodeMap=new Map(model.nodes.map((n,i)=>[n.id,{n,i}]))
  const maxTrans=result?Math.max(0.001,...model.nodes.flatMap((_,i)=>[Math.abs(result.U[3*i]??0),Math.abs(result.U[3*i+1]??0)])):1
  const deformScale=result?Math.min(80,48/maxTrans):1
  const DP=(n:Node2D)=>{const base=P(n),i=nodeMap.get(n.id)!.i;return {x:base.x+((result?.U[3*i]??0)/1000)*sc*deformScale,y:base.y-((result?.U[3*i+1]??0)/1000)*sc*deformScale}}
  const selectedElement=model.elements.find(e=>e.id===selected),selectedResult=result?.members.find(m=>m.id===selected)
  let diagramPoints='',diagramMax=0
  if(result&&selectedElement&&selectedResult&&diagram!=='Deformada'&&selectedResult.samples.length>1){
    const na=nodeMap.get(selectedElement.n1)?.n,nb=nodeMap.get(selectedElement.n2)?.n
    if(na&&nb){const a=P(na),b=P(nb),dx=b.x-a.x,dy=b.y-a.y,Lpx=Math.hypot(dx,dy)||1,nx=-dy/Lpx,ny=dx/Lpx,vals=selectedResult.samples.map(sm=>sm[diagram]);diagramMax=Math.max(1,...vals.map(v=>Math.abs(v)));diagramPoints=selectedResult.samples.map(sm=>{const t=selectedResult.L>0?sm.x/selectedResult.L:0,baseX=a.x+dx*t,baseY=a.y+dy*t,off=(sm[diagram]/diagramMax)*72;return `${baseX+nx*off},${baseY+ny*off}`}).join(' ')}
  }
  const selectedUnit=diagram==='M'?'kNm':'kN',selectedFactor=diagram==='M'?1e6:1000,safeZoom=clamp(zoom,.7,2),vbW=W/safeZoom,vbH=H/safeZoom,vbX=(W-vbW)/2,vbY=(H-vbH)/2
  const pointFromEvent=(e:any)=>{const svg=e.currentTarget.closest?.('svg') as SVGSVGElement||e.currentTarget as SVGSVGElement,rect=svg.getBoundingClientRect(),ux=vbX+(e.clientX-rect.left)/Math.max(1,rect.width)*vbW,uy=vbY+(e.clientY-rect.top)/Math.max(1,rect.height)*vbH;return {x:Math.round((minX+(ux-p)/sc)*4)/4,y:Math.round((minY+(H-p-uy)/sc)*4)/4}}
  const canvasPointerDown=(e:any)=>{if(!['Nó','Barra','Apoio'].includes(tool))return;const pt=pointFromEvent(e);onCanvasPoint(pt.x,pt.y)}
  const canvasPointerMove=(e:any)=>{const pt=pointFromEvent(e);setHoverWorld(pt);if(dragNodeId!==null)onMoveNode(dragNodeId,pt.x,pt.y)}
  const loadGlyph=(e:any,a:{x:number;y:number},b:{x:number;y:number},L:number,l:MemberLoad,idx:number)=>{
    const dx=b.x-a.x,dy=b.y-a.y,Lpx=Math.hypot(dx,dy)||1,tx=dx/Lpx,ty=dy/Lpx,nx=-ty,ny=tx
    const pos=(xm:number)=>({x:a.x+dx*clamp(xm/Math.max(L,1e-9),0,1),y:a.y+dy*clamp(xm/Math.max(L,1e-9),0,1)})
    const press=(ev:any)=>{ev.stopPropagation();if(tool==='Apagar')onDeleteMemberLoad(e.id,l.id);else if(tool==='Carga'||tool==='Selecionar')onOpenMemberLoad(e.id,l.id)}
    const cls=`memberLoadGlyph ${tool==='Apagar'?'deleteTarget':'editTarget'}`
    if(l.type==='point'){
      const c=pos(l.x??L/2),sgn=(l.P??0)>=0?1:-1
      if(l.axis==='localX'){const x1=c.x-tx*sgn*62,y1=c.y-ty*sgn*62;return <g key={l.id} className={cls} onPointerDown={press}><line x1={x1} y1={y1} x2={c.x-tx*10*sgn} y2={c.y-ty*10*sgn} stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={c.x+nx*18} y={c.y+ny*18} className="loadLabel">P{idx+1}={fmt(l.P)} kN</text></g>}
      const x1=c.x+nx*sgn*66,y1=c.y+ny*sgn*66;return <g key={l.id} className={cls} onPointerDown={press}><line x1={x1} y1={y1} x2={c.x+nx*10*sgn} y2={c.y+ny*10*sgn} stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={x1+12} y={y1-8} className="loadLabel">P{idx+1}={fmt(l.P)} kN</text></g>
    }
    if(l.type==='moment'){
      const c=pos(l.x??L/2),sgn=(l.M??0)>=0?1:-1
      return <g key={l.id} className={cls} onPointerDown={press}><path d={`M ${c.x-28} ${c.y-28} A 28 28 0 ${sgn>0?1:0} ${sgn>0?1:0} ${c.x+26} ${c.y-8}`} fill="none" stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={c.x+34} y={c.y-32} className="loadLabel">M{idx+1}={fmt(l.M)} kNm</text></g>
    }
    const x1=l.x1??0,x2=l.x2??L,q1=l.q1??0,q2=l.q2??q1,pa=pos(x1),pb=pos(x2),offset=46
    const topA={x:pa.x+nx*offset,y:pa.y+ny*offset},topB={x:pb.x+nx*offset,y:pb.y+ny*offset}
    return <g key={l.id} className={cls} onPointerDown={press}><line x1={topA.x} y1={topA.y} x2={topB.x} y2={topB.y} stroke="#c91c23" strokeWidth="2"/>{Array.from({length:8}).map((_,k)=>{const t=k/7,q=q1+(q2-q1)*t,c={x:pa.x+(pb.x-pa.x)*t,y:pa.y+(pb.y-pa.y)*t},mag=Math.max(10,Math.min(46,16+Math.abs(q)*2.2)),sgn=q>=0?1:-1,start={x:c.x+nx*sgn*mag,y:c.y+ny*sgn*mag},end={x:c.x+nx*sgn*7,y:c.y+ny*sgn*7};return <line key={k} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#c91c23" strokeWidth="2" markerEnd="url(#arrowRed)"/>})}<text x={(topA.x+topB.x)/2} y={(topA.y+topB.y)/2-10} textAnchor="middle" className="loadLabel">{l.type==='uniform'?'q':l.type==='triangular'?'q△':'q▱'} {fmt(q1)}→{fmt(q2)} kN/m</text></g>
  }
  const draftA=barDraft?P(barDraft):null,draftB=barDraft&&hoverWorld?P(hoverWorld):null
  return <svg className={`canvas tool-${tool.toLowerCase().replace('ó','o')}`} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} onPointerDown={canvasPointerDown} onPointerMove={canvasPointerMove} onPointerUp={()=>setDragNodeId(null)} onPointerCancel={()=>setDragNodeId(null)} onPointerLeave={()=>{setHoverWorld(null);setDragNodeId(null)}} onWheel={(e:any)=>{e.preventDefault();setZoom(clamp(safeZoom+(e.deltaY<0?.1:-.1),.7,2))}} aria-label="Editor gráfico estrutural">
    <defs><pattern id="gridSmall" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e7eaed" strokeWidth="1"/></pattern><pattern id="gridLarge" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#gridSmall)"/><path d="M 100 0 L 0 0 0 100" fill="none" stroke="#cfd5da" strokeWidth="1.2"/></pattern><marker id="arrowRed" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c91c23"/></marker></defs>
    <rect className="canvasHit" x={vbX} y={vbY} width={vbW} height={vbH} fill="#fbfcfd"/>{showGrid&&<rect x={vbX} y={vbY} width={vbW} height={vbH} fill="url(#gridLarge)" pointerEvents="none"/>}<g opacity=".75" pointerEvents="none"><line x1="35" y1={H-35} x2="88" y2={H-35} stroke="#17324b" strokeWidth="2"/><line x1="35" y1={H-35} x2="35" y2={H-88} stroke="#17324b" strokeWidth="2"/><text x="92" y={H-30} className="axisLabel">X</text><text x="26" y={H-92} className="axisLabel">Y</text></g>
    {model.elements.map(e=>{const nA=nodeMap.get(e.n1)?.n,nB=nodeMap.get(e.n2)?.n;if(!nA||!nB)return null;const a=P(nA),b=P(nB),le=Math.hypot(nB.x-nA.x,nB.y-nA.y),loads=displayLoads(e,le);return <g key={e.id}><g onPointerDown={(ev)=>{ev.stopPropagation();if(tool==='Carga'){onOpenMemberLoad(e.id);return}if(tool==='Apagar'){onDeleteElement(e.id);return}setSelected(e.id)}} className={`clickable memberTarget ${tool==='Carga'||tool==='Apagar'?'editTarget':''}`}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="28"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selected===e.id?'#1e63b5':'#263b4d'} strokeWidth={selected===e.id?10:7} strokeLinecap="round"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d8d8d8" strokeWidth={selected===e.id?6:4} strokeLinecap="round"/>{showLabels&&<><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-13} className="memberLabel">B{e.id}</text>{selected===e.id&&<text x={(a.x+b.x)/2} y={(a.y+b.y)/2+24} className="dimLabel">{fmt(le,2)} m</text>}</>}</g>{e.kind!=='truss'&&e.releaseStartR&&<g pointerEvents="none"><circle cx={a.x+(b.x-a.x)/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))*12} cy={a.y+(b.y-a.y)/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))*12} r="11" fill="#fff" stroke="#c91c23" strokeWidth="3"/><text x={a.x+(b.x-a.x)/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))*12+14} y={a.y+(b.y-a.y)/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))*12+18} className="releaseLabel">R</text></g>}{e.kind!=='truss'&&e.releaseEndR&&<g pointerEvents="none"><circle cx={b.x-(b.x-a.x)/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))*12} cy={b.y-(b.y-a.y)/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))*12} r="11" fill="#fff" stroke="#c91c23" strokeWidth="3"/><text x={b.x-(b.x-a.x)/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))*12+14} y={b.y-(b.y-a.y)/Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))*12+18} className="releaseLabel">R</text></g>}{showLoads&&loads.map((l,i)=>loadGlyph(e,a,b,le,l,i))}</g>})}
    {draftA&&draftB&&<g pointerEvents="none"><line x1={draftA.x} y1={draftA.y} x2={draftB.x} y2={draftB.y} stroke="#1e63b5" strokeWidth="6" strokeDasharray="12 8"/><circle cx={draftA.x} cy={draftA.y} r="6" fill="#1e63b5"/><circle cx={draftB.x} cy={draftB.y} r="6" fill="#1e63b5"/></g>}
    {result&&diagram==='Deformada'&&model.elements.map(e=>{const na=nodeMap.get(e.n1)?.n,nb=nodeMap.get(e.n2)?.n;if(!na||!nb)return null;const a=DP(na),b=DP(nb);return <line key={`def-${e.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1476d4" strokeWidth="3" strokeDasharray="8 6" opacity=".95" pointerEvents="none"/>})}
    {result&&diagram!=='Deformada'&&diagramPoints&&<><polyline points={diagramPoints} fill="none" stroke="#c91c23" strokeWidth="3.5" pointerEvents="none"/><text x={W-215} y="35" className="diagramLabel">{diagram}: máx. {fmt(diagramMax/selectedFactor,2)} {selectedUnit}</text></>}
    {model.nodes.map(n=>{const pnt=P(n),hasSupport=!!(n.fixX||n.fixY||n.fixR);return <g key={n.id} className={tool==='Apoio'||tool==='Carga'||tool==='Mover'||tool==='Barra'?'editTarget':''} onPointerDown={(ev)=>{if(tool==='Apagar'){ev.stopPropagation();onDeleteNode(n.id);return}if(tool==='Mover'){ev.stopPropagation();setDragNodeId(n.id);(ev.currentTarget as SVGGElement).setPointerCapture?.(ev.pointerId);return}if(tool==='Barra'){ev.stopPropagation();onCanvasPoint(n.x,n.y);return}if(tool==='Apoio'){ev.stopPropagation();onOpenSupport(n.id);return}if(tool==='Carga'){ev.stopPropagation();onOpenNodalLoad(n.id);return}}}>{showNodes?<circle cx={pnt.x} cy={pnt.y} r="5.5" fill="#263b4d" stroke="#fff" strokeWidth="1.5"/>:<circle cx={pnt.x} cy={pnt.y} r="18" fill="transparent" stroke="none"/>}{showNodes&&showLabels&&<text x={pnt.x+12} y={pnt.y-12} className="nodeLabel">N{n.id}</text>}{barDraft?.nodeId===n.id&&<circle cx={pnt.x} cy={pnt.y} r="16" fill="none" stroke="#1e63b5" strokeWidth="3" strokeDasharray="4 3"/>}{hasSupport&&<g className={`${tool==='Apagar'?'deleteTarget supportTarget':''} ${tool==='Apoio'?'editTarget':''}`} onPointerDown={(ev)=>{if(tool==='Apagar'){ev.stopPropagation();onDeleteSupport(n.id)}else if(tool==='Apoio'){ev.stopPropagation();onOpenSupport(n.id)}}}>{n.fixR?<><rect x={pnt.x-18} y={pnt.y+5} width="36" height="18" fill="#e8eaec" stroke="#263b4d" strokeWidth="2"/><line x1={pnt.x-25} y1={pnt.y+25} x2={pnt.x+25} y2={pnt.y+25} stroke="#263b4d" strokeWidth="4"/></>:<><path d={`M ${pnt.x-18} ${pnt.y+20} L ${pnt.x+18} ${pnt.y+20} L ${pnt.x} ${pnt.y+5} Z`} fill="#e8eaec" stroke="#263b4d" strokeWidth="2"/>{!n.fixX&&n.fixY&&<><circle cx={pnt.x-10} cy={pnt.y+25} r="3.5" fill="#fff" stroke="#263b4d" strokeWidth="1.5"/><circle cx={pnt.x+10} cy={pnt.y+25} r="3.5" fill="#fff" stroke="#263b4d" strokeWidth="1.5"/><line x1={pnt.x-24} y1={pnt.y+31} x2={pnt.x+24} y2={pnt.y+31} stroke="#263b4d" strokeWidth="2"/></>}{n.fixX&&n.fixY&&<line x1={pnt.x-24} y1={pnt.y+22} x2={pnt.x+24} y2={pnt.y+22} stroke="#263b4d" strokeWidth="2"/>}</>}</g>}{showLoads&&(n.fy??0)!==0&&<g className={tool==='Apagar'?'deleteTarget':''} onPointerDown={(ev)=>{ev.stopPropagation();if(tool==='Apagar')onDeleteNodalLoad(n.id,'fy');else if(tool==='Carga'||tool==='Selecionar')onOpenNodalLoad(n.id)}}><line x1={pnt.x} y1={pnt.y-70} x2={pnt.x} y2={pnt.y-18} stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={pnt.x+10} y={pnt.y-58} className="loadLabel">P = {fmt(n.fy)} kN</text></g>}{showLoads&&(n.fx??0)!==0&&<g className={tool==='Apagar'?'deleteTarget':''} onPointerDown={(ev)=>{ev.stopPropagation();if(tool==='Apagar')onDeleteNodalLoad(n.id,'fx');else if(tool==='Carga'||tool==='Selecionar')onOpenNodalLoad(n.id)}}><line x1={pnt.x-70} y1={pnt.y} x2={pnt.x-18} y2={pnt.y} stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={pnt.x-68} y={pnt.y-10} className="loadLabel">H = {fmt(n.fx)} kN</text></g>}{showLoads&&(n.mz??0)!==0&&<g className={tool==='Apagar'?'deleteTarget':''} onPointerDown={(ev)=>{ev.stopPropagation();if(tool==='Apagar')onDeleteNodalLoad(n.id,'mz');else if(tool==='Carga'||tool==='Selecionar')onOpenNodalLoad(n.id)}}><path d={`M ${pnt.x-28} ${pnt.y-28} A 28 28 0 1 1 ${pnt.x+26} ${pnt.y-8}`} fill="none" stroke="#c91c23" strokeWidth="3"/><text x={pnt.x+30} y={pnt.y-32} className="loadLabel">M = {fmt(n.mz)} kNm</text></g>}</g>})}
    {!model.nodes.length&&<><text x={W/2} y={H/2-12} textAnchor="middle" className="emptyCanvasTitle" pointerEvents="none">Modelo vazio</text><text x={W/2} y={H/2+18} textAnchor="middle" className="emptyCanvasHint" pointerEvents="none">Escolha Barra, Nó ou Apoio e toque diretamente na grelha.</text></>}{result&&diagram==='Deformada'&&<text x="18" y="28" className="deformLabel">Deformada ampliada ×{fmt(deformScale,1)}</text>}
  </svg>
}
function Diagram({member,kind}:{member:MemberResult;kind:'N'|'V'|'M'}){
  const W=350,H=125,p=22,values=member.samples.map(s=>s[kind]),max=Math.max(1,maxAbs(values))
  const pts=member.samples.map((s,i)=>`${p+(W-2*p)*i/(member.samples.length-1)},${H/2-(s[kind]/max)*(H/2-p)}`).join(' ')
  const unit=kind==='M'?'kNm':'kN',factor=kind==='M'?1e6:1000
  return <div className="diagram"><div><b>{kind}</b><span>máx. |{kind}| = {fmt(max/factor)} {unit}</span></div><svg viewBox={`0 0 ${W} ${H}`}><line x1={p} y1={H/2} x2={W-p} y2={H/2} stroke="#adb6bf"/><polyline points={pts} fill="none" stroke="#a80d19" strokeWidth="3"/></svg></div>
}

function Checks({checks}:{checks:EC2Check[]}){return <div className="checks">{checks.map(c=><div className={`check ${c.status.toLowerCase()}`} key={c.id}><div><b>{c.title}</b><span>{c.note}</span></div><div className="checkvals">{c.demand!==undefined&&<small>{fmt(c.demand)} {c.unit}</small>}<strong>{statusLabel(c.status)}</strong>{c.utilization!==undefined&&Number.isFinite(c.utilization)&&<em>{fmt(c.utilization*100,0)}%</em>}</div></div>)}</div>}

function RebarSection({b,h,cover,bottom,top}:{b:number;h:number;cover:number;bottom?:{phi:number,n:number};top?:{phi:number,n:number}}){
  const W=370,H=330,p=58,s=Math.min((W-2*p)/b,(H-2*p-35)/h),rw=b*s,rh=h*s,x=(W-rw)/2,y=35+(H-2*p-rh)/2,bn=bottom?.n??4,tn=top?.n??2
  const barLine=(n:number,yy:number,phi:number,keyPrefix:string)=>Array.from({length:n}).map((_,i)=>{const px=x+cover*s+12+i*(rw-2*cover*s-24)/Math.max(1,n-1);return <circle key={`${keyPrefix}-${i}`} cx={px} cy={yy} r={clamp(phi*s/2,4,8)} fill="#14324a"/>})
  return <svg viewBox={`0 0 ${W} ${H}`} className="rebarSketch">
    <defs><marker id="dimArrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="#65717c"/></marker></defs>
    <text x={W/2} y="22" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1c3246">CORTE A-A</text>
    <rect x={x} y={y} width={rw} height={rh} fill="#f4f4f2" stroke="#303840" strokeWidth="3"/>
    <rect x={x+cover*s} y={y+cover*s} width={Math.max(5,rw-2*cover*s)} height={Math.max(5,rh-2*cover*s)} fill="none" stroke="#a80d19" strokeWidth="3" rx="4"/>
    {barLine(tn,y+cover*s+14,top?.phi??12,'t')}{barLine(bn,y+rh-cover*s-14,bottom?.phi??16,'b')}
    <line x1={x} y1={y+rh+24} x2={x+rw} y2={y+rh+24} stroke="#65717c" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)"/>
    <line x1={x} y1={y+rh+8} x2={x} y2={y+rh+31} stroke="#65717c"/><line x1={x+rw} y1={y+rh+8} x2={x+rw} y2={y+rh+31} stroke="#65717c"/>
    <text x={x+rw/2} y={y+rh+45} textAnchor="middle" fontSize="12" fill="#425466">b = {fmt(b,0)} mm</text>
    <line x1={x-25} y1={y} x2={x-25} y2={y+rh} stroke="#65717c" markerStart="url(#dimArrow)" markerEnd="url(#dimArrow)"/>
    <line x1={x-8} y1={y} x2={x-32} y2={y} stroke="#65717c"/><line x1={x-8} y1={y+rh} x2={x-32} y2={y+rh} stroke="#65717c"/>
    <text x={x-38} y={y+rh/2} textAnchor="middle" fontSize="12" fill="#425466" transform={`rotate(-90 ${x-38} ${y+rh/2})`}>h = {fmt(h,0)} mm</text>
    <text x={W/2} y={H-10} textAnchor="middle" fontSize="12" fill="#31475b">sup. {top?`${top.n}Ø${top.phi}`:'—'} · inf. {bottom?`${bottom.n}Ø${bottom.phi}`:'—'} · cnom {fmt(cover,0)} mm</text>
  </svg>
}

function BeamElevation({L=6,bottom,top,endSt,midSt,zone=1}:{L?:number;bottom?:{phi:number,n:number};top?:{phi:number,n:number};endSt:string;midSt:string;zone:number}){
  const total=600,ratio=clamp(zone/Math.max(L,0.1),.08,.35),zx=total*ratio,x0=60,x1=x0+total,y0=58,y1=188
  return <svg viewBox="0 0 720 325" className="rebarSketch">
    <defs><marker id="dimArrowBeam" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 z" fill="#65717c"/></marker></defs>
    <text x="360" y="28" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1c3246">ALÇADO ESQUEMÁTICO DA VIGA</text>
    <rect x={x0} y={y0} width={total} height={y1-y0} fill="#f4f4f2" stroke="#303840" strokeWidth="3"/>
    <line x1={x0+20} y1="158" x2={x1-20} y2="158" stroke="#14324a" strokeWidth="5"/><line x1={x0+20} y1="85" x2={x1-20} y2="85" stroke="#14324a" strokeWidth="4"/>
    {Array.from({length:25}).map((_,i)=>{const xx=x0+18+i*24;return <rect key={i} x={xx} y="72" width="15" height="101" fill="none" stroke={xx-x0<zx||xx-x0>total-zx?'#a80d19':'#c26b73'} strokeWidth="2"/>})}
    <path d={`M${x0} 198 L${x0+20} 225 L${x0+40} 198 Z M${x1-40} 198 L${x1-20} 225 L${x1} 198 Z`} fill="#c3c8cd" stroke="#14324a"/>
    <line x1={x0+zx} y1="48" x2={x0+zx} y2="196" stroke="#50708c" strokeDasharray="6 5"/><text x={x0+zx} y="45" textAnchor="middle" fontSize="12" fontWeight="800" fill="#36536d">A-A</text>
    <line x1={x1-zx} y1="48" x2={x1-zx} y2="196" stroke="#50708c" strokeDasharray="6 5"/><text x={x1-zx} y="45" textAnchor="middle" fontSize="12" fontWeight="800" fill="#36536d">B-B</text>
    <text x="360" y="150" textAnchor="middle" fontSize="15" fill="#14324a">Inf. {bottom?`${bottom.n}Ø${bottom.phi}`:'—'}</text><text x="360" y="104" textAnchor="middle" fontSize="15" fill="#14324a">Sup. {top?`${top.n}Ø${top.phi}`:'—'}</text>
    <text x="155" y="211" textAnchor="middle" fontSize="12" fill="#8a1620">apoio: {endSt}</text><text x="360" y="211" textAnchor="middle" fontSize="12" fill="#425466">vão: {midSt}</text><text x="565" y="211" textAnchor="middle" fontSize="12" fill="#8a1620">apoio: {endSt}</text>
    <line x1={x0} y1="260" x2={x1} y2="260" stroke="#65717c" markerStart="url(#dimArrowBeam)" markerEnd="url(#dimArrowBeam)"/><line x1={x0} y1="238" x2={x0} y2="268" stroke="#65717c"/><line x1={x1} y1="238" x2={x1} y2="268" stroke="#65717c"/>
    <text x="360" y="281" textAnchor="middle" fontSize="13" fill="#425466">L = {fmt(L,2)} m</text><text x="360" y="304" textAnchor="middle" fontSize="12" fill="#65717c">zonas reforçadas junto aos apoios ≈ {fmt(zone,2)} m</text>
  </svg>
}

function ColumnSketch({b,h,cover,bars,tieSpacing}:{b:number;h:number;cover:number;bars:{phi:number,n:number};tieSpacing:number}){return <div><RebarSection b={b} h={h} cover={cover} bottom={bars} top={bars}/><svg viewBox="0 0 300 300" className="rebarSketch"><rect x="100" y="25" width="100" height="235" fill="#f8f8f8" stroke="#303840" strokeWidth="3"/>{Array.from({length:12}).map((_,i)=><rect key={i} x="112" y={40+i*17} width="76" height="12" fill="none" stroke="#a80d19" strokeWidth="2"/>)}<line x1="120" y1="35" x2="120" y2="250" stroke="#14324a" strokeWidth="5"/><line x1="180" y1="35" x2="180" y2="250" stroke="#14324a" strokeWidth="5"/><text x="150" y="280" textAnchor="middle" fontSize="13">{bars.n}Ø{bars.phi} · cintas Ø8/{fmt(tieSpacing,0)}</text></svg></div>}

function RebarSchedule({rows}:{rows:RebarRow[]}){
  const total=rows.reduce((s,r)=>s+r.weightKg,0)
  return <div className="card"><b>Mapa de armaduras · estimativa</b><div className="tableWrap"><table><thead><tr><th>Marca</th><th>Descrição</th><th>Ø</th><th>Qtd.</th><th>L/un.</th><th>kg</th></tr></thead><tbody>{rows.map(r=><tr key={r.mark}><td>{r.mark}</td><td>{r.description}</td><td>{r.phi}</td><td>{r.qty}</td><td>{fmt(r.lengthM,2)} m</td><td>{fmt(r.weightKg,1)}</td></tr>)}</tbody><tfoot><tr><td colSpan={5}><b>Total aproximado</b></td><td><b>{fmt(total,1)} kg</b></td></tr></tfoot></table></div></div>
}

export default function App(){
  const [mode,setMode]=useState<Mode>(()=>{const saved=localStorage.getItem('rjp-structures-mode-v17')||localStorage.getItem('rjp-structures-mode-v16');return saved==='Viga'||saved==='Pórtico 2D'||saved==='Treliça 2D'?saved:'Viga'})
  const [selected,setSelected]=useState(1)
  const [tab,setTab]=useState<Tab>('Modelo')
  const [tool,setTool]=useState<Tool>('Selecionar')
  const [canvasResult,setCanvasResult]=useState<CanvasResult>('M')
  const [panelCollapsed,setPanelCollapsed]=useState(false)
  const [focusMode,setFocusMode]=useState(false)
  const [zoom,setZoom]=useState(1)
  const [showGrid,setShowGrid]=useState(true)
  const [showLabels,setShowLabels]=useState(true)
  const [showLoads,setShowLoads]=useState(true)
  const [showNodes,setShowNodes]=useState(()=>(localStorage.getItem('rjp-structures-show-nodes-v176')??localStorage.getItem('rjp-structures-show-nodes-v175')??localStorage.getItem('rjp-structures-show-nodes-v172'))!=='false')
  const [newProjectOpen,setNewProjectOpen]=useState(false)
  const [newMode,setNewMode]=useState<Mode>('Viga')
  const [newPreset,setNewPreset]=useState<StartPreset>('Barra + nós')
  const [barDraft,setBarDraft]=useState<BarDraft>(null)
  const [editorDialog,setEditorDialog]=useState<EditorDialog>(null)
  const [nodalForm,setNodalForm]=useState<NodalForm>({fx:0,fy:0,mz:0})
  const [memberForm,setMemberForm]=useState<MemberForm>({type:'point',axis:'localY',P:-25,M:10,x:0,x1:0,x2:1,q1:-8,q2:-8})
  const [projectName,setProjectName]=useState(()=>localStorage.getItem('rjp-structures-project-name-v17')||localStorage.getItem('rjp-structures-project-name-v16')||'Projeto estrutural')
  const [ui,setUi]=useState<UiSettings>(()=>{try{const raw=localStorage.getItem('rjp-structures-ui-v17');return raw?{...DEFAULT_UI,...JSON.parse(raw)}:DEFAULT_UI}catch{return DEFAULT_UI}})
  const [lastAutoSave,setLastAutoSave]=useState<string>(()=>localStorage.getItem('rjp-structures-autosave-time-v17')||'')
  const [history,setHistory]=useState<Settings[]>([])
  const [future,setFuture]=useState<Settings[]>([])
  const [settings,setSettings]=useState<Settings>(()=>{
    try{const raw=localStorage.getItem('rjp-structures-v17')||localStorage.getItem('rjp-structures-v16')||localStorage.getItem('rjp-structures-v15');if(raw)return {...DEFAULT_SETTINGS,...JSON.parse(raw)}}catch{}
    return DEFAULT_SETTINGS
  })
  const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null)
  const [webAppInstalled,setWebAppInstalled]=useState(()=>window.matchMedia?.('(display-mode: standalone)').matches===true)
  const [modelEdits,setModelEdits]=useState<EditsByMode>(()=>{
    try{
      const raw=localStorage.getItem('rjp-structures-model-edits-v17')||localStorage.getItem('rjp-structures-model-edits-v161')
      if(raw){
        const parsed=JSON.parse(raw) as Partial<EditsByMode>
        return {
          'Viga':normalizeModelEdits(parsed['Viga']),
          'Pórtico 2D':normalizeModelEdits(parsed['Pórtico 2D']),
          'Treliça 2D':normalizeModelEdits(parsed['Treliça 2D'])
        }
      }
    }catch{}
    return emptyEditsByMode()
  })


  const [customModels,setCustomModels]=useState<Partial<Record<Mode,Model2D>>>(()=>{
    try{const raw=localStorage.getItem('rjp-structures-custom-models-v177')||localStorage.getItem('rjp-structures-custom-models-v176')||localStorage.getItem('rjp-structures-custom-models-v175')||localStorage.getItem('rjp-structures-custom-models-v172');return raw?JSON.parse(raw):{}}catch{return {}}
  })

  useEffect(()=>{
    const onPrompt=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPromptEvent)}
    const onInstalled=()=>{setWebAppInstalled(true);setInstallPrompt(null)}
    window.addEventListener('beforeinstallprompt',onPrompt)
    window.addEventListener('appinstalled',onInstalled)
    return()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)}
  },[])
  async function installWebApp(){
    if(!installPrompt)return
    await installPrompt.prompt()
    const choice=await installPrompt.userChoice
    if(choice.outcome==='accepted')setInstallPrompt(null)
  }
  useEffect(()=>{localStorage.setItem('rjp-structures-v17',JSON.stringify(settings))},[settings])
  useEffect(()=>{localStorage.setItem('rjp-structures-model-edits-v17',JSON.stringify(modelEdits))},[modelEdits])
  useEffect(()=>{localStorage.setItem('rjp-structures-project-name-v17',projectName)},[projectName])
  useEffect(()=>{localStorage.setItem('rjp-structures-mode-v17',mode)},[mode])
  useEffect(()=>{localStorage.setItem('rjp-structures-ui-v17',JSON.stringify(ui));document.documentElement.style.setProperty('--ui-scale',String(ui.fontScale));document.documentElement.style.setProperty('--canvas-scale',String(ui.canvasTextScale))},[ui])
  useEffect(()=>{localStorage.setItem('rjp-structures-custom-models-v177',JSON.stringify(customModels))},[customModels])
  useEffect(()=>{localStorage.setItem('rjp-structures-show-nodes-v177',String(showNodes))},[showNodes])
  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      const savedAt=new Date().toISOString()
      const snapshot:ProjectFile={version:'1.7.7',mode,settings,projectName,edits:modelEdits,ui,customModels,showNodes,savedAt}
      localStorage.setItem('rjp-structures-autosave-v17',JSON.stringify(snapshot))
      localStorage.setItem('rjp-structures-autosave-time-v17',savedAt)
      setLastAutoSave(savedAt)
    },650)
    return()=>window.clearTimeout(timer)
  },[mode,settings,projectName,modelEdits,ui,customModels,showNodes])
  function commitSettings(next:Settings){
    if(JSON.stringify(next)===JSON.stringify(settings))return
    setHistory(h=>[...h.slice(-49),settings]);setFuture([]);setSettings(next)
  }
  function reactivateLoadForSetting(k:keyof Settings){
    setModelEdits(prev=>{
      const cur=prev[mode],next:ModelEdits={...cur,removedNodalLoads:[...cur.removedNodalLoads],removedDistributedLoads:[...cur.removedDistributedLoads],removedSupports:[...cur.removedSupports],supportOverrides:[...cur.supportOverrides],nodalLoadOverrides:[...cur.nodalLoadOverrides],distributedLoadOverrides:[...cur.distributedLoadOverrides]}
      if(mode==='Viga'&&k==='beamQ'){next.removedDistributedLoads=next.removedDistributedLoads.filter(id=>id!==1&&id!==2);next.distributedLoadOverrides=next.distributedLoadOverrides.filter(x=>x.elementId!==1&&x.elementId!==2)}
      if(mode==='Viga'&&k==='beamP'){next.removedNodalLoads=next.removedNodalLoads.filter(x=>!(x.nodeId===2&&x.component==='fy'));next.nodalLoadOverrides=next.nodalLoadOverrides.filter(x=>x.nodeId!==2)}
      if(mode==='Pórtico 2D'&&k==='frameQ'){next.removedDistributedLoads=next.removedDistributedLoads.filter(id=>id!==2);next.distributedLoadOverrides=next.distributedLoadOverrides.filter(x=>x.elementId!==2)}
      if(mode==='Pórtico 2D'&&k==='frameHLoad'){next.removedNodalLoads=next.removedNodalLoads.filter(x=>!(x.nodeId===3&&x.component==='fx'));next.nodalLoadOverrides=next.nodalLoadOverrides.filter(x=>x.nodeId!==3)}
      if(mode==='Treliça 2D'&&k==='trussP'){next.removedNodalLoads=next.removedNodalLoads.filter(x=>!(x.nodeId===2&&x.component==='fy'));next.nodalLoadOverrides=next.nodalLoadOverrides.filter(x=>x.nodeId!==2)}
      return {...prev,[mode]:next}
    })
  }
  const set=(k:keyof Settings,v:number|string)=>{reactivateLoadForSetting(k);commitSettings({...settings,[k]:v} as Settings)}
  function editCurrentModel(mutator:(current:ModelEdits)=>ModelEdits){
    setModelEdits(prev=>({...prev,[mode]:mutator(prev[mode])}))
  }
  function deleteSupport(nodeId:number){
    editCurrentModel(cur=>cur.removedSupports.includes(nodeId)?cur:{...cur,removedSupports:[...cur.removedSupports,nodeId]})
  }
  function deleteNodalLoad(nodeId:number,component:LoadComponent){
    editCurrentModel(cur=>cur.removedNodalLoads.some(x=>x.nodeId===nodeId&&x.component===component)?cur:{...cur,removedNodalLoads:[...cur.removedNodalLoads,{nodeId,component}]})
  }
  function restoreModeLoadsAndSupports(){setModelEdits(prev=>({...prev,[mode]:emptyModelEdits()}))}
  function setSupportState(nodeId:number,fixX:boolean,fixY:boolean,fixR:boolean){
    editCurrentModel(cur=>({...cur,removedSupports:cur.removedSupports.filter(id=>id!==nodeId),supportOverrides:[...cur.supportOverrides.filter(x=>x.nodeId!==nodeId),{nodeId,fixX,fixY,fixR}]}))
  }
  function openSupportEditor(nodeId:number){setEditorDialog({kind:'support',nodeId})}
  function openNodalEditor(nodeId:number){
    const node=model.nodes.find(n=>n.id===nodeId);if(!node)return
    setNodalForm({fx:node.fx??0,fy:node.fy??0,mz:node.mz??0});setEditorDialog({kind:'nodal',nodeId})
  }
  function saveNodalEditor(){
    if(!editorDialog||editorDialog.kind!=='nodal')return
    const nodeId=editorDialog.nodeId,{fx,fy,mz}=nodalForm
    editCurrentModel(cur=>({...cur,removedNodalLoads:cur.removedNodalLoads.filter(x=>x.nodeId!==nodeId),nodalLoadOverrides:[...cur.nodalLoadOverrides.filter(x=>x.nodeId!==nodeId),{nodeId,fx,fy,mz}]}))
    setShowLoads(true);setEditorDialog(null)
  }
  function setElementActions(elementId:number,actions:MemberLoad[]){
    const next=cloneModel(model),e=next.elements.find(x=>x.id===elementId);if(!e)return
    e.qy=undefined;e.loads=actions.map(a=>({...a}))
    commitGeometry(next)
  }
  function openMemberEditor(elementId:number,loadId?:string,type:MemberLoadType='point'){
    const e=model.elements.find(x=>x.id===elementId);if(!e)return
    const a=model.nodes.find(n=>n.id===e.n1),b=model.nodes.find(n=>n.id===e.n2),L=a&&b?Math.hypot(b.x-a.x,b.y-a.y):1
    const existing=loadId?displayLoads(e,L).find(l=>l.id===loadId):undefined
    const chosen=existing?.type??type
    setMemberForm({type:chosen,axis:(existing?.axis??'localY') as 'localY'|'localX',P:existing?.P??-25,M:existing?.M??10,x:existing?.x??L/2,x1:existing?.x1??0,x2:existing?.x2??L,q1:existing?.q1??-8,q2:existing?.q2??(chosen==='triangular'?0:-8)})
    setSelected(elementId);setEditorDialog({kind:'member',elementId,loadId})
  }
  function addMemberLoad(elementId:number,type?:MemberLoadType){openMemberEditor(elementId,undefined,type??'point')}
  function editMemberLoad(elementId:number,loadId:string){openMemberEditor(elementId,loadId)}
  function saveMemberEditor(){
    if(!editorDialog||editorDialog.kind!=='member')return
    const elementId=editorDialog.elementId,e=model.elements.find(x=>x.id===elementId);if(!e)return
    const a=model.nodes.find(n=>n.id===e.n1),b=model.nodes.find(n=>n.id===e.n2),L=a&&b?Math.hypot(b.x-a.x,b.y-a.y):1
    let action:MemberLoad
    const id=editorDialog.loadId&&editorDialog.loadId!=='legacy-qy'?editorDialog.loadId:`A${Date.now().toString(36)}`
    const x=clamp(memberForm.x,0,L),x1=clamp(Math.min(memberForm.x1,memberForm.x2),0,L),x2=clamp(Math.max(memberForm.x1,memberForm.x2),0,L)
    if(memberForm.type==='point')action={id,type:'point',axis:memberForm.axis,P:memberForm.P,x}
    else if(memberForm.type==='moment')action={id,type:'moment',axis:'localY',M:memberForm.M,x}
    else if(memberForm.type==='uniform')action={id,type:'uniform',axis:'localY',x1,x2,q1:memberForm.q1,q2:memberForm.q1}
    else if(memberForm.type==='triangular')action={id,type:'triangular',axis:'localY',x1,x2,q1:memberForm.q1,q2:memberForm.q2}
    else action={id,type:'trapezoidal',axis:'localY',x1,x2,q1:memberForm.q1,q2:memberForm.q2}
    if((action.type==='uniform'||action.type==='triangular'||action.type==='trapezoidal')&&x2-x1<0.001){alert('A carga distribuída precisa de um comprimento maior que zero.');return}
    if(e.kind==='truss'&&action.type!=='point'){alert('Em barras de treliça, use apenas forças concentradas axiais.');return}
    const existing=displayLoads(e,L).filter(l=>l.id!=='legacy-qy'&&l.id!==editorDialog.loadId)
    setElementActions(elementId,[...existing,action]);setShowLoads(true);setEditorDialog(null)
  }
  function deleteMemberLoad(elementId:number,loadId:string){
    const e=model.elements.find(x=>x.id===elementId);if(!e)return
    const a=model.nodes.find(n=>n.id===e.n1),b=model.nodes.find(n=>n.id===e.n2),L=a&&b?Math.hypot(b.x-a.x,b.y-a.y):0
    setElementActions(elementId,displayLoads(e,L).filter(l=>l.id!==loadId&&l.id!=='legacy-qy'))
  }
  function clearSelectedMemberLoads(){if(!el)return;setElementActions(el.id,[])}

  function commitGeometry(next:Model2D){
    setCustomModels(prev=>({...prev,[mode]:cloneModel(next)}))
    setModelEdits(prev=>({...prev,[mode]:emptyModelEdits()}))
  }
  function setElementRelease(elementId:number,end:'start'|'end',released:boolean){
    const next=cloneModel(model),e=next.elements.find(x=>x.id===elementId);if(!e||e.kind==='truss')return
    if(end==='start')e.releaseStartR=released;else e.releaseEndR=released
    commitGeometry(next)
  }
  function nearestNodeId(x:number,y:number,threshold=.35){
    let best:{id:number;d:number}|null=null
    for(const n of model.nodes){const d=Math.hypot(n.x-x,n.y-y);if(d<=threshold&&(!best||d<best.d))best={id:n.id,d}}
    return best?.id??null
  }
  function addNodeToModel(x:number,y:number,support=false){
    const next=cloneModel(model),id=Math.max(0,...next.nodes.map(n=>n.id))+1
    next.nodes.push({id,x,y,...(support?{fixX:true,fixY:true,fixR:false}:{})})
    commitGeometry(next);return id
  }
  function makeElementForMode(id:number,n1:number,n2:number){
    if(mode==='Treliça 2D')return {id,n1,n2,E:210000,A:settings.trussA,I:0,kind:'truss' as const}
    const Erc=concreteProps(settings.fck).Ecm,sec={b:settings.beamB,h:settings.beamH,cover:settings.cover,fck:settings.fck,fyk:settings.fyk}
    return {id,n1,n2,E:Erc,A:settings.beamB*settings.beamH,I:settings.beamB*settings.beamH**3/12,kind:'frame' as const,releaseStartR:false,releaseEndR:false,section:sec}
  }
  function deleteElement(elementId:number){
    const next=cloneModel(model);next.elements=next.elements.filter(e=>e.id!==elementId);commitGeometry(next)
    setSelected(next.elements[0]?.id??1)
  }
  function deleteNode(nodeId:number){
    const next=cloneModel(model);next.elements=next.elements.filter(e=>e.n1!==nodeId&&e.n2!==nodeId);next.nodes=next.nodes.filter(n=>n.id!==nodeId);commitGeometry(next);setSelected(next.elements[0]?.id??1)
  }
  function moveNode(nodeId:number,x:number,y:number){
    const next=cloneModel(model),n=next.nodes.find(n=>n.id===nodeId);if(!n)return;n.x=x;n.y=y;commitGeometry(next)
  }
  function handleCanvasPoint(x:number,y:number){
    if(tool==='Nó'){const near=nearestNodeId(x,y);if(near!==null)return;addNodeToModel(x,y,false);setShowNodes(true);return}
    if(tool==='Apoio'){
      const near=nearestNodeId(x,y)
      if(near!==null){openSupportEditor(near);return}
      const id=addNodeToModel(x,y,true);setShowNodes(true);setEditorDialog({kind:'support',nodeId:id});return
    }
    if(tool==='Barra'){
      const near=nearestNodeId(x,y)
      if(barDraft===null){setBarDraft({x,y,...(near!==null?{nodeId:near}:{})});return}
      const next=cloneModel(model)
      let startId=barDraft.nodeId
      if(startId===undefined){startId=Math.max(0,...next.nodes.map(n=>n.id))+1;next.nodes.push({id:startId,x:barDraft.x,y:barDraft.y})}
      let endId=near
      if(endId===null){endId=Math.max(startId,...next.nodes.map(n=>n.id))+1;next.nodes.push({id:endId,x,y})}
      if(endId===startId){setBarDraft(null);return}
      const duplicate=next.elements.some(e=>(e.n1===startId&&e.n2===endId)||(e.n1===endId&&e.n2===startId))
      if(!duplicate){const eid=Math.max(0,...next.elements.map(e=>e.id))+1;next.elements.push(makeElementForMode(eid,startId,endId));commitGeometry(next);setSelected(eid)}
      setBarDraft(null);return
    }
  }
  function createNewProject(){
    const fresh={...DEFAULT_SETTINGS}
    setHistory(h=>[...h.slice(-49),settings]);setFuture([]);setSettings(fresh);setModelEdits(emptyEditsByMode());setMode(newMode)
    const starter=starterModel(newMode,newPreset,fresh)
    setCustomModels(starter?{[newMode]:starter}:{})
    const nodesVisible=newPreset==='Barra + nós'||newPreset==='Nós'||newPreset==='Padrão'
    setShowNodes(nodesVisible);setShowLabels(nodesVisible);setSelected(1);setTab('Modelo');setZoom(1);setBarDraft(null);setProjectName('Projeto estrutural');setNewProjectOpen(false)
  }

  function undo(){
    const previous=history[history.length-1];if(!previous)return
    setFuture(f=>[settings,...f].slice(0,50));setHistory(h=>h.slice(0,-1));setSettings(previous)
  }
  function redo(){
    const next=future[0];if(!next)return
    setHistory(h=>[...h.slice(-49),settings]);setFuture(f=>f.slice(1));setSettings(next)
  }

  const baseModel=useMemo(()=>customModels[mode]?applyCurrentElementProperties(customModels[mode]!,mode,settings):makeModel(mode,settings),[customModels,mode,settings])
  const model=useMemo(()=>applyModelEdits(baseModel,modelEdits[mode]),[baseModel,modelEdits,mode])
  const freeModel=!!customModels[mode]
  useEffect(()=>{if(!model.elements.some(e=>e.id===selected))setSelected(model.elements[0]?.id??1)},[model,selected])

  const analysis=useMemo<AnalysisState>(()=>{
    try{return {ok:true,data:solveFrame(model)}}
    catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)}}
  },[model])
  const result=analysis.ok?analysis.data:null
  const member=result?.members.find(m=>m.id===selected)
  const el=model.elements.find(e=>e.id===selected)
  const n1=model.nodes.find(n=>n.id===el?.n1),n2=model.nodes.find(n=>n.id===el?.n2)
  const selectedLength=n1&&n2?Math.hypot(n2.x-n1.x,n2.y-n1.y):0
  const selectedMemberLoads=el?displayLoads(el,selectedLength):[]
  const critM=criticalSample(member,'M'),critV=criticalSample(member,'V'),critN=criticalSample(member,'N')
  const med=Math.abs(critM.value)/1e6,ved=Math.abs(critV.value)/1000,ned=Math.abs(critN.value)/1000
  const moments=momentExtrema(member)
  const length=selectedLength
  const isTruss=el?.kind==='truss'
  const isColumn=!!(!isTruss&&n1&&n2&&Math.abs(n2.y-n1.y)>Math.abs(n2.x-n1.x)*1.2)
  const sec=el?.section

  const commonBeam=sec&&!isColumn?{...sec,span:length,phiLong:16,phiSt:8,exposure:settings.exposure,structuralClass:4,deltaCdev:10,cotTheta:settings.cotTheta}:null
  const pos0=commonBeam?beamEC2({...commonBeam,MEd:moments.positive,VEd:ved}):null
  const neg0=commonBeam?beamEC2({...commonBeam,MEd:moments.negative,VEd:ved}):null
  const bottomBars=pos0&&sec?chooseBarsEC2(pos0.flex.AsReq,sec.b,sec.cover,8,20)[0]:undefined
  const topBars=neg0&&sec?chooseBarsEC2(neg0.flex.AsReq,sec.b,sec.cover,8,20)[0]:undefined
  const criticalBars=moments.negative>moments.positive?topBars:bottomBars
  const beamBase=commonBeam?beamEC2({...commonBeam,MEd:med,VEd:ved,phiLong:criticalBars?.phi??16,AsProv:criticalBars?.area,phiBars:criticalBars?.phi,nBars:criticalBars?.n}):null
  const stirrupEnd=beamBase?chooseStirrupsEC2(beamBase.shear.AswPerS,beamBase.flex.d)[0]:undefined
  const midV=member?.samples.length?Math.abs(member.samples.reduce((best,s)=>Math.abs(s.x-length/2)<Math.abs(best.x-length/2)?s:best,member.samples[0]).V)/1000:0
  const midBeam=commonBeam&&beamBase?beamEC2({...commonBeam,MEd:med,VEd:midV,phiLong:criticalBars?.phi??16,AsProv:criticalBars?.area,phiBars:criticalBars?.phi,nBars:criticalBars?.n}):null
  const stirrupMid=midBeam?chooseStirrupsEC2(midBeam.shear.AswPerS,midBeam.flex.d)[0]:undefined
  const beamFinal=commonBeam&&beamBase?beamEC2({...commonBeam,MEd:med,VEd:ved,phiLong:criticalBars?.phi??16,phiSt:stirrupEnd?.phi??8,AsProv:criticalBars?.area??beamBase.flex.AsReq,phiBars:criticalBars?.phi??16,nBars:criticalBars?.n??4,AswPerSProv:stirrupEnd?.AswPerS??beamBase.shear.AswPerS,phiStProv:stirrupEnd?.phi??8,stirrupSpacing:stirrupEnd?.spacing??150}):null

  const col0=sec&&isColumn?columnEC2({...sec,NEd:ned,M01:member?Math.abs(member.endForces[2])/1e6:0,M02:member?Math.abs(member.endForces[5])/1e6:0,l0:length,phiLong:16,phiTie:8,tieSpacing:150,creepPhi:2,rm:0,exposure:settings.exposure,deltaCdev:10}):null
  const colCandidates=col0&&sec?chooseColumnBarsEC2(col0.AsMin,sec.b,sec.h,sec.cover,8,20):[]
  const colBars=col0&&sec?(colCandidates.find(b=>columnEC2({...sec,NEd:ned,M01:member?Math.abs(member.endForces[2])/1e6:0,M02:member?Math.abs(member.endForces[5])/1e6:0,l0:length,phiLong:b.phi,phiTie:8,tieSpacing:150,AsProv:b.area,creepPhi:2,rm:0}).interaction<=1)??colCandidates[colCandidates.length-1]):undefined
  const col=sec&&isColumn&&col0?columnEC2({...sec,NEd:ned,M01:member?Math.abs(member.endForces[2])/1e6:0,M02:member?Math.abs(member.endForces[5])/1e6:0,l0:length,phiLong:colBars?.phi??16,phiTie:8,tieSpacing:150,AsProv:colBars?.area??col0.AsMin,creepPhi:2,rm:0,exposure:settings.exposure,deltaCdev:10}):null

  const slab=slabEC2({h:200,cover:settings.cover,fck:settings.fck,fyk:settings.fyk,MEdPerM:35,span:5,phi:12,spacing:150,exposure:settings.exposure})
  const punch=punchingEC2({c1:300,c2:300,h:220,cover:settings.cover,fck:settings.fck,fyk:settings.fyk,VEd:380,rhoL:.006,beta:1.15})
  const footing=footingEC2({B:2.2,L:2.2,h:500,cover:50,colB:.35,colL:.35,NEd:900,fck:settings.fck,fyk:settings.fyk,phi:16})
  const fatigue=fatigueQuickCheck(120)
  const fire=sec?firePrecheck(isColumn?'column':'beam',60,sec.b,sec.h,sec.cover+8+8):null

  const nodeIndex=new Map(model.nodes.map((n,i)=>[n.id,i]))
  const checks=beamFinal?.checks??col?.checks??[]
  const ok=checks.filter(c=>c.status==='OK').length,fail=checks.filter(c=>c.status==='FAIL').length,warn=checks.filter(c=>c.status==='WARN').length,na=checks.filter(c=>c.status==='NA').length
  const overallState=checks.length?(fail?'NÃO CUMPRE':warn?'VERIFICAR':'CUMPRE'):'NÃO VERIFICADO'
  const overallClass=fail?'bad':warn?'caution':checks.length?'good':'muted'
  const endStLabel=stirrupEnd?`${stirrupEnd.legs}r Ø${stirrupEnd.phi}/${stirrupEnd.spacing}`:'—'
  const midStLabel=stirrupMid?`${stirrupMid.legs}r Ø${stirrupMid.phi}/${stirrupMid.spacing}`:'—'
  const zone=beamFinal?Math.min(length/4,Math.max(.5,2*beamFinal.flex.d/1000)):0

  const beamSchedule:RebarRow[]=useMemo(()=>{
    if(!beamFinal||!sec||!bottomBars||!topBars||!stirrupEnd||!stirrupMid)return []
    const lLong=length+2*beamFinal.anchorage.lbd/1000
    const clearB=Math.max(50,sec.b-2*sec.cover),clearH=Math.max(50,sec.h-2*sec.cover)
    const stCut=2*(clearB+clearH)/1000+20*stirrupEnd.phi/1000
    const endCount=Math.max(2,2*(Math.ceil(zone*1000/stirrupEnd.spacing)+1))
    const midLen=Math.max(0,length-2*zone)
    const midCount=Math.max(0,Math.ceil(midLen*1000/stirrupMid.spacing))
    return [
      {mark:'B1',description:'Longitudinal inferior',phi:bottomBars.phi,qty:bottomBars.n,lengthM:lLong,weightKg:barWeight(bottomBars.phi,bottomBars.n,lLong)},
      {mark:'B2',description:'Longitudinal superior',phi:topBars.phi,qty:topBars.n,lengthM:lLong,weightKg:barWeight(topBars.phi,topBars.n,lLong)},
      {mark:'E1',description:`Estribos zonas de apoio ${endStLabel}`,phi:stirrupEnd.phi,qty:endCount,lengthM:stCut,weightKg:barWeight(stirrupEnd.phi,endCount,stCut)},
      {mark:'E2',description:`Estribos zona de vão ${midStLabel}`,phi:stirrupMid.phi,qty:midCount,lengthM:stCut,weightKg:barWeight(stirrupMid.phi,midCount,stCut)}
    ]
  },[beamFinal,sec,bottomBars,topBars,stirrupEnd,stirrupMid,length,zone,endStLabel,midStLabel])

  const columnSchedule:RebarRow[]=useMemo(()=>{
    if(!col||!colBars||!sec)return []
    const longLen=length+Math.max(.6,40*colBars.phi/1000)
    const tieCut=2*(Math.max(50,sec.b-2*sec.cover)+Math.max(50,sec.h-2*sec.cover))/1000+20*8/1000
    const nTies=Math.ceil(length*1000/col.tieSpacing)+1
    return [
      {mark:'P1',description:'Varões longitudinais',phi:colBars.phi,qty:colBars.n,lengthM:longLen,weightKg:barWeight(colBars.phi,colBars.n,longLen)},
      {mark:'C1',description:`Cintas Ø8/${fmt(col.tieSpacing,0)}`,phi:8,qty:nTies,lengthM:tieCut,weightKg:barWeight(8,nTies,tieCut)}
    ]
  },[col,colBars,sec,length])

  const selectedSchedule=isColumn?columnSchedule:beamSchedule
  const steelTotal=selectedSchedule.reduce((sum,row)=>sum+row.weightKg,0)

  function applyProjectFile(p:ProjectFile){
    if(p.settings){setHistory(h=>[...h.slice(-49),settings]);setFuture([]);setSettings({...DEFAULT_SETTINGS,...p.settings})}
    if(p.edits){setModelEdits({'Viga':normalizeModelEdits(p.edits['Viga']),'Pórtico 2D':normalizeModelEdits(p.edits['Pórtico 2D']),'Treliça 2D':normalizeModelEdits(p.edits['Treliça 2D'])})}
    if(p.mode)setMode(p.mode)
    if(p.projectName)setProjectName(p.projectName)
    if(p.ui)setUi({...DEFAULT_UI,...p.ui})
    setCustomModels(p.customModels??{})
    if(typeof p.showNodes==='boolean')setShowNodes(p.showNodes)
    setBarDraft(null)
  }
  function saveProject(){
    localStorage.setItem('rjp-structures-v17',JSON.stringify(settings))
    localStorage.setItem('rjp-structures-mode-v17',mode)
    localStorage.setItem('rjp-structures-project-name-v17',projectName)
    localStorage.setItem('rjp-structures-model-edits-v17',JSON.stringify(modelEdits))
    localStorage.setItem('rjp-structures-ui-v17',JSON.stringify(ui))
    localStorage.setItem('rjp-structures-custom-models-v177',JSON.stringify(customModels))
    localStorage.setItem('rjp-structures-show-nodes-v177',String(showNodes))
    const now=new Date().toISOString();setLastAutoSave(now);localStorage.setItem('rjp-structures-autosave-time-v17',now)
  }
  function exportProject(){
    const file:ProjectFile={version:'1.7.7',mode,settings,projectName,edits:modelEdits,ui,customModels,showNodes,savedAt:new Date().toISOString()}
    const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${projectName.replace(/[^a-z0-9_-]+/gi,'_')||'RJP_Structures'}_V1_7_6.json`;a.click();URL.revokeObjectURL(a.href)
  }
  function importProject(e:ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0];if(!f)return
    const reader=new FileReader();reader.onload=()=>{try{applyProjectFile(JSON.parse(String(reader.result)) as ProjectFile)}catch{alert('Ficheiro de projeto inválido.')}};reader.readAsText(f);e.target.value=''
  }
  function recoverAutosave(){
    try{const raw=localStorage.getItem('rjp-structures-autosave-v17');if(!raw){alert('Não existe uma cópia automática disponível.');return}applyProjectFile(JSON.parse(raw) as ProjectFile)}catch{alert('Não foi possível recuperar a cópia automática.')}
  }
  function resetProject(){setNewMode(mode);setNewPreset('Barra + nós');setNewProjectOpen(true)}

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject()}
      if(e.key==='Escape'){if(editorDialog)setEditorDialog(null);else if(barDraft)setBarDraft(null);else if(focusMode)setFocusMode(false)}
    }
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)
  },[history,future,settings,mode,projectName,focusMode,editorDialog,barDraft])

  const toolIcons:Record<Tool,string>={Selecionar:'↖',Nó:'○',Barra:'╱',Apoio:'△',Carga:'↓',Mover:'✥',Apagar:'⌫'}
  const bottomTabs:{tab:Tab;icon:string;label:string}[]=[
    {tab:'Modelo',icon:'◇',label:'Modelo'},
    {tab:'Cargas',icon:'↓',label:'Cargas'},
    {tab:'Resultados',icon:'▥',label:'Resultados'},
    {tab:'EC2',icon:'EC2',label:'EC2'},
    {tab:'Pormenorização',icon:'▦',label:'Pormenorização'},
    {tab:'Relatório',icon:'▤',label:'Relatório'},
    {tab:'Definições',icon:'⚙',label:'Definições'}
  ]

  return <div className={`app mockupApp ${ui.highContrast?'highContrast':''} ${ui.largeTargets?'largeTargets':''}`}>
    <header className="topHeader">
      <div className="brandBlock"><img src="./icons/ic_launcher.png" alt="RJP Structures"/><div><b>RJP Structures</b><span>ANALISAR · DIMENSIONAR · PORMENORIZAR</span></div></div>
      <div className="topActions">
        <button onClick={resetProject}><span>＋</span>Novo</button>
        <label className="topFileAction"><span>↥</span>Abrir<input type="file" accept="application/json" onChange={importProject}/></label>
        <button onClick={saveProject}><span>▣</span>Guardar</button>
        <button onClick={()=>setTab('Resultados')}><span>∑</span>Calcular</button>
        <button onClick={()=>setTab('Relatório')}><span>▤</span>Relatório</button>
      </div>
    </header>

    <div className="modelStrip">
      <div className="modelSelect"><span>Tipo de modelo</span><select value={mode} onChange={(e:ChangeEvent<HTMLSelectElement>)=>{setMode(e.target.value as Mode);setSelected(1);setTab('Modelo');setZoom(1);setBarDraft(null)}}>{(['Viga','Pórtico 2D','Treliça 2D'] as Mode[]).map(m=><option key={m}>{m}</option>)}</select></div>
      <div className="projectTitle"><input className="projectNameInput" value={projectName} onChange={(e:any)=>setProjectName(e.target.value)} aria-label="Nome do projeto"/><span>EC2 · MEF 2D · Português de Portugal</span></div>
      <div className="historyActions" aria-label="Histórico de edição"><button onClick={undo} disabled={!history.length} title="Desfazer (Ctrl+Z)">↶</button><button onClick={redo} disabled={!future.length} title="Refazer (Ctrl+Y)">↷</button></div>
      <div className="autosavePill" title={lastAutoSave?`Última gravação automática: ${new Date(lastAutoSave).toLocaleString('pt-PT')}`:'Ainda sem gravação automática'}>● {lastAutoSave?`Auto ${new Date(lastAutoSave).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}`:'Auto…'}</div><div className="versionPill">V1.7.7</div>
    </div>

    <main className={`studioLayout ${panelCollapsed?'panelCollapsed':''} ${focusMode?'focusMode':''}`}>
      <aside className="leftToolbar" aria-label="Ferramentas de desenho">
        {(['Selecionar','Nó','Barra','Apoio','Carga','Mover','Apagar'] as Tool[]).map(t=><button key={t} className={tool===t?'active':''} onClick={()=>{setTool(t);if(t!=='Barra')setBarDraft(null)}} title={t}><span className="toolIcon">{toolIcons[t]}</span><small>{t}</small></button>)}
      </aside>

      <section className="workspace mockupWorkspace">
        <div className="canvasHeader">
          <div className="canvasTitle"><strong>{mode}</strong><span>{model.elements.length?` · Elemento selecionado: B${selected}`:' · Modelo em construção'}</span></div>
          <div className="canvasControls">
            <div className="resultSwitch">{(['N','V','M','Deformada'] as CanvasResult[]).map(r=><button key={r} className={canvasResult===r?'active':''} onClick={()=>setCanvasResult(r)}>{r}</button>)}</div>
            <div className="viewportTools">
              <button className={showGrid?'active':''} onClick={()=>setShowGrid(v=>!v)} title="Mostrar/ocultar grelha">Grelha</button>
              <button className={showLabels?'active':''} onClick={()=>setShowLabels(v=>!v)} title="Mostrar/ocultar identificações">Rótulos</button>
              <button className={showNodes?'active':''} onClick={()=>setShowNodes(v=>!v)} title="Mostrar/ocultar nós">Nós</button>
              <button className={showLoads?'active':''} onClick={()=>setShowLoads(v=>!v)} title="Mostrar/ocultar ações">Ações</button>
              <span className="toolDivider"/>
              <button onClick={()=>setZoom(z=>clamp(z-.1,.7,2))} title="Reduzir">−</button><span className="zoomReadout">{fmt(zoom*100,0)}%</span><button onClick={()=>setZoom(z=>clamp(z+.1,.7,2))} title="Ampliar">＋</button>
              <button onClick={()=>setZoom(1)} title="Ajustar ao modelo">Ajustar</button>
              <button className={focusMode?'active':''} onClick={()=>setFocusMode(v=>!v)} title="Modo de concentração">{focusMode?'Sair':'Foco'}</button>
            </div>
          </div>
        </div>
        <ModelView model={model} result={result} selected={selected} setSelected={setSelected} diagram={canvasResult} zoom={zoom} setZoom={setZoom} showGrid={showGrid} showLabels={showLabels} showLoads={showLoads} showNodes={showNodes} tool={tool} barDraft={barDraft} onCanvasPoint={handleCanvasPoint} onDeleteSupport={deleteSupport} onDeleteNodalLoad={deleteNodalLoad} onDeleteMemberLoad={deleteMemberLoad} onOpenSupport={openSupportEditor} onOpenNodalLoad={openNodalEditor} onOpenMemberLoad={openMemberEditor} onDeleteElement={deleteElement} onDeleteNode={deleteNode} onMoveNode={moveNode}/>
        <div className="canvasStatus"><span><b>Ferramenta:</b> {tool}</span>{tool==='Apagar'&&<span className="deleteHint"><b>Apagar:</b> toque numa barra, força, momento, ação de barra ou apoio</span>}{tool==='Apoio'&&<span className="editHint"><b>Apoio:</b> toque num nó ou numa zona vazia para criar</span>}{tool==='Barra'&&<span className="editHint"><b>Barra:</b> {barDraft===null?'toque no ponto inicial':'toque no ponto final · linha azul = pré-visualização'}</span>}{tool==='Nó'&&<span className="editHint"><b>Nó:</b> toque na grelha para criar</span>}{tool==='Carga'&&<span className="editHint"><b>Carga:</b> toque num nó ou numa barra</span>}<span><b>Nós:</b> {model.nodes.length}</span><span><b>Barras:</b> {model.elements.length}</span><span><b>Zoom:</b> {fmt(zoom*100,0)}%</span><span><b>Cálculo:</b> {analysis.ok?'atualizado automaticamente':'verificar modelo'}</span></div>
        <div className="quickResults">
          <div><span>MEd</span><b>{isTruss?'—':`${fmt(med)} kNm`}</b></div>
          <div><span>VEd</span><b>{isTruss?'—':`${fmt(ved)} kN`}</b></div>
          <div><span>NEd</span><b>{`${fmt(ned)} kN`}</b></div>
          <div><span>As,inf</span><b>{bottomBars?`${fmt(bottomBars.area,0)} mm²`:'—'}</b></div>
          <div><span>As,sup</span><b>{topBars?`${fmt(topBars.area,0)} mm²`:'—'}</b></div>
          <div><span>Estribos</span><b>{beamFinal?endStLabel:'—'}</b></div>
          <div><span>Fissuração</span><b className={beamFinal?.checks.some(c=>c.id.includes('crack')&&c.status==='FAIL')?'bad':'good'}>{beamFinal?`${fmt(beamFinal.crack.wk,3)} mm`:'—'}</b></div>
          <div><span>Estado</span><b className={overallClass}>{overallState}</b></div>
        </div>
      </section>

      <aside className={`propertiesPanel ${panelCollapsed?'collapsed':''}`}>
        <div className="panelTitle"><div><h2>Propriedades</h2><span>{el?`${isTruss?'Barra de treliça':isColumn?'Pilar':'Viga'} B${selected}`:'Modelo sem barra selecionada'}</span></div><button className="collapseButton" onClick={()=>setPanelCollapsed(v=>!v)} title={panelCollapsed?'Abrir painel de propriedades':'Recolher painel de propriedades'}>{panelCollapsed?'‹':'›'}</button></div>

        <div className="selectedSummary">
          <div><span>Comprimento</span><b>{fmt(length)} m</b></div>
          <div><span>Secção</span><b>{sec?`${sec.b} × ${sec.h} mm`:`A = ${fmt(el?.A,0)} mm²`}</b></div>
          {el&&el.kind!=='truss'&&<div><span>Ligações</span><b>{el.releaseStartR?'Rótula':'Rígida'} / {el.releaseEndR?'Rótula':'Rígida'}</b></div>}
        </div>

        {tab==='Modelo'&&<>
          <h3>Geometria do modelo</h3>
          {mode==='Viga'&&<div className="fields singleColumn"><NumInput label="Vão total" value={settings.beamSpan} onChange={v=>set('beamSpan',v)} unit="m" step={0.1} min={1}/><NumInput label="Largura b" value={settings.beamB} onChange={v=>set('beamB',v)} unit="mm" step={10} min={100}/><NumInput label="Altura h" value={settings.beamH} onChange={v=>set('beamH',v)} unit="mm" step={10} min={150}/></div>}
          {mode==='Pórtico 2D'&&<div className="fields singleColumn"><NumInput label="Vão" value={settings.frameWidth} onChange={v=>set('frameWidth',v)} unit="m" step={0.1} min={1}/><NumInput label="Altura" value={settings.frameHeight} onChange={v=>set('frameHeight',v)} unit="m" step={0.1} min={1}/><NumInput label="Viga b" value={settings.beamB} onChange={v=>set('beamB',v)} unit="mm" step={10} min={100}/><NumInput label="Viga h" value={settings.beamH} onChange={v=>set('beamH',v)} unit="mm" step={10} min={150}/><NumInput label="Pilar b" value={settings.colB} onChange={v=>set('colB',v)} unit="mm" step={10} min={150}/><NumInput label="Pilar h" value={settings.colH} onChange={v=>set('colH',v)} unit="mm" step={10} min={150}/></div>}
          {mode==='Treliça 2D'&&<div className="fields singleColumn"><NumInput label="Vão" value={settings.trussSpan} onChange={v=>set('trussSpan',v)} unit="m" step={0.1} min={1}/><NumInput label="Altura" value={settings.trussHeight} onChange={v=>set('trussHeight',v)} unit="m" step={0.1} min={.5}/><NumInput label="Área da barra" value={settings.trussA} onChange={v=>set('trussA',v)} unit="mm²" step={100} min={100}/></div>}
          {el&&el.kind!=='truss'&&<div className="card compact connectionCard"><b>Ligações da barra B{el.id}</b><p>As barras são criadas <b>rígidas por defeito</b>. Um nó MEF é apenas um ponto de ligação; não é uma rótula. Só existe rótula quando a ativares aqui.</p><div className="connectionRow"><span>Início · N{el.n1}</span><div className="segmented"><button className={!el.releaseStartR?'active':''} onClick={()=>setElementRelease(el.id,'start',false)}>Rígida</button><button className={el.releaseStartR?'active dangerChoice':''} onClick={()=>setElementRelease(el.id,'start',true)}>Rótula</button></div></div><div className="connectionRow"><span>Fim · N{el.n2}</span><div className="segmented"><button className={!el.releaseEndR?'active':''} onClick={()=>setElementRelease(el.id,'end',false)}>Rígida</button><button className={el.releaseEndR?'active dangerChoice':''} onClick={()=>setElementRelease(el.id,'end',true)}>Rótula</button></div></div></div>}
          <div className="card info compact"><b>Editor gráfico V1.7.7 {freeModel?'· modelo livre':'· modelo paramétrico'}</b><p>Em <b>Barra</b>, toque no início e no fim: a pré-visualização azul acompanha o cursor/dedo e os nós MEF são criados automaticamente, com <b>ligação rígida</b> por defeito. Em <b>Apoio</b>, toque num ponto ou nó e escolha o tipo. Em <b>Carga</b>, toque diretamente num nó ou barra e use o editor visual. Em <b>Mover</b>, arraste um nó.</p></div>
        </>}

        {tab==='Cargas'&&<>
          <h3>Ações aplicadas</h3>
          {!freeModel&&mode==='Viga'&&<div className="fields singleColumn"><NumInput label="Carga base distribuída q" value={settings.beamQ} onChange={v=>set('beamQ',v)} unit="kN/m" step={0.5} min={0}/><NumInput label="Carga base concentrada P" value={settings.beamP} onChange={v=>set('beamP',v)} unit="kN" step={1} min={0}/></div>}
          {!freeModel&&mode==='Pórtico 2D'&&<div className="fields singleColumn"><NumInput label="Carga base distribuída na viga" value={settings.frameQ} onChange={v=>set('frameQ',v)} unit="kN/m" step={0.5} min={0}/><NumInput label="Ação horizontal base" value={settings.frameHLoad} onChange={v=>set('frameHLoad',v)} unit="kN" step={1} min={0}/></div>}
          {!freeModel&&mode==='Treliça 2D'&&<div className="fields singleColumn"><NumInput label="Carga vertical base P" value={settings.trussP} onChange={v=>set('trussP',v)} unit="kN" step={1} min={0}/></div>}
          <div className="card compact actionComposer">
            <b>Ações na barra selecionada {el?`B${el.id}`:''}</b>
            {el?<><p>Podes combinar várias ações na mesma barra. Os valores são definidos nos eixos locais do elemento; usa sinal negativo para cargas transversais para baixo numa viga horizontal.</p>
              <div className="actionButtons">
                <button onClick={()=>addMemberLoad(el.id,'point')}>＋ Concentrada</button>
                {el.kind!=='truss'&&<><button onClick={()=>addMemberLoad(el.id,'uniform')}>＋ Uniforme</button><button onClick={()=>addMemberLoad(el.id,'triangular')}>＋ Triangular</button><button onClick={()=>addMemberLoad(el.id,'trapezoidal')}>＋ Trapezoidal</button><button onClick={()=>addMemberLoad(el.id,'moment')}>＋ Momento</button></>}
              </div>
              <div className="actionList">{selectedMemberLoads.length?selectedMemberLoads.map((l,i)=><div className="actionRow" key={l.id}><div><strong>A{i+1} · {actionTypeName(l.type)}</strong><span>{actionSummary(l)}</span></div><div><button className="miniButton" onClick={()=>editMemberLoad(el.id,l.id)}>Editar</button><button className="miniButton dangerButton" onClick={()=>deleteMemberLoad(el.id,l.id)}>Apagar</button></div></div>):<p className="smallHint">A barra não tem ações próprias.</p>}</div>
              {selectedMemberLoads.length>0&&<button className="secondary inlineAction" onClick={clearSelectedMemberLoads}>Apagar todas as ações da barra</button>}
            </>:<p>Selecione uma barra para adicionar ações.</p>}
          </div>
          <div className="card compact"><b>Ações nodais e apoios</b><p>Com a ferramenta <b>Carga</b>, toque num nó para introduzir <b>Fx, Fy e Mz</b>. Se tocar numa barra, pode adicionar uma nova ação. Com <b>Apagar</b>, elimina diretamente uma força, um momento, uma ação de barra ou um apoio.</p><button className="secondary inlineAction" onClick={restoreModeLoadsAndSupports}>Repor ações e apoios do modelo</button></div>
        </>}

        {tab==='Resultados'&&<>
          <h3>Resultados MEF</h3>
          {!analysis.ok?<div className="card danger">{'error' in analysis?analysis.error:'Erro de cálculo.'}</div>:member?<><div className="card compact"><b>B{selected} · valores críticos</b><p>|N|max = {fmt(ned)} kN em x≈{fmt(critN.x)} m</p>{!isTruss&&<><p>|V|max = {fmt(ved)} kN em x≈{fmt(critV.x)} m</p><p>|M|max = {fmt(med)} kNm em x≈{fmt(critM.x)} m</p></>}</div><Diagram member={member} kind="N"/>{!isTruss&&<><Diagram member={member} kind="V"/><Diagram member={member} kind="M"/></>}<div className="card compact"><b>Reações de apoio</b>{model.nodes.map(n=>{const i=nodeIndex.get(n.id)!;return <p key={n.id}>N{n.id}: Rx {fmt(analysis.data.R[3*i]/1000)} · Ry {fmt(analysis.data.R[3*i+1]/1000)} kN · Mz {fmt(analysis.data.R[3*i+2]/1e6)} kNm</p>})}</div></>:<div className="card">Selecione um elemento.</div>}
        </>}

        {tab==='EC2'&&<>
          <h3>Verificações EC2</h3>
          {sec?<><div className="summary"><span className="ok">{ok} cumpre</span><span className="fail">{fail} não cumpre</span><span className="warn">{warn} verificar</span><span className="na">{na} não verificado</span></div>{beamFinal&&<><div className="card compact"><b>Dimensionamento da viga</b><p>M+ = {fmt(moments.positive)} · M− = {fmt(moments.negative)} kNm</p><p>Inferior: {bottomBars?`${bottomBars.n}Ø${bottomBars.phi} = ${fmt(bottomBars.area,0)} mm²`:'—'}</p><p>Superior: {topBars?`${topBars.n}Ø${topBars.phi} = ${fmt(topBars.area,0)} mm²`:'—'}</p><p>Estribos apoio: {endStLabel}</p><p>Estribos vão: {midStLabel}</p><p>wk = {fmt(beamFinal.crack.wk,3)} mm · δ = {fmt(beamFinal.deflection.delta,2)} mm</p><p>lbd = {fmt(beamFinal.anchorage.lbd,0)} mm · l0 = {fmt(beamFinal.anchorage.l0,0)} mm</p></div><Checks checks={beamFinal.checks}/></>}{col&&<><div className="card compact"><b>Dimensionamento do pilar</b><p>NEd = {fmt(ned)} kN · MEd = {fmt(col.MEd)} kNm</p><p>Armadura: {colBars?`${colBars.n}Ø${colBars.phi} = ${fmt(colBars.area,0)} mm²`:'—'}</p><p>λ = {fmt(col.lambda,1)} · λlim = {fmt(col.lambdaLim,1)}</p><p>Interação N-M = {fmt(col.interaction*100,0)}%</p><p>Cintas: Ø8/{fmt(col.tieSpacing,0)} mm</p></div><Checks checks={col.checks}/></>}</>:<div className="card">O EC2 aplica-se aos elementos de betão armado.</div>}
          <details className="ec2Modules"><summary>Módulos adicionais EC2</summary><div className="card compact"><b>Laje · faixa de 1 m</b><p>As,req = {fmt(slab.flex.AsReq,0)} mm²/m · wk = {fmt(slab.crack.wk,3)} mm</p></div><div className="card compact"><b>Punçoamento</b><p>u1 = {fmt(punch.u1,0)} mm · vEd = {fmt(punch.vEd,3)} MPa · vRd,c = {fmt(punch.vRdc,3)} MPa</p></div><div className="card compact"><b>Sapata isolada</b><p>qEd = {fmt(footing.qEd,1)} kN/m² · Mx = {fmt(footing.Mx,1)} kNm · My = {fmt(footing.My,1)} kNm</p></div><div className="card compact"><b>Fadiga e incêndio</b><p>Fadiga: {statusLabel(fatigue.checks[0].status)}</p><p>Incêndio R60: {fire?statusLabel(fire.check.status):'—'}</p></div></details>
        </>}

        {tab==='Pormenorização'&&<>
          <h3>Peça desenhada</h3>
          {sec&&beamFinal&&!isColumn&&bottomBars&&topBars?<><BeamElevation L={length} bottom={bottomBars} top={topBars} endSt={endStLabel} midSt={midStLabel} zone={zone}/><RebarSection b={sec.b} h={sec.h} cover={sec.cover} bottom={bottomBars} top={topBars}/><div className="card compact"><p><b>Inferior:</b> {bottomBars.n}Ø{bottomBars.phi}</p><p><b>Superior:</b> {topBars.n}Ø{topBars.phi}</p><p><b>Estribos:</b> {endStLabel} nos apoios; {midStLabel} no vão</p><p><b>Recobrimento:</b> {sec.cover} mm</p></div><RebarSchedule rows={beamSchedule}/></>:sec&&col&&colBars?<><ColumnSketch b={sec.b} h={sec.h} cover={sec.cover} bars={{phi:colBars.phi,n:colBars.n}} tieSpacing={col.tieSpacing}/><div className="card compact"><p><b>Longitudinal:</b> {colBars.n}Ø{colBars.phi} = {fmt(colBars.area,0)} mm²</p><p><b>Cintas:</b> Ø8/{fmt(col.tieSpacing,0)} mm</p><p><b>2.ª ordem:</b> {col.secondOrderRequired?'considerada':'dispensada pelo critério de esbelteza'}</p></div><RebarSchedule rows={columnSchedule}/></>:<div className="card">Pormenorização automática disponível para peças de betão.</div>}
        </>}

        {tab==='Relatório'&&<>
          <h3>Relatório de cálculo</h3><div className="card report"><div className="reportHeading"><div><b>{projectName}</b><span>RJP Structures V1.7.7 · Elemento B{selected}</span></div><strong className={overallClass}>{overallState}</strong></div><p><b>Modelo:</b> {mode} · <b>Tipo:</b> {isTruss?'Treliça':isColumn?'Pilar':'Viga'}</p>{el&&el.kind!=='truss'&&<p><b>Ligações da barra:</b> início {el.releaseStartR?'rótula':'rígida'} · fim {el.releaseEndR?'rótula':'rígida'}</p>}<p><b>Materiais:</b> {sec?`C${settings.fck} · aço fyk ${settings.fyk} MPa · exposição ${settings.exposure}`:'barra axial'}</p>{sec&&<p><b>Secção:</b> {sec.b} × {sec.h} mm · <b>Recobrimento:</b> {sec.cover} mm</p>}<p><b>Esforços críticos:</b> NEd {fmt(ned)} kN{!isTruss&&` · VEd ${fmt(ved)} kN · MEd ${fmt(med)} kNm`}</p>{selectedSchedule.length>0&&<p><b>Aço estimado da peça:</b> {fmt(steelTotal,2)} kg</p>}<hr/>{checks.length?checks.map(c=><p key={c.id}><b>{c.title}:</b> {statusLabel(c.status)} {c.utilization!==undefined&&Number.isFinite(c.utilization)?`(${fmt(c.utilization*100,0)}%)`:''}</p>):<p>Não existem verificações EC2 aplicáveis a este elemento.</p>}<button className="printBtn" onClick={()=>window.print()}>Imprimir / Guardar como PDF</button></div><div className="card warning"><b>Validação do projeto</b><p>Confirmar edição do EC2, Anexo Nacional, combinações, classe estrutural, exposição e hipóteses adotadas antes da utilização em projeto de execução.</p></div>
        </>}

        {tab==='Definições'&&<>
          <h3>Materiais e durabilidade</h3>
          {!isTruss&&<div className="fields singleColumn"><NumInput label="Resistência característica do betão fck" value={settings.fck} onChange={v=>set('fck',v)} unit="MPa" min={12}/><NumInput label="Tensão de cedência do aço fyk" value={settings.fyk} onChange={v=>set('fyk',v)} unit="MPa" min={200}/><NumInput label="Recobrimento" value={settings.cover} onChange={v=>set('cover',v)} unit="mm" min={10}/><NumInput label="cot θ" value={settings.cotTheta} onChange={v=>set('cotTheta',clamp(v,1,2.5))} step={0.1} min={1}/><label className="field"><span>Classe de exposição</span><select value={settings.exposure} onChange={(e:ChangeEvent<HTMLSelectElement>)=>commitSettings({...settings,exposure:e.target.value as ExposureClass})}>{(['X0','XC1','XC2','XC3','XC4','XD1','XD2','XD3','XS1','XS2','XS3'] as ExposureClass[]).map(x=><option key={x}>{x}</option>)}</select></label></div>}
          <h3>Acessibilidade</h3>
          <div className="card compact accessibilityCard">
            <label className="field"><span>Tamanho do texto da interface</span><select value={ui.fontScale} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setUi(v=>({...v,fontScale:Number(e.target.value)}))}><option value={0.9}>Pequeno — 90%</option><option value={1}>Normal — 100%</option><option value={1.15}>Grande — 115%</option><option value={1.3}>Muito grande — 130%</option><option value={1.45}>Extra grande — 145%</option></select></label>
            <label className="field"><span>Texto do desenho técnico</span><select value={ui.canvasTextScale} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setUi(v=>({...v,canvasTextScale:Number(e.target.value)}))}><option value={0.9}>90%</option><option value={1}>100%</option><option value={1.15}>115%</option><option value={1.3}>130%</option></select></label>
            <label className="toggleRow"><input type="checkbox" checked={ui.highContrast} onChange={e=>setUi(v=>({...v,highContrast:e.target.checked}))}/><span>Contraste reforçado</span></label>
            <label className="toggleRow"><input type="checkbox" checked={ui.largeTargets} onChange={e=>setUi(v=>({...v,largeTargets:e.target.checked}))}/><span>Botões e áreas de toque maiores</span></label>
          </div>
          <h3>Visualização e atalhos</h3><div className="card compact"><p><b>Grelha:</b> {showGrid?'visível':'oculta'} · <b>Rótulos:</b> {showLabels?'visíveis':'ocultos'} · <b>Ações:</b> {showLoads?'visíveis':'ocultas'}</p><p><b>Atalhos:</b> Ctrl+Z desfazer · Ctrl+Y refazer · Ctrl+S guardar · Esc sair do modo Foco.</p></div>
          <h3>WebApp</h3><div className="card compact webAppCard"><b>{webAppInstalled?'WebApp instalada':'Instalação no dispositivo'}</b><p>{webAppInstalled?'A RJP Structures está a correr como aplicação instalada. Os projetos continuam guardados localmente neste dispositivo.':'Podes instalar esta versão no computador, tablet ou telemóvel diretamente a partir do navegador. Depois da primeira utilização online, os ficheiros essenciais ficam disponíveis offline.'}</p>{installPrompt&&!webAppInstalled&&<button className="inlineAction" onClick={installWebApp}>Instalar RJP Structures</button>} {!installPrompt&&!webAppInstalled&&<p className="smallHint">Se o botão não aparecer, usa o menu do navegador e escolhe “Instalar aplicação” ou “Adicionar ao ecrã principal”, quando disponível.</p>}</div>
          <h3>Projeto e segurança</h3><div className="card compact autosaveCard"><b>Gravação automática</b><p>{lastAutoSave?`Última cópia: ${new Date(lastAutoSave).toLocaleString('pt-PT')}`:'A primeira cópia será criada após uma alteração.'}</p><button className="secondary inlineAction" onClick={recoverAutosave}>Recuperar última cópia automática</button></div><div className="projectActions"><button onClick={saveProject}>Guardar localmente</button><button onClick={exportProject}>Exportar projeto JSON</button><label className="fileBtn">Importar projeto JSON<input type="file" accept="application/json" onChange={importProject}/></label><button className="secondary" onClick={resetProject}>Repor exemplo</button></div>
        </>}
      </aside>
    </main>

    {editorDialog?.kind==='support'&&<div className="modalBackdrop editorBackdrop" onPointerDown={()=>setEditorDialog(null)}><div className="quickEditor" onPointerDown={e=>e.stopPropagation()}><div className="dialogHeader"><div><h2>Apoio · N{editorDialog.nodeId}</h2><p>Escolha o vínculo. A alteração é imediata.</p></div><button onClick={()=>setEditorDialog(null)}>×</button></div><div className="supportChoices"><button onClick={()=>{setSupportState(editorDialog.nodeId,false,false,false);setEditorDialog(null)}}>○<b>Livre</b><span>Sem restrições</span></button><button onClick={()=>{setSupportState(editorDialog.nodeId,false,true,false);setEditorDialog(null)}}>◉<b>Móvel Y</b><span>Restringe Y</span></button><button onClick={()=>{setSupportState(editorDialog.nodeId,true,false,false);setEditorDialog(null)}}>◉<b>Móvel X</b><span>Restringe X</span></button><button onClick={()=>{setSupportState(editorDialog.nodeId,true,true,false);setEditorDialog(null)}}>△<b>Articulado</b><span>Restringe X e Y</span></button><button onClick={()=>{setSupportState(editorDialog.nodeId,true,true,true);setEditorDialog(null)}}>▣<b>Encastrado</b><span>X, Y e rotação</span></button></div></div></div>}
    {editorDialog?.kind==='nodal'&&<div className="modalBackdrop editorBackdrop" onPointerDown={()=>setEditorDialog(null)}><div className="quickEditor" onPointerDown={e=>e.stopPropagation()}><div className="dialogHeader"><div><h2>Ações no nó N{editorDialog.nodeId}</h2><p>Valores globais. Positivo: +X, +Y e momento anti-horário.</p></div><button onClick={()=>setEditorDialog(null)}>×</button></div><div className="editorFields"><NumInput label="Fx" value={nodalForm.fx} onChange={v=>setNodalForm(f=>({...f,fx:v}))} unit="kN" step={1}/><NumInput label="Fy" value={nodalForm.fy} onChange={v=>setNodalForm(f=>({...f,fy:v}))} unit="kN" step={1}/><NumInput label="Mz" value={nodalForm.mz} onChange={v=>setNodalForm(f=>({...f,mz:v}))} unit="kNm" step={1}/></div><div className="dialogActions"><button className="secondary" onClick={()=>setNodalForm({fx:0,fy:0,mz:0})}>Limpar</button><button className="secondary" onClick={()=>setEditorDialog(null)}>Cancelar</button><button className="primary" onClick={saveNodalEditor}>Aplicar</button></div></div></div>}
    {editorDialog?.kind==='member'&&<div className="modalBackdrop editorBackdrop" onPointerDown={()=>setEditorDialog(null)}><div className="quickEditor memberEditor" onPointerDown={e=>e.stopPropagation()}><div className="dialogHeader"><div><h2>{editorDialog.loadId?'Editar ação':'Nova ação'} · B{editorDialog.elementId}</h2><p>Escolha o tipo e introduza os valores sem sair do desenho.</p></div><button onClick={()=>setEditorDialog(null)}>×</button></div><div className="loadTypeGrid">{([['point','Força concentrada'],['uniform','Distribuída uniforme'],['triangular','Triangular'],['trapezoidal','Trapezoidal'],['moment','Momento']] as [MemberLoadType,string][]).map(([t,label])=><button key={t} disabled={model.elements.find(e=>e.id===editorDialog.elementId)?.kind==='truss'&&t!=='point'} className={memberForm.type===t?'active':''} onClick={()=>setMemberForm(f=>({...f,type:t}))}>{label}</button>)}</div>{memberForm.type==='point'&&<div className="editorFields"><label className="field"><span>Direção</span><select value={memberForm.axis} onChange={e=>setMemberForm(f=>({...f,axis:e.target.value as 'localY'|'localX'}))}><option value="localY">Transversal · eixo local Y</option><option value="localX">Axial · eixo local X</option></select></label><NumInput label="P" value={memberForm.P} onChange={v=>setMemberForm(f=>({...f,P:v}))} unit="kN" step={1}/><NumInput label="Posição x" value={memberForm.x} onChange={v=>setMemberForm(f=>({...f,x:v}))} unit="m" step={0.1} min={0}/></div>}{memberForm.type==='moment'&&<div className="editorFields"><NumInput label="Momento M" value={memberForm.M} onChange={v=>setMemberForm(f=>({...f,M:v}))} unit="kNm" step={1}/><NumInput label="Posição x" value={memberForm.x} onChange={v=>setMemberForm(f=>({...f,x:v}))} unit="m" step={0.1} min={0}/></div>}{(memberForm.type==='uniform'||memberForm.type==='triangular'||memberForm.type==='trapezoidal')&&<div className="editorFields"><NumInput label="Início x1" value={memberForm.x1} onChange={v=>setMemberForm(f=>({...f,x1:v}))} unit="m" step={0.1} min={0}/><NumInput label="Fim x2" value={memberForm.x2} onChange={v=>setMemberForm(f=>({...f,x2:v}))} unit="m" step={0.1} min={0}/><NumInput label={memberForm.type==='uniform'?'q':'q1'} value={memberForm.q1} onChange={v=>setMemberForm(f=>({...f,q1:v}))} unit="kN/m" step={0.5}/>{memberForm.type!=='uniform'&&<NumInput label="q2" value={memberForm.q2} onChange={v=>setMemberForm(f=>({...f,q2:v}))} unit="kN/m" step={0.5}/>}</div>}<div className="signHint">Sinais: para uma viga horizontal, carga vertical para baixo = valor negativo. Momento positivo = anti-horário.</div><div className="dialogActions"><button className="secondary" onClick={()=>setEditorDialog(null)}>Cancelar</button><button className="primary" onClick={saveMemberEditor}>Aplicar ação</button></div></div></div>}
    {newProjectOpen&&<div className="modalBackdrop" onClick={()=>setNewProjectOpen(false)}>
      <div className="newModelDialog" onClick={e=>e.stopPropagation()}>
        <div className="dialogHeader"><div><h2>Novo modelo</h2><p>Escolha como pretende começar o modelo estrutural.</p></div><button onClick={()=>setNewProjectOpen(false)} aria-label="Fechar">×</button></div>
        <label className="dialogField"><span>Tipo estrutural</span><select value={newMode} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setNewMode(e.target.value as Mode)}>{(['Viga','Pórtico 2D','Treliça 2D'] as Mode[]).map(m=><option key={m}>{m}</option>)}</select></label>
        <div className="starterGrid">
          {([
            ['Padrão','Modelo padrão','Geometria completa de exemplo, pronta a calcular.'],
            ['Em branco','Em branco','Começa apenas com a grelha.'],
            ['Apoios','Começar por apoios','Dois apoios iniciais, sem barras.'],
            ['Barra','Barra rígida sem nós visíveis','Uma barra rígida; os nós MEF internos ficam ocultos.'],
            ['Barra + nós','Barra rígida com nós','Uma barra rígida com os nós extremos visíveis.'],
            ['Nós','Começar por nós','Dois nós livres, sem barras nem apoios.']
          ] as [StartPreset,string,string][]).map(([id,title,desc])=><button key={id} className={`starterCard ${newPreset===id?'active':''}`} onClick={()=>setNewPreset(id)}><b>{title}</b><span>{desc}</span></button>)}
        </div>
        <div className="dialogNote"><b>Nota técnica:</b> uma barra necessita sempre de nós para o cálculo MEF, mas <b>nó não significa rótula</b>. As barras de pórtico/viga são rígidas nos extremos por defeito. A rótula é uma libertação rotacional opcional e é mostrada por um círculo branco com a letra R.</div>
        <div className="dialogActions"><button className="secondary" onClick={()=>setNewProjectOpen(false)}>Cancelar</button><button className="primary" onClick={createNewProject}>Criar modelo</button></div>
      </div>
    </div>}

    <nav className="bottomNav">{bottomTabs.map(x=><button key={x.tab} className={tab===x.tab?'active':''} onClick={()=>setTab(x.tab)}><span>{x.icon}</span><small>{x.label}</small></button>)}</nav>
    <footer>RJP Structures V1.7.7 · WebApp + Android · Português de Portugal · MEF 2D · Betão Armado EC2 · acessibilidade · gravação automática · editor gráfico</footer>
  </div>
}
