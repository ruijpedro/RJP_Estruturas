import {ChangeEvent,useEffect,useMemo,useState} from 'react'
import {Element2D,FrameResult,MemberLoad,MemberResult,Model2D,Node2D,solveFrame} from './structural'
import {
  beamEC2,chooseBarsEC2,chooseColumnBarsEC2,chooseStirrupsEC2,columnEC2,concreteProps,EC2Check,
  ExposureClass,firePrecheck,footingEC2,slabEC2,punchingEC2,fatigueQuickCheck
} from './ec2'

type Mode='Viga'|'Pórtico 2D'|'Treliça 2D'
type Tab='Modelo'|'Cargas'|'Resultados'|'EC2'|'Pormenorização'|'Relatório'|'Definições'
type AnalysisState={ok:true;data:FrameResult}|{ok:false;error:string}
type Tool='Selecionar'|'Nó'|'Barra'|'Rótula'|'Apoio'|'Carga'|'Mover'|'Apagar'
type CanvasResult='Deformada'|'N'|'V'|'M'
type MemberLoadEditorKind='pointY'|'pointX'|'moment'|'uniform'|'triGrow'|'triDrop'|'trapezoid'
type MemberLoadEditorState={elementId:number;loadId?:number;kind:MemberLoadEditorKind;x:number;a:number;b:number;value:number;value2:number}
type LoadPanelTarget='node'|'member'
type LoadPanelState={target:LoadPanelTarget;nodeId:number;elementId:number;nodeComponent:LoadComponent;kind:MemberLoadEditorKind;x:number;a:number;b:number;value:number;value2:number}

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
type CustomModels=Partial<Record<Mode,Model2D>>
type ProjectFile={version:string;mode:Mode;settings:Settings;projectName?:string;edits?:EditsByMode;customModels?:CustomModels;ui?:UiSettings;savedAt?:string}

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
        {id:1,n1:1,n2:2,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,qy:-Math.abs(s.beamQ),section:beamSection},
        {id:2,n1:2,n2:3,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,qy:-Math.abs(s.beamQ),section:beamSection}
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
        {id:2,n1:2,n2:3,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,qy:-Math.abs(s.frameQ),section:beamSection},
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

function NumInput({label,value,onChange,unit,step=1,min}:{label:string;value:number;onChange:(v:number)=>void;unit?:string;step?:number;min?:number}){
  return <label className="field"><span>{label}</span><div><input type="number" value={Number.isFinite(value)?value:''} step={step} min={min} onChange={(e:ChangeEvent<HTMLInputElement>)=>{const n=Number(e.target.value);if(Number.isFinite(n))onChange(min!==undefined?Math.max(min,n):n)}}/>{unit&&<small>{unit}</small>}</div></label>
}

function ModelView({model,result,selected,setSelected,diagram,zoom,setZoom,showGrid,showLabels,showLoads,tool,pendingBarNode,onAddNode,onBarNodeClick,onDeleteElement,onDeleteNode,onToggleRelease,onMoveNode,onDeleteSupport,onDeleteNodalLoad,onDeleteDistributedLoad,onDeleteMemberLoad,onCycleSupport,onEditNodalLoad,onOpenMemberLoadEditor,onEditMemberLoad}:{model:Model2D,result:FrameResult|null,selected:number,setSelected:(n:number)=>void,diagram:CanvasResult,zoom:number,setZoom:(z:number)=>void,showGrid:boolean,showLabels:boolean,showLoads:boolean,tool:Tool,pendingBarNode:number|null,onAddNode:(x:number,y:number)=>void,onBarNodeClick:(nodeId:number)=>void,onDeleteElement:(elementId:number)=>void,onDeleteNode:(nodeId:number)=>void,onToggleRelease:(elementId:number,end:'start'|'end')=>void,onMoveNode:(nodeId:number)=>void,onDeleteSupport:(nodeId:number)=>void,onDeleteNodalLoad:(nodeId:number,component:LoadComponent)=>void,onDeleteDistributedLoad:(elementId:number)=>void,onDeleteMemberLoad:(elementId:number,loadId:number)=>void,onCycleSupport:(nodeId:number)=>void,onEditNodalLoad:(nodeId:number)=>void,onOpenMemberLoadEditor:(elementId:number)=>void,onEditMemberLoad:(elementId:number,loadId:number)=>void}){
  const W=940,H=520,pad=78
  const xs=model.nodes.map(n=>n.x),ys=model.nodes.map(n=>n.y)
  let minX=xs.length?Math.min(...xs):0,maxX=xs.length?Math.max(...xs):8,minY=ys.length?Math.min(...ys):0,maxY=ys.length?Math.max(...ys):4
  if(maxX-minX<1){const c=(minX+maxX)/2;minX=c-4;maxX=c+4}
  if(maxY-minY<1){const c=(minY+maxY)/2;minY=c-2;maxY=c+2}
  const sx=(W-2*pad)/Math.max(1,maxX-minX),sy=(H-2*pad)/Math.max(1,maxY-minY),sc=Math.min(sx,sy)
  const P=(n:Node2D)=>({x:pad+(n.x-minX)*sc,y:H-pad-(n.y-minY)*sc})
  const nodeMap=new Map(model.nodes.map((n,i)=>[n.id,{n,i}]))
  const maxTrans=result&&model.nodes.length?Math.max(0.001,...model.nodes.flatMap((_,i)=>[Math.abs(result.U[3*i]??0),Math.abs(result.U[3*i+1]??0)])):1
  const deformScale=result?Math.min(80,48/maxTrans):1
  const DP=(n:Node2D)=>{const base=P(n),i=nodeMap.get(n.id)!.i;return {x:base.x+((result?.U[3*i]??0)/1000)*sc*deformScale,y:base.y-((result?.U[3*i+1]??0)/1000)*sc*deformScale}}
  const selectedElement=model.elements.find(e=>e.id===selected)
  const selectedResult=result?.members.find(m=>m.id===selected)
  let diagramPoints='',diagramMax=0
  if(result&&selectedElement&&selectedResult&&diagram!=='Deformada'&&selectedResult.samples.length>1){
    const na=nodeMap.get(selectedElement.n1)?.n,nb=nodeMap.get(selectedElement.n2)?.n
    if(na&&nb){
      const a=P(na),b=P(nb),dx=b.x-a.x,dy=b.y-a.y,Lpx=Math.hypot(dx,dy)||1,nx=-dy/Lpx,ny=dx/Lpx
      const vals=selectedResult.samples.map(sm=>sm[diagram]);diagramMax=Math.max(1,...vals.map(v=>Math.abs(v)))
      diagramPoints=selectedResult.samples.map(sm=>{const t=selectedResult.L>0?sm.x/selectedResult.L:0,baseX=a.x+dx*t,baseY=a.y+dy*t,off=(sm[diagram]/diagramMax)*72;return `${baseX+nx*off},${baseY+ny*off}`}).join(' ')
    }
  }
  const selectedUnit=diagram==='M'?'kNm':'kN',selectedFactor=diagram==='M'?1e6:1000
  const safeZoom=clamp(zoom,.7,2),vbW=W/safeZoom,vbH=H/safeZoom,vbX=(W-vbW)/2,vbY=(H-vbH)/2
  const pointFromEvent=(e:any)=>{const svg=e.currentTarget as SVGSVGElement,rect=svg.getBoundingClientRect();const px=vbX+(e.clientX-rect.left)/Math.max(1,rect.width)*vbW,py=vbY+(e.clientY-rect.top)/Math.max(1,rect.height)*vbH;return {x:minX+(px-pad)/sc,y:minY+(H-pad-py)/sc}}
  const backgroundClick=(e:any)=>{if(tool!=='Nó')return;const pt=pointFromEvent(e);onAddNode(pt.x,pt.y)}
  const memberLoadGraphics=(e:Element2D,a:{x:number;y:number},b:{x:number;y:number},Lm:number)=>{
    if(!showLoads||!(e.loads?.length))return null
    const dx=b.x-a.x,dy=b.y-a.y,Lpx=Math.hypot(dx,dy)||1,tx=dx/Lpx,ty=dy/Lpx,nx=-ty,ny=-tx
    const pointAt=(xm:number)=>{const t=clamp(xm/Math.max(Lm,1e-9),0,1);return {x:a.x+dx*t,y:a.y+dy*t}}
    return <>{e.loads.map(load=>{
      const targetClass=tool==='Apagar'?'deleteTarget':tool==='Carga'?'editTarget':''
      const click=(ev:any)=>{ev.stopPropagation();if(tool==='Apagar')onDeleteMemberLoad(e.id,load.id);else if(tool==='Carga')onEditMemberLoad(e.id,load.id)}
      if(load.type==='point'){
        const p=pointAt(load.x),isAxial=Math.abs(load.px??0)>Math.abs(load.py??0),val=isAxial?(load.px??0):(load.py??0),sx=isAxial?tx:nx,sy=isAxial?ty:ny,sign=val>=0?1:-1,dir={x:sx*sign,y:sy*sign},tail={x:p.x-dir.x*58,y:p.y-dir.y*58}
        return <g key={`ml-${e.id}-${load.id}`} className={targetClass} onClick={click}><line x1={tail.x} y1={tail.y} x2={p.x} y2={p.y} stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={tail.x+8} y={tail.y-7} className="loadLabel">{isAxial?'Px':'Py'} = {fmt(val,1)} kN</text></g>
      }
      if(load.type==='moment'){
        const p=pointAt(load.x),r=30,clock=load.mz>=0?1:-1
        const path=clock>0?`M ${p.x-r} ${p.y} A ${r} ${r} 0 1 1 ${p.x+r*.75} ${p.y-r*.66}`:`M ${p.x+r} ${p.y} A ${r} ${r} 0 1 0 ${p.x-r*.75} ${p.y-r*.66}`
        return <g key={`ml-${e.id}-${load.id}`} className={targetClass} onClick={click}><path d={path} fill="none" stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={p.x+34} y={p.y-34} className="loadLabel">M = {fmt(load.mz,1)} kNm</text></g>
      }
      const aa=clamp(load.a,0,Lm),bb=clamp(load.b,aa,Lm),maxq=Math.max(.001,Math.abs(load.qy1),Math.abs(load.qy2)),count=9
      return <g key={`ml-${e.id}-${load.id}`} className={targetClass} onClick={click}>{Array.from({length:count}).map((_,k)=>{const t=k/(count-1),xm=aa+(bb-aa)*t,q=load.qy1+(load.qy2-load.qy1)*t,p=pointAt(xm),sign=q>=0?1:-1,dir={x:nx*sign,y:ny*sign},len=18+34*Math.abs(q)/maxq,tail={x:p.x-dir.x*len,y:p.y-dir.y*len};return <line key={k} x1={tail.x} y1={tail.y} x2={p.x} y2={p.y} stroke="#c91c23" strokeWidth="2.3" markerEnd="url(#arrowRed)"/>})}<text x={(pointAt(aa).x+pointAt(bb).x)/2} y={(pointAt(aa).y+pointAt(bb).y)/2-52} textAnchor="middle" className="loadLabel">q {fmt(load.qy1,1)} → {fmt(load.qy2,1)} kN/m</text></g>
    })}</>
  }
  return <svg className={`canvas ${tool==='Nó'?'crosshairCanvas':''}`} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} onClick={backgroundClick} onWheel={(e:any)=>{e.preventDefault();setZoom(clamp(safeZoom+(e.deltaY<0?.1:-.1),.7,2))}} aria-label="Modelo estrutural e resultados gráficos">
    <defs>
      <pattern id="gridSmall" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e7eaed" strokeWidth="1"/></pattern>
      <pattern id="gridLarge" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#gridSmall)"/><path d="M 100 0 L 0 0 0 100" fill="none" stroke="#cfd5da" strokeWidth="1.2"/></pattern>
      <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c91c23"/></marker>
    </defs>
    <rect width="100%" height="100%" fill="#fbfcfd"/>{showGrid&&<rect width="100%" height="100%" fill="url(#gridLarge)"/>}
    <g opacity=".75"><line x1="35" y1={H-35} x2="88" y2={H-35} stroke="#17324b" strokeWidth="2"/><line x1="35" y1={H-35} x2="35" y2={H-88} stroke="#17324b" strokeWidth="2"/><text x="92" y={H-30} className="axisLabel">X</text><text x="26" y={H-92} className="axisLabel">Y</text></g>
    {!model.nodes.length&&<g pointerEvents="none"><text x={W/2} y={H/2-15} textAnchor="middle" className="emptyModelTitle">Modelo em branco</text><text x={W/2} y={H/2+20} textAnchor="middle" className="emptyModelHint">Escolha “Nó” e toque na grelha para começar.</text></g>}
    {model.elements.map(e=>{const nA=nodeMap.get(e.n1)?.n,nB=nodeMap.get(e.n2)?.n;if(!nA||!nB)return null;const a=P(nA),b=P(nB),le=Math.hypot(nB.x-nA.x,nB.y-nA.y),dx=b.x-a.x,dy=b.y-a.y,Lpx=Math.hypot(dx,dy)||1,ux=dx/Lpx,uy=dy/Lpx,h1={x:a.x+ux*15,y:a.y+uy*15},h2={x:b.x-ux*15,y:b.y-uy*15};return <g key={e.id} onClick={(ev:any)=>{if(tool==='Carga'){ev.stopPropagation();onOpenMemberLoadEditor(e.id);return}if(tool==='Apagar'){ev.stopPropagation();onDeleteElement(e.id);return}ev.stopPropagation();setSelected(e.id)}} className={`clickable ${tool==='Carga'||tool==='Apagar'?'editTarget':''}`}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selected===e.id?'#1e63b5':'#263b4d'} strokeWidth={selected===e.id?10:7} strokeLinecap="round"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d8d8d8" strokeWidth={selected===e.id?6:4} strokeLinecap="round"/>
      {showLabels&&<><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-13} className="memberLabel">B{e.id}</text>{selected===e.id&&<text x={(a.x+b.x)/2} y={(a.y+b.y)/2+24} className="dimLabel">{fmt(le,2)} m</text>}</>}
      {showLoads&&!!e.qy&&<g className={tool==='Apagar'?'deleteTarget':''} onClick={(ev:any)=>{if(tool==='Apagar'){ev.stopPropagation();onDeleteDistributedLoad(e.id)}}}><line x1={a.x} y1={a.y-38} x2={b.x} y2={b.y-38} stroke="#c91c23" strokeWidth="2"/>{Array.from({length:8}).map((_,k)=>{const t=k/7,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;return <line key={k} x1={x} y1={y-38} x2={x} y2={y-8} stroke="#c91c23" strokeWidth="2" markerEnd="url(#arrowRed)"/>})}<text x={(a.x+b.x)/2} y={(a.y+b.y)/2-50} textAnchor="middle" className="loadLabel">q = {Math.abs(e.qy)} kN/m</text></g>}
      {memberLoadGraphics(e,a,b,le)}
      {(e.kind??'frame')==='frame'&&(e.releaseR1||tool==='Rótula')&&<circle cx={h1.x} cy={h1.y} r={e.releaseR1?8:10} fill={e.releaseR1?'#fff':'rgba(255,255,255,.75)'} stroke={e.releaseR1?'#a80d19':'#7c8790'} strokeWidth={e.releaseR1?3:2} strokeDasharray={e.releaseR1?undefined:'4 3'} className={tool==='Rótula'?'hingeTarget':''} onClick={(ev:any)=>{ev.stopPropagation();if(tool==='Rótula')onToggleRelease(e.id,'start')}}/>}
      {(e.kind??'frame')==='frame'&&(e.releaseR2||tool==='Rótula')&&<circle cx={h2.x} cy={h2.y} r={e.releaseR2?8:10} fill={e.releaseR2?'#fff':'rgba(255,255,255,.75)'} stroke={e.releaseR2?'#a80d19':'#7c8790'} strokeWidth={e.releaseR2?3:2} strokeDasharray={e.releaseR2?undefined:'4 3'} className={tool==='Rótula'?'hingeTarget':''} onClick={(ev:any)=>{ev.stopPropagation();if(tool==='Rótula')onToggleRelease(e.id,'end')}}/>}
    </g>})}
    {result&&diagram==='Deformada'&&model.elements.map(e=>{const na=nodeMap.get(e.n1)?.n,nb=nodeMap.get(e.n2)?.n;if(!na||!nb)return null;const a=DP(na),b=DP(nb);return <line key={`def-${e.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1476d4" strokeWidth="3" strokeDasharray="8 6" opacity=".95"/>})}
    {result&&diagram!=='Deformada'&&diagramPoints&&<><polyline points={diagramPoints} fill="none" stroke="#c91c23" strokeWidth="3.5"/><text x={W-215} y="35" className="diagramLabel">{diagram}: máx. {fmt(diagramMax/selectedFactor,2)} {selectedUnit}</text></>}
    {model.nodes.map(n=>{const pnt=P(n),hasSupport=!!(n.fixX||n.fixY||n.fixR),pending=pendingBarNode===n.id;return <g key={n.id} className={tool==='Apoio'||tool==='Carga'||tool==='Barra'||tool==='Mover'||tool==='Apagar'?'editTarget':''} onClick={(ev:any)=>{ev.stopPropagation();if(tool==='Barra'){onBarNodeClick(n.id);return}if(tool==='Apoio'){onCycleSupport(n.id);return}if(tool==='Carga'){onEditNodalLoad(n.id);return}if(tool==='Mover'){onMoveNode(n.id);return}if(tool==='Apagar'){onDeleteNode(n.id);return}}}>
      <circle cx={pnt.x} cy={pnt.y} r={pending?11:8} fill={pending?'#ffd86b':'#fff'} stroke={pending?'#a80d19':'#263b4d'} strokeWidth={pending?4:3}/>{showLabels&&<text x={pnt.x+11} y={pnt.y-11} className="nodeLabel">N{n.id}</text>}
      {hasSupport&&<g className={`${tool==='Apagar'?'deleteTarget supportTarget':''} ${tool==='Apoio'?'editTarget':''}`} onClick={(ev:any)=>{if(tool==='Apagar'){ev.stopPropagation();onDeleteSupport(n.id)}}}>{n.fixR?<><rect x={pnt.x-18} y={pnt.y+5} width="36" height="18" fill="#e8eaec" stroke="#263b4d" strokeWidth="2"/><line x1={pnt.x-25} y1={pnt.y+25} x2={pnt.x+25} y2={pnt.y+25} stroke="#263b4d" strokeWidth="4"/></>:<><path d={`M ${pnt.x-18} ${pnt.y+20} L ${pnt.x+18} ${pnt.y+20} L ${pnt.x} ${pnt.y+5} Z`} fill="#e8eaec" stroke="#263b4d" strokeWidth="2"/>{!n.fixX&&n.fixY&&<><circle cx={pnt.x-10} cy={pnt.y+25} r="3.5" fill="#fff" stroke="#263b4d" strokeWidth="1.5"/><circle cx={pnt.x+10} cy={pnt.y+25} r="3.5" fill="#fff" stroke="#263b4d" strokeWidth="1.5"/><line x1={pnt.x-24} y1={pnt.y+31} x2={pnt.x+24} y2={pnt.y+31} stroke="#263b4d" strokeWidth="2"/></>}{n.fixX&&n.fixY&&<line x1={pnt.x-24} y1={pnt.y+22} x2={pnt.x+24} y2={pnt.y+22} stroke="#263b4d" strokeWidth="2"/>}</>}</g>}
      {showLoads&&(n.fy??0)!==0&&<g className={tool==='Apagar'?'deleteTarget':''} onClick={(ev:any)=>{if(tool==='Apagar'){ev.stopPropagation();onDeleteNodalLoad(n.id,'fy')}}}><line x1={pnt.x} y1={pnt.y-70} x2={pnt.x} y2={pnt.y-18} stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={pnt.x+10} y={pnt.y-58} className="loadLabel">P = {Math.abs(n.fy??0)} kN</text></g>}
      {showLoads&&(n.fx??0)!==0&&<g className={tool==='Apagar'?'deleteTarget':''} onClick={(ev:any)=>{if(tool==='Apagar'){ev.stopPropagation();onDeleteNodalLoad(n.id,'fx')}}}><line x1={pnt.x-70} y1={pnt.y} x2={pnt.x-18} y2={pnt.y} stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={pnt.x-68} y={pnt.y-10} className="loadLabel">H = {Math.abs(n.fx??0)} kN</text></g>}
      {showLoads&&(n.mz??0)!==0&&<g className={tool==='Apagar'?'deleteTarget':''} onClick={(ev:any)=>{if(tool==='Apagar'){ev.stopPropagation();onDeleteNodalLoad(n.id,'mz')}}}><path d={`M ${pnt.x-28} ${pnt.y-28} A 28 28 0 1 1 ${pnt.x+26} ${pnt.y-8}`} fill="none" stroke="#c91c23" strokeWidth="3"/><text x={pnt.x+30} y={pnt.y-32} className="loadLabel">M = {Math.abs(n.mz??0)} kNm</text></g>}
    </g>})}
    {result&&diagram==='Deformada'&&<text x="18" y="28" className="deformLabel">Deformada ampliada ×{fmt(deformScale,1)}</text>}
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

function memberLoadDescription(load:MemberLoad){
  if(load.type==='point'){if(Math.abs(load.px??0)>Math.abs(load.py??0))return `Força axial Px ${fmt(load.px,1)} kN em x=${fmt(load.x,2)} m`;return `Força transversal Py ${fmt(load.py,1)} kN em x=${fmt(load.x,2)} m`}
  if(load.type==='moment')return `Momento ${fmt(load.mz,1)} kNm em x=${fmt(load.x,2)} m`
  const shape=Math.abs(load.qy1-load.qy2)<1e-9?'Retangular':Math.abs(load.qy1)<1e-9||Math.abs(load.qy2)<1e-9?'Triangular':'Trapezoidal'
  return `${shape} q ${fmt(load.qy1,1)} → ${fmt(load.qy2,1)} kN/m · ${fmt(load.a,2)}–${fmt(load.b,2)} m`
}

function RebarSchedule({rows}:{rows:RebarRow[]}){
  const total=rows.reduce((s,r)=>s+r.weightKg,0)
  return <div className="card"><b>Mapa de armaduras · estimativa</b><div className="tableWrap"><table><thead><tr><th>Marca</th><th>Descrição</th><th>Ø</th><th>Qtd.</th><th>L/un.</th><th>kg</th></tr></thead><tbody>{rows.map(r=><tr key={r.mark}><td>{r.mark}</td><td>{r.description}</td><td>{r.phi}</td><td>{r.qty}</td><td>{fmt(r.lengthM,2)} m</td><td>{fmt(r.weightKg,1)}</td></tr>)}</tbody><tfoot><tr><td colSpan={5}><b>Total aproximado</b></td><td><b>{fmt(total,1)} kg</b></td></tr></tfoot></table></div></div>
}

export default function App(){
  const [mode,setMode]=useState<Mode>(()=>{const saved=localStorage.getItem('rjp-structures-mode-v17')||localStorage.getItem('rjp-structures-mode-v16');return saved==='Viga'||saved==='Pórtico 2D'||saved==='Treliça 2D'?saved:'Viga'})
  const [selected,setSelected]=useState(1)
  const [tab,setTab]=useState<Tab>('Modelo')
  const [tool,setTool]=useState<Tool>('Selecionar')
  const [pendingBarNode,setPendingBarNode]=useState<number|null>(null)
  const [canvasResult,setCanvasResult]=useState<CanvasResult>('M')
  const [panelCollapsed,setPanelCollapsed]=useState(false)
  const [focusMode,setFocusMode]=useState(false)
  const [zoom,setZoom]=useState(1)
  const [showGrid,setShowGrid]=useState(true)
  const [showLabels,setShowLabels]=useState(true)
  const [showLoads,setShowLoads]=useState(true)
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
  const [customModels,setCustomModels]=useState<CustomModels>(()=>{
    try{const raw=localStorage.getItem('rjp-structures-custom-models-v172');return raw?JSON.parse(raw) as CustomModels:{}}catch{return {}}
  })
  const [loadEditor,setLoadEditor]=useState<MemberLoadEditorState|null>(null)
  const [loadPanel,setLoadPanel]=useState<LoadPanelState>({target:'member',nodeId:1,elementId:1,nodeComponent:'fy',kind:'pointY',x:0,a:0,b:0,value:-10,value2:-5})

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
  useEffect(()=>{localStorage.setItem('rjp-structures-custom-models-v172',JSON.stringify(customModels))},[customModels])
  useEffect(()=>{localStorage.setItem('rjp-structures-project-name-v17',projectName)},[projectName])
  useEffect(()=>{localStorage.setItem('rjp-structures-mode-v17',mode)},[mode])
  useEffect(()=>{localStorage.setItem('rjp-structures-ui-v17',JSON.stringify(ui));document.documentElement.style.setProperty('--ui-scale',String(ui.fontScale));document.documentElement.style.setProperty('--canvas-scale',String(ui.canvasTextScale))},[ui])
  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      const savedAt=new Date().toISOString()
      const snapshot:ProjectFile={version:'1.7.4',mode,settings,projectName,edits:modelEdits,customModels,ui,savedAt}
      localStorage.setItem('rjp-structures-autosave-v17',JSON.stringify(snapshot))
      localStorage.setItem('rjp-structures-autosave-time-v17',savedAt)
      setLastAutoSave(savedAt)
    },650)
    return()=>window.clearTimeout(timer)
  },[mode,settings,projectName,modelEdits,customModels,ui])
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
  function deleteDistributedLoad(elementId:number){
    editCurrentModel(cur=>cur.removedDistributedLoads.includes(elementId)?cur:{...cur,removedDistributedLoads:[...cur.removedDistributedLoads,elementId]})
  }
  function restoreModeLoadsAndSupports(){setModelEdits(prev=>({...prev,[mode]:emptyModelEdits()}))}
  function cycleSupport(nodeId:number){
    const node=model.nodes.find(n=>n.id===nodeId);if(!node)return
    const states=[{fixX:false,fixY:false,fixR:false},{fixX:false,fixY:true,fixR:false},{fixX:true,fixY:true,fixR:false},{fixX:true,fixY:true,fixR:true}]
    const idx=states.findIndex(x=>x.fixX===!!node.fixX&&x.fixY===!!node.fixY&&x.fixR===!!node.fixR)
    const next=states[(idx<0?0:idx+1)%states.length]
    editCurrentModel(cur=>({...cur,removedSupports:cur.removedSupports.filter(id=>id!==nodeId),supportOverrides:[...cur.supportOverrides.filter(x=>x.nodeId!==nodeId),{nodeId,...next}]}))
  }
  function editNodalLoad(nodeId:number){
    const node=model.nodes.find(n=>n.id===nodeId);if(!node)return
    const raw=window.prompt('Ações no nó em kN/kNm: Fx, Fy, Mz\nExemplo: 10, -25, 0',`${node.fx??0}, ${node.fy??0}, ${node.mz??0}`)
    if(raw===null)return
    const parts=raw.split(/[;,\s]+/).filter(Boolean).map(Number)
    if(parts.length<3||parts.some(v=>!Number.isFinite(v))){alert('Introduza três valores válidos: Fx, Fy, Mz.');return}
    const [fx,fy,mz]=parts
    editCurrentModel(cur=>({...cur,
      removedNodalLoads:cur.removedNodalLoads.filter(x=>x.nodeId!==nodeId),
      nodalLoadOverrides:[...cur.nodalLoadOverrides.filter(x=>x.nodeId!==nodeId),{nodeId,fx,fy,mz}]
    }))
  }
  function editDistributedLoad(elementId:number){
    const element=model.elements.find(e=>e.id===elementId);if(!element)return
    const raw=window.prompt('Carga distribuída local qy [kN/m].\nUse valor negativo para baixo.',String(element.qy??0))
    if(raw===null)return
    const qy=Number(raw.replace(',','.'))
    if(!Number.isFinite(qy)){alert('Introduza um valor numérico válido.');return}
    editCurrentModel(cur=>({...cur,
      removedDistributedLoads:cur.removedDistributedLoads.filter(id=>id!==elementId),
      distributedLoadOverrides:[...cur.distributedLoadOverrides.filter(x=>x.elementId!==elementId),{elementId,qy}]
    }))
  }
  function elementLength(e:Element2D){const a=model.nodes.find(n=>n.id===e.n1),b=model.nodes.find(n=>n.id===e.n2);return a&&b?Math.hypot(b.x-a.x,b.y-a.y):0}
  function openMemberLoadEditor(elementId:number,loadId?:number){
    const element=model.elements.find(e=>e.id===elementId);if(!element)return
    if((element.kind??'frame')==='truss'){alert('Nas treliças, as ações devem ser aplicadas nos nós.');return}
    const L=elementLength(element),load=loadId===undefined?undefined:(element.loads??[]).find(x=>x.id===loadId)
    if(!load){setLoadEditor({elementId,kind:'pointY',x:L/2,a:0,b:L,value:-10,value2:-5});return}
    if(load.type==='point'){const axial=Math.abs(load.px??0)>Math.abs(load.py??0);setLoadEditor({elementId,loadId:load.id,kind:axial?'pointX':'pointY',x:load.x,a:0,b:L,value:axial?(load.px??0):(load.py??0),value2:0});return}
    if(load.type==='moment'){setLoadEditor({elementId,loadId:load.id,kind:'moment',x:load.x,a:0,b:L,value:load.mz,value2:0});return}
    const same=Math.abs(load.qy1-load.qy2)<1e-9,firstZero=Math.abs(load.qy1)<1e-9,secondZero=Math.abs(load.qy2)<1e-9
    const kind:MemberLoadEditorKind=same?'uniform':firstZero?'triGrow':secondZero?'triDrop':'trapezoid'
    setLoadEditor({elementId,loadId:load.id,kind,x:(load.a+load.b)/2,a:load.a,b:load.b,value:kind==='triGrow'?load.qy2:load.qy1,value2:load.qy2})
  }
  function saveMemberLoad(){
    if(!loadEditor)return
    const element=model.elements.find(e=>e.id===loadEditor.elementId);if(!element)return
    const L=elementLength(element),id=loadEditor.loadId??Math.max(0,...(element.loads??[]).map(x=>x.id))+1
    let load:MemberLoad
    if(loadEditor.kind==='pointY')load={id,type:'point',x:clamp(loadEditor.x,0,L),py:loadEditor.value}
    else if(loadEditor.kind==='pointX')load={id,type:'point',x:clamp(loadEditor.x,0,L),px:loadEditor.value}
    else if(loadEditor.kind==='moment')load={id,type:'moment',x:clamp(loadEditor.x,0,L),mz:loadEditor.value}
    else{
      const a=clamp(Math.min(loadEditor.a,loadEditor.b),0,L),b=clamp(Math.max(loadEditor.a,loadEditor.b),a,L)
      let q1=loadEditor.value,q2=loadEditor.value
      if(loadEditor.kind==='triGrow'){q1=0;q2=loadEditor.value}
      else if(loadEditor.kind==='triDrop'){q1=loadEditor.value;q2=0}
      else if(loadEditor.kind==='trapezoid'){q1=loadEditor.value;q2=loadEditor.value2}
      load={id,type:'distributed',a,b,qy1:q1,qy2:q2}
    }
    commitCustomModel({...model,elements:model.elements.map(e=>e.id===element.id?{...e,loads:[...(e.loads??[]).filter(x=>x.id!==id),load]}:e)})
    setSelected(element.id);setLoadEditor(null)
  }
  function selectNodeForLoad(nodeId:number){
    const node=model.nodes.find(n=>n.id===nodeId);if(!node)return
    setTool('Carga');setTab('Cargas');setPanelCollapsed(false)
    setLoadPanel(v=>({...v,target:'node',nodeId,value:v.nodeComponent==='fx'?(node.fx??0):v.nodeComponent==='mz'?(node.mz??0):(node.fy??0)}))
  }
  function selectMemberForLoad(elementId:number){
    const element=model.elements.find(e=>e.id===elementId);if(!element)return
    if((element.kind??'frame')==='truss'){alert('Nas treliças, as ações devem ser aplicadas nos nós.');return}
    const L=elementLength(element)
    setSelected(elementId);setTool('Carga');setTab('Cargas');setPanelCollapsed(false)
    setLoadPanel(v=>({...v,target:'member',elementId,x:L/2,a:0,b:L}))
  }
  function applyLoadFromPanel(){
    if(loadPanel.target==='node'){
      const node=model.nodes.find(n=>n.id===loadPanel.nodeId);if(!node){alert('Selecione um nó válido.');return}
      const fx=loadPanel.nodeComponent==='fx'?loadPanel.value:(node.fx??0)
      const fy=loadPanel.nodeComponent==='fy'?loadPanel.value:(node.fy??0)
      const mz=loadPanel.nodeComponent==='mz'?loadPanel.value:(node.mz??0)
      editCurrentModel(cur=>({...cur,removedNodalLoads:cur.removedNodalLoads.filter(x=>x.nodeId!==node.id),nodalLoadOverrides:[...cur.nodalLoadOverrides.filter(x=>x.nodeId!==node.id),{nodeId:node.id,fx,fy,mz}]}))
      return
    }
    const element=model.elements.find(e=>e.id===loadPanel.elementId);if(!element){alert('Selecione uma barra válida.');return}
    if((element.kind??'frame')==='truss'){alert('Nas treliças, as ações devem ser aplicadas nos nós.');return}
    const L=elementLength(element),id=Math.max(0,...(element.loads??[]).map(x=>x.id))+1
    let load:MemberLoad
    if(loadPanel.kind==='pointY')load={id,type:'point',x:clamp(loadPanel.x,0,L),py:loadPanel.value}
    else if(loadPanel.kind==='pointX')load={id,type:'point',x:clamp(loadPanel.x,0,L),px:loadPanel.value}
    else if(loadPanel.kind==='moment')load={id,type:'moment',x:clamp(loadPanel.x,0,L),mz:loadPanel.value}
    else{
      const a=clamp(Math.min(loadPanel.a,loadPanel.b),0,L),b=clamp(Math.max(loadPanel.a,loadPanel.b),a,L)
      let q1=loadPanel.value,q2=loadPanel.value
      if(loadPanel.kind==='triGrow'){q1=0;q2=loadPanel.value}
      else if(loadPanel.kind==='triDrop'){q1=loadPanel.value;q2=0}
      else if(loadPanel.kind==='trapezoid'){q1=loadPanel.value;q2=loadPanel.value2}
      load={id,type:'distributed',a,b,qy1:q1,qy2:q2}
    }
    commitCustomModel({...model,elements:model.elements.map(e=>e.id===element.id?{...e,loads:[...(e.loads??[]),load]}:e)})
    setSelected(element.id)
  }
  function deleteMemberLoad(elementId:number,loadId:number){
    commitCustomModel({...model,elements:model.elements.map(e=>e.id===elementId?{...e,loads:(e.loads??[]).filter(x=>x.id!==loadId)}:e)})
  }
  function commitCustomModel(next:Model2D){
    setCustomModels(prev=>({...prev,[mode]:next}))
    setModelEdits(prev=>({...prev,[mode]:emptyModelEdits()}))
  }
  function snapCoord(v:number){return Math.round(v*4)/4}
  function addNode(x:number,y:number){
    const nx=Math.max(0,snapCoord(x)),ny=mode==='Viga'?0:Math.max(0,snapCoord(y))
    const id=Math.max(0,...model.nodes.map(n=>n.id))+1
    commitCustomModel({...model,nodes:[...model.nodes,{id,x:nx,y:ny}]})
    setPendingBarNode(null)
  }
  function newElement(id:number,n1:number,n2:number):Element2D{
    if(mode==='Treliça 2D')return {id,n1,n2,E:210000,A:settings.trussA,I:0,kind:'truss'}
    const a=model.nodes.find(n=>n.id===n1),b=model.nodes.find(n=>n.id===n2)
    const vertical=!!(a&&b&&Math.abs(b.y-a.y)>Math.abs(b.x-a.x)*1.2)
    const bw=vertical&&mode==='Pórtico 2D'?settings.colB:settings.beamB
    const hh=vertical&&mode==='Pórtico 2D'?settings.colH:settings.beamH
    return {id,n1,n2,E:concreteProps(settings.fck).Ecm,A:bw*hh,I:bw*hh**3/12,kind:'frame',section:{b:bw,h:hh,cover:settings.cover,fck:settings.fck,fyk:settings.fyk}}
  }
  function barNodeClick(nodeId:number){
    if(pendingBarNode===null){setPendingBarNode(nodeId);return}
    if(pendingBarNode===nodeId){setPendingBarNode(null);return}
    const duplicate=model.elements.some(e=>(e.n1===pendingBarNode&&e.n2===nodeId)||(e.n1===nodeId&&e.n2===pendingBarNode))
    if(duplicate){alert('Já existe uma barra entre estes dois nós.');setPendingBarNode(null);return}
    const id=Math.max(0,...model.elements.map(e=>e.id))+1
    const next=newElement(id,pendingBarNode,nodeId)
    commitCustomModel({...model,elements:[...model.elements,next]})
    setSelected(id);setPendingBarNode(null)
  }
  function deleteElement(elementId:number){
    const element=model.elements.find(e=>e.id===elementId);if(!element)return
    commitCustomModel({...model,elements:model.elements.filter(e=>e.id!==elementId)})
    if(selected===elementId)setSelected(model.elements.find(e=>e.id!==elementId)?.id??0)
    setPendingBarNode(null)
  }
  function deleteNode(nodeId:number){
    const attached=model.elements.filter(e=>e.n1===nodeId||e.n2===nodeId)
    if(attached.length&&!window.confirm(`O nó N${nodeId} está ligado a ${attached.length} barra(s). Apagar o nó e as barras ligadas?`))return
    const removedIds=new Set(attached.map(e=>e.id))
    commitCustomModel({nodes:model.nodes.filter(n=>n.id!==nodeId),elements:model.elements.filter(e=>!removedIds.has(e.id))})
    if(removedIds.has(selected))setSelected(model.elements.find(e=>!removedIds.has(e.id))?.id??0)
    if(pendingBarNode===nodeId)setPendingBarNode(null)
  }
  function moveNode(nodeId:number){
    const node=model.nodes.find(n=>n.id===nodeId);if(!node)return
    const raw=window.prompt(mode==='Viga'?'Nova coordenada X [m]. A coordenada Y mantém-se a 0.':'Novas coordenadas X, Y [m]. Exemplo: 4.5, 3.0',mode==='Viga'?String(node.x):`${node.x}, ${node.y}`)
    if(raw===null)return
    const vals=raw.split(/[;\s]+|,(?=\s|[-+]?\d)/).filter(Boolean).map(v=>Number(v.replace(',','.')))
    const x=vals[0],y=mode==='Viga'?0:vals[1]
    if(!Number.isFinite(x)||!Number.isFinite(y)){alert('Introduza coordenadas válidas.');return}
    commitCustomModel({...model,nodes:model.nodes.map(n=>n.id===nodeId?{...n,x:Math.max(0,snapCoord(x)),y:Math.max(0,snapCoord(y))}:n)})
  }
  function toggleRelease(elementId:number,end:'start'|'end'){
    const element=model.elements.find(e=>e.id===elementId);if(!element||element.kind==='truss')return
    commitCustomModel({...model,elements:model.elements.map(e=>e.id===elementId?{...e,[end==='start'?'releaseR1':'releaseR2']:!(end==='start'?e.releaseR1:e.releaseR2)}:e)})
    setSelected(elementId)
  }
  function newBlankProject(){
    if((model.nodes.length||model.elements.length)&&!window.confirm(`Criar um modelo ${mode} em branco? O modelo atual deste tipo será substituído.`))return
    setCustomModels(prev=>({...prev,[mode]:{nodes:[],elements:[]}}))
    setModelEdits(prev=>({...prev,[mode]:emptyModelEdits()}))
    setSelected(0);setPendingBarNode(null);setTool('Nó');setTab('Modelo');setZoom(1)
  }
  function undo(){
    const previous=history[history.length-1];if(!previous)return
    setFuture(f=>[settings,...f].slice(0,50));setHistory(h=>h.slice(0,-1));setSettings(previous)
  }
  function redo(){
    const next=future[0];if(!next)return
    setHistory(h=>[...h.slice(-49),settings]);setFuture(f=>f.slice(1));setSettings(next)
  }

  const baseModel=useMemo(()=>customModels[mode]??makeModel(mode,settings),[mode,settings,customModels])
  const model=useMemo(()=>applyModelEdits(baseModel,modelEdits[mode]),[baseModel,modelEdits,mode])
  useEffect(()=>{if(!model.elements.some(e=>e.id===selected))setSelected(model.elements[0]?.id??0)},[model,selected])
  useEffect(()=>{
    setLoadPanel(v=>{
      const firstNode=model.nodes[0],firstMember=model.elements.find(e=>(e.kind??'frame')==='frame')
      if(mode==='Treliça 2D'&&v.target!=='node')return {...v,target:'node',nodeId:model.nodes.some(n=>n.id===v.nodeId)?v.nodeId:(firstNode?.id??0)}
      if(v.target==='node'&&!model.nodes.some(n=>n.id===v.nodeId))return {...v,nodeId:firstNode?.id??0}
      if(v.target==='member'&&!model.elements.some(e=>e.id===v.elementId))return firstMember?{...v,elementId:firstMember.id,x:elementLength(firstMember)/2,a:0,b:elementLength(firstMember)}:firstNode?{...v,target:'node',nodeId:firstNode.id}:v
      return v
    })
  },[mode,model])

  const analysis=useMemo<AnalysisState>(()=>{
    try{return {ok:true,data:solveFrame(model)}}
    catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)}}
  },[model])
  const result=analysis.ok?analysis.data:null
  const member=result?.members.find(m=>m.id===selected)
  const el=model.elements.find(e=>e.id===selected)
  const n1=model.nodes.find(n=>n.id===el?.n1),n2=model.nodes.find(n=>n.id===el?.n2)
  const critM=criticalSample(member,'M'),critV=criticalSample(member,'V'),critN=criticalSample(member,'N')
  const med=Math.abs(critM.value)/1e6,ved=Math.abs(critV.value)/1000,ned=Math.abs(critN.value)/1000
  const moments=momentExtrema(member)
  const length=n1&&n2?Math.hypot(n2.x-n1.x,n2.y-n1.y):0
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
    setCustomModels(p.customModels??{})
    if(p.mode)setMode(p.mode)
    if(p.projectName)setProjectName(p.projectName)
    if(p.ui)setUi({...DEFAULT_UI,...p.ui})
  }
  function saveProject(){
    localStorage.setItem('rjp-structures-v17',JSON.stringify(settings))
    localStorage.setItem('rjp-structures-mode-v17',mode)
    localStorage.setItem('rjp-structures-project-name-v17',projectName)
    localStorage.setItem('rjp-structures-model-edits-v17',JSON.stringify(modelEdits))
    localStorage.setItem('rjp-structures-ui-v17',JSON.stringify(ui))
    localStorage.setItem('rjp-structures-custom-models-v172',JSON.stringify(customModels))
    const now=new Date().toISOString();setLastAutoSave(now);localStorage.setItem('rjp-structures-autosave-time-v17',now)
  }
  function exportProject(){
    const file:ProjectFile={version:'1.7.4',mode,settings,projectName,edits:modelEdits,customModels,ui,savedAt:new Date().toISOString()}
    const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${projectName.replace(/[^a-z0-9_-]+/gi,'_')||'RJP_Structures'}_V1_7_4.json`;a.click();URL.revokeObjectURL(a.href)
  }
  function importProject(e:ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0];if(!f)return
    const reader=new FileReader();reader.onload=()=>{try{applyProjectFile(JSON.parse(String(reader.result)) as ProjectFile)}catch{alert('Ficheiro de projeto inválido.')}};reader.readAsText(f);e.target.value=''
  }
  function recoverAutosave(){
    try{const raw=localStorage.getItem('rjp-structures-autosave-v17');if(!raw){alert('Não existe uma cópia automática disponível.');return}applyProjectFile(JSON.parse(raw) as ProjectFile)}catch{alert('Não foi possível recuperar a cópia automática.')}
  }
  function resetProject(){setHistory(h=>[...h.slice(-49),settings]);setFuture([]);setSettings(DEFAULT_SETTINGS);setModelEdits(emptyEditsByMode());setCustomModels({});setMode('Viga');setSelected(1);setPendingBarNode(null);setTool('Selecionar');setTab('Modelo');setZoom(1)}

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject()}
      if(e.key==='Escape'&&focusMode)setFocusMode(false)
    }
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)
  },[history,future,settings,mode,projectName,focusMode])

  const toolIcons:Record<Tool,string>={Selecionar:'↖',Nó:'○',Barra:'╱',Rótula:'◉',Apoio:'△',Carga:'↓',Mover:'✥',Apagar:'⌫'}
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
        <button onClick={newBlankProject}><span>＋</span>Novo</button>
        <label className="topFileAction"><span>↥</span>Abrir<input type="file" accept="application/json" onChange={importProject}/></label>
        <button onClick={saveProject}><span>▣</span>Guardar</button>
        <button onClick={()=>setTab('Resultados')}><span>∑</span>Calcular</button>
        <button onClick={()=>setTab('Relatório')}><span>▤</span>Relatório</button>
      </div>
    </header>

    <div className="modelStrip">
      <div className="modelSelect"><span>Tipo de modelo</span><select value={mode} onChange={(e:ChangeEvent<HTMLSelectElement>)=>{setMode(e.target.value as Mode);setSelected(0);setPendingBarNode(null);setTab('Modelo');setZoom(1)}}>{(['Viga','Pórtico 2D','Treliça 2D'] as Mode[]).map(m=><option key={m}>{m}</option>)}</select></div>
      <div className="projectTitle"><input className="projectNameInput" value={projectName} onChange={(e:any)=>setProjectName(e.target.value)} aria-label="Nome do projeto"/><span>EC2 · MEF 2D · Português de Portugal</span></div>
      <div className="historyActions" aria-label="Histórico de edição"><button onClick={undo} disabled={!history.length} title="Desfazer (Ctrl+Z)">↶</button><button onClick={redo} disabled={!future.length} title="Refazer (Ctrl+Y)">↷</button></div>
      <div className="autosavePill" title={lastAutoSave?`Última gravação automática: ${new Date(lastAutoSave).toLocaleString('pt-PT')}`:'Ainda sem gravação automática'}>● {lastAutoSave?`Auto ${new Date(lastAutoSave).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}`:'Auto…'}</div><div className="versionPill">V1.7.4</div>
    </div>

    <main className={`studioLayout ${panelCollapsed?'panelCollapsed':''} ${focusMode?'focusMode':''}`}>
      <aside className="leftToolbar" aria-label="Ferramentas de desenho">
        {(['Selecionar','Nó','Barra','Rótula','Apoio','Carga','Mover','Apagar'] as Tool[]).map(t=><button key={t} className={tool===t?'active':''} onClick={()=>{setTool(t);if(t==='Carga'){setTab('Cargas');setPanelCollapsed(false);const firstNode=model.nodes[0],firstMember=model.elements.find(e=>(e.kind??'frame')==='frame');if(loadPanel.target==='node'&&firstNode&&!model.nodes.some(n=>n.id===loadPanel.nodeId))setLoadPanel(v=>({...v,nodeId:firstNode.id}));if(!firstMember&&firstNode)setLoadPanel(v=>({...v,target:'node',nodeId:firstNode.id}));else if(loadPanel.target==='member'&&firstMember&&!model.elements.some(e=>e.id===loadPanel.elementId))selectMemberForLoad(firstMember.id)}}} title={t}><span className="toolIcon">{toolIcons[t]}</span><small>{t}</small></button>)}
      </aside>

      <section className="workspace mockupWorkspace">
        <div className="canvasHeader">
          <div className="canvasTitle"><strong>{mode}</strong><span> · {selected>0?`Elemento selecionado: B${selected}`:'Sem elemento selecionado'}</span></div>
          <div className="canvasControls">
            <div className="resultSwitch">{(['N','V','M','Deformada'] as CanvasResult[]).map(r=><button key={r} className={canvasResult===r?'active':''} onClick={()=>setCanvasResult(r)}>{r}</button>)}</div>
            <div className="viewportTools">
              <button className={showGrid?'active':''} onClick={()=>setShowGrid(v=>!v)} title="Mostrar/ocultar grelha">Grelha</button>
              <button className={showLabels?'active':''} onClick={()=>setShowLabels(v=>!v)} title="Mostrar/ocultar identificações">Rótulos</button>
              <button className={showLoads?'active':''} onClick={()=>setShowLoads(v=>!v)} title="Mostrar/ocultar ações">Ações</button>
              <span className="toolDivider"/>
              <button onClick={()=>setZoom(z=>clamp(z-.1,.7,2))} title="Reduzir">−</button><span className="zoomReadout">{fmt(zoom*100,0)}%</span><button onClick={()=>setZoom(z=>clamp(z+.1,.7,2))} title="Ampliar">＋</button>
              <button onClick={()=>setZoom(1)} title="Ajustar ao modelo">Ajustar</button>
              <button className={focusMode?'active':''} onClick={()=>setFocusMode(v=>!v)} title="Modo de concentração">{focusMode?'Sair':'Foco'}</button>
            </div>
          </div>
        </div>
        <ModelView model={model} result={result} selected={selected} setSelected={setSelected} diagram={canvasResult} zoom={zoom} setZoom={setZoom} showGrid={showGrid} showLabels={showLabels} showLoads={showLoads} tool={tool} pendingBarNode={pendingBarNode} onAddNode={addNode} onBarNodeClick={barNodeClick} onDeleteElement={deleteElement} onDeleteNode={deleteNode} onToggleRelease={toggleRelease} onMoveNode={moveNode} onDeleteSupport={deleteSupport} onDeleteNodalLoad={deleteNodalLoad} onDeleteDistributedLoad={deleteDistributedLoad} onCycleSupport={cycleSupport} onEditNodalLoad={selectNodeForLoad} onOpenMemberLoadEditor={selectMemberForLoad} onEditMemberLoad={(elementId,loadId)=>openMemberLoadEditor(elementId,loadId)} onDeleteMemberLoad={deleteMemberLoad}/>
        <div className="canvasStatus"><span><b>Ferramenta:</b> {tool}</span>{tool==='Nó'&&<span className="editHint"><b>Nó:</b> toque na grelha para criar nós (snap 0,25 m)</span>}{tool==='Barra'&&<span className="editHint"><b>Barra:</b> toque no nó inicial e depois no nó final{pendingBarNode?` · início N${pendingBarNode}`:''}</span>}{tool==='Rótula'&&<span className="editHint"><b>Rótula:</b> toque no círculo da extremidade da barra para inserir/remover</span>}{tool==='Mover'&&<span className="editHint"><b>Mover:</b> toque num nó e introduza as novas coordenadas</span>}{tool==='Apagar'&&<span className="deleteHint"><b>Apagar:</b> toque numa barra, nó, força, carga distribuída ou apoio</span>}{tool==='Apoio'&&<span className="editHint"><b>Apoio:</b> toque num nó para alterar o vínculo</span>}{tool==='Carga'&&<span className="editHint"><b>Carga:</b> nó = Fx/Fy/Mz · barra = concentrada, momento, retangular, triangular ou trapezoidal</span>}<span><b>Nós:</b> {model.nodes.length}</span><span><b>Barras:</b> {model.elements.length}</span><span><b>Zoom:</b> {fmt(zoom*100,0)}%</span><span><b>Cálculo:</b> {analysis.ok?'atualizado automaticamente':'verificar modelo'}</span></div>
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
        <div className="panelTitle"><div><h2>Propriedades</h2><span>{selected>0?`${isTruss?'Barra de treliça':isColumn?'Pilar':'Viga'} B${selected}`:'Modelo sem barra selecionada'}</span></div><button className="collapseButton" onClick={()=>setPanelCollapsed(v=>!v)} title={panelCollapsed?'Abrir painel de propriedades':'Recolher painel de propriedades'}>{panelCollapsed?'‹':'›'}</button></div>

        <div className="selectedSummary">
          <div><span>Comprimento</span><b>{fmt(length)} m</b></div>
          <div><span>Secção</span><b>{sec?`${sec.b} × ${sec.h} mm`:`A = ${fmt(el?.A,0)} mm²`}</b></div>
        </div>

        {tab==='Modelo'&&<>
          <h3>Geometria do modelo</h3>
          {mode==='Viga'&&<div className="fields singleColumn"><NumInput label="Vão total" value={settings.beamSpan} onChange={v=>set('beamSpan',v)} unit="m" step={0.1} min={1}/><NumInput label="Largura b" value={settings.beamB} onChange={v=>set('beamB',v)} unit="mm" step={10} min={100}/><NumInput label="Altura h" value={settings.beamH} onChange={v=>set('beamH',v)} unit="mm" step={10} min={150}/></div>}
          {mode==='Pórtico 2D'&&<div className="fields singleColumn"><NumInput label="Vão" value={settings.frameWidth} onChange={v=>set('frameWidth',v)} unit="m" step={0.1} min={1}/><NumInput label="Altura" value={settings.frameHeight} onChange={v=>set('frameHeight',v)} unit="m" step={0.1} min={1}/><NumInput label="Viga b" value={settings.beamB} onChange={v=>set('beamB',v)} unit="mm" step={10} min={100}/><NumInput label="Viga h" value={settings.beamH} onChange={v=>set('beamH',v)} unit="mm" step={10} min={150}/><NumInput label="Pilar b" value={settings.colB} onChange={v=>set('colB',v)} unit="mm" step={10} min={150}/><NumInput label="Pilar h" value={settings.colH} onChange={v=>set('colH',v)} unit="mm" step={10} min={150}/></div>}
          {mode==='Treliça 2D'&&<div className="fields singleColumn"><NumInput label="Vão" value={settings.trussSpan} onChange={v=>set('trussSpan',v)} unit="m" step={0.1} min={1}/><NumInput label="Altura" value={settings.trussHeight} onChange={v=>set('trussHeight',v)} unit="m" step={0.1} min={.5}/><NumInput label="Área da barra" value={settings.trussA} onChange={v=>set('trussA',v)} unit="mm²" step={100} min={100}/></div>}
          <div className="card info compact freeModelCard"><b>Editor gráfico livre · V1.7.4</b><p>Podes construir a estrutura de raiz: <b>Nó</b> cria pontos, <b>Barra</b> liga dois nós, <b>Apagar</b> elimina barras ou nós e <b>Rótula</b> insere/remove libertações de rotação nas extremidades.</p><div className="inlineButtons"><button className="secondary inlineAction" onClick={newBlankProject}>Começar do zero</button>{customModels[mode]!==undefined&&<button className="secondary inlineAction" onClick={()=>{setCustomModels(prev=>{const next={...prev};delete next[mode];return next});setModelEdits(prev=>({...prev,[mode]:emptyModelEdits()}));setPendingBarNode(null);setSelected(1)}}>Voltar ao exemplo</button>}</div></div>{el&&!isTruss&&<div className="card compact hingeCard"><b>Rótulas da barra B{el.id}</b><p>Extremidade inicial N{el.n1}: <strong>{el.releaseR1?'rótula':'ligação rígida'}</strong></p><p>Extremidade final N{el.n2}: <strong>{el.releaseR2?'rótula':'ligação rígida'}</strong></p><div className="inlineButtons"><button className="inlineAction" onClick={()=>toggleRelease(el.id,'start')}>{el.releaseR1?'Remover':'Inserir'} rótula inicial</button><button className="inlineAction" onClick={()=>toggleRelease(el.id,'end')}>{el.releaseR2?'Remover':'Inserir'} rótula final</button></div></div>}
        </>}

        {tab==='Cargas'&&<>
          <h3>Inserir carga</h3>
          <div className="card loadComposer">
            <div className="loadTargetSwitch"><button className={loadPanel.target==='node'?'active':''} onClick={()=>{const n=model.nodes[0];setLoadPanel(v=>({...v,target:'node',nodeId:model.nodes.some(x=>x.id===v.nodeId)?v.nodeId:(n?.id??0)}))}}>No nó</button><button className={loadPanel.target==='member'?'active':''} disabled={!model.elements.some(e=>(e.kind??'frame')==='frame')} onClick={()=>{const e=model.elements.find(x=>(x.kind??'frame')==='frame');if(e)selectMemberForLoad(model.elements.some(x=>x.id===loadPanel.elementId)?loadPanel.elementId:e.id)}}>Na barra</button></div>
            {loadPanel.target==='node'?<>
              <div className="fields"><label className="field"><span>Local de aplicação</span><select value={loadPanel.nodeId} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setLoadPanel(v=>({...v,nodeId:Number(e.target.value)}))}>{model.nodes.map(n=><option key={n.id} value={n.id}>Nó N{n.id} · ({fmt(n.x,2)}; {fmt(n.y,2)}) m</option>)}</select></label><label className="field"><span>Tipologia</span><select value={loadPanel.nodeComponent} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setLoadPanel(v=>({...v,nodeComponent:e.target.value as LoadComponent}))}><option value="fx">Força horizontal Fx</option><option value="fy">Força vertical Fy</option><option value="mz">Momento Mz</option></select></label></div>
              <div className="fields singleColumn"><NumInput label={loadPanel.nodeComponent==='mz'?'Valor do momento':'Valor da força'} value={loadPanel.value} onChange={v=>setLoadPanel(x=>({...x,value:v}))} unit={loadPanel.nodeComponent==='mz'?'kNm':'kN'} step={1}/></div>
              <div className="modalNote"><b>Sinal:</b> Fx positivo para +X, Fy positivo para +Y e Mz positivo no sentido anti-horário.</div>
            </>:<>
              <div className="fields"><label className="field"><span>Local de aplicação</span><select value={loadPanel.elementId} onChange={(e:ChangeEvent<HTMLSelectElement>)=>selectMemberForLoad(Number(e.target.value))}>{model.elements.filter(e=>(e.kind??'frame')==='frame').map(e=><option key={e.id} value={e.id}>Barra B{e.id} · N{e.n1}–N{e.n2} · L={fmt(elementLength(e),2)} m</option>)}</select></label><label className="field"><span>Tipologia</span><select value={loadPanel.kind} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setLoadPanel(v=>({...v,kind:e.target.value as MemberLoadEditorKind}))}><option value="pointY">Força concentrada transversal (Py)</option><option value="pointX">Força concentrada axial (Px)</option><option value="moment">Momento concentrado</option><option value="uniform">Distribuída retangular / uniforme</option><option value="triGrow">Distribuída triangular: 0 → q</option><option value="triDrop">Distribuída triangular: q → 0</option><option value="trapezoid">Distribuída trapezoidal: q1 → q2</option></select></label></div>
              {(loadPanel.kind==='pointY'||loadPanel.kind==='pointX'||loadPanel.kind==='moment')?<div className="fields"><NumInput label="Localização x desde o nó inicial" value={loadPanel.x} onChange={v=>setLoadPanel(x=>({...x,x:v}))} unit="m" step={0.1} min={0}/><NumInput label={loadPanel.kind==='moment'?'Valor do momento M':loadPanel.kind==='pointX'?'Valor da força Px':'Valor da força Py'} value={loadPanel.value} onChange={v=>setLoadPanel(x=>({...x,value:v}))} unit={loadPanel.kind==='moment'?'kNm':'kN'} step={1}/></div>:<><div className="fields"><NumInput label="Início da carga a" value={loadPanel.a} onChange={v=>setLoadPanel(x=>({...x,a:v}))} unit="m" step={0.1} min={0}/><NumInput label="Fim da carga b" value={loadPanel.b} onChange={v=>setLoadPanel(x=>({...x,b:v}))} unit="m" step={0.1} min={0}/></div><div className="fields"><NumInput label={loadPanel.kind==='trapezoid'?'Valor q1':loadPanel.kind==='triGrow'?'Valor q final':'Valor q'} value={loadPanel.value} onChange={v=>setLoadPanel(x=>({...x,value:v}))} unit="kN/m" step={0.5}/>{loadPanel.kind==='trapezoid'&&<NumInput label="Valor q2" value={loadPanel.value2} onChange={v=>setLoadPanel(x=>({...x,value2:v}))} unit="kN/m" step={0.5}/>}</div></>}
              <div className="modalNote"><b>Localização:</b> x, a e b são medidos desde o nó inicial da barra. Valores negativos atuam no sentido local −x/−y; momento negativo é horário.</div>
            </>}
            <div className="loadComposerActions"><button className="secondary" onClick={()=>setTool('Selecionar')}>Fechar ferramenta</button><button onClick={applyLoadFromPanel}>Adicionar carga</button></div>
          </div>
          <div className="card compact loadHintCard"><b>Também podes escolher graficamente</b><p>Com a ferramenta <b>Carga</b> ativa, toca num nó ou numa barra no desenho. O separador Cargas muda automaticamente para esse local de aplicação; depois escolhe a tipologia, localização e valor.</p></div>
          <h3>Ações do exemplo / modelo</h3>
          {mode==='Viga'&&<div className="fields singleColumn"><NumInput label="Carga distribuída q do exemplo" value={settings.beamQ} onChange={v=>set('beamQ',v)} unit="kN/m" step={0.5} min={0}/><NumInput label="Carga concentrada P do exemplo" value={settings.beamP} onChange={v=>set('beamP',v)} unit="kN" step={1} min={0}/></div>}
          {mode==='Pórtico 2D'&&<div className="fields singleColumn"><NumInput label="Carga distribuída na viga do exemplo" value={settings.frameQ} onChange={v=>set('frameQ',v)} unit="kN/m" step={0.5} min={0}/><NumInput label="Ação horizontal do exemplo" value={settings.frameHLoad} onChange={v=>set('frameHLoad',v)} unit="kN" step={1} min={0}/></div>}
          {mode==='Treliça 2D'&&<div className="fields singleColumn"><NumInput label="Carga vertical P do exemplo" value={settings.trussP} onChange={v=>set('trussP',v)} unit="kN" step={1} min={0}/></div>}
          <div className="card compact"><button className="secondary inlineAction" onClick={restoreModeLoadsAndSupports}>Repor ações e apoios do modelo</button></div>
          {el&&(el.kind??'frame')==='frame'&&<div className="card compact memberLoadsCard"><div className="cardTitleRow"><b>Cargas na barra B{el.id}</b><button className="inlineAction" onClick={()=>{selectMemberForLoad(el.id);setLoadPanel(v=>({...v,target:'member',elementId:el.id}))}}>+ Nova carga</button></div>{!!el.qy&&<p className="legacyLoad">Carga base do exemplo: q = {fmt(el.qy,1)} kN/m</p>}{(el.loads??[]).length===0?<p className="smallHint">Ainda não existem cargas adicionais nesta barra.</p>:(el.loads??[]).map(load=><div className="loadRow" key={load.id}><span>{memberLoadDescription(load)}</span><div><button className="miniBtn" onClick={()=>openMemberLoadEditor(el.id,load.id)}>Editar</button><button className="miniBtn dangerBtn" onClick={()=>deleteMemberLoad(el.id,load.id)}>Apagar</button></div></div>)}</div>}
        </>}

        {tab==='Resultados'&&<>
          <h3>Resultados MEF</h3>
          {!analysis.ok?<div className="card danger">{analysis.error}</div>:member?<><div className="card compact"><b>B{selected} · valores críticos</b><p>|N|max = {fmt(ned)} kN em x≈{fmt(critN.x)} m</p>{!isTruss&&<><p>|V|max = {fmt(ved)} kN em x≈{fmt(critV.x)} m</p><p>|M|max = {fmt(med)} kNm em x≈{fmt(critM.x)} m</p></>}</div><Diagram member={member} kind="N"/>{!isTruss&&<><Diagram member={member} kind="V"/><Diagram member={member} kind="M"/></>}<div className="card compact"><b>Reações de apoio</b>{model.nodes.map(n=>{const i=nodeIndex.get(n.id)!;return <p key={n.id}>N{n.id}: Rx {fmt(analysis.data.R[3*i]/1000)} · Ry {fmt(analysis.data.R[3*i+1]/1000)} kN · Mz {fmt(analysis.data.R[3*i+2]/1e6)} kNm</p>})}</div></>:<div className="card">Selecione um elemento.</div>}
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
          <h3>Relatório de cálculo</h3><div className="card report"><div className="reportHeading"><div><b>{projectName}</b><span>RJP Structures V1.7.4 · Elemento B{selected}</span></div><strong className={overallClass}>{overallState}</strong></div><p><b>Modelo:</b> {mode} · <b>Tipo:</b> {isTruss?'Treliça':isColumn?'Pilar':'Viga'}</p><p><b>Materiais:</b> {sec?`C${settings.fck} · aço fyk ${settings.fyk} MPa · exposição ${settings.exposure}`:'barra axial'}</p>{sec&&<p><b>Secção:</b> {sec.b} × {sec.h} mm · <b>Recobrimento:</b> {sec.cover} mm</p>}<p><b>Esforços críticos:</b> NEd {fmt(ned)} kN{!isTruss&&` · VEd ${fmt(ved)} kN · MEd ${fmt(med)} kNm`}</p>{selectedSchedule.length>0&&<p><b>Aço estimado da peça:</b> {fmt(steelTotal,2)} kg</p>}<hr/>{checks.length?checks.map(c=><p key={c.id}><b>{c.title}:</b> {statusLabel(c.status)} {c.utilization!==undefined&&Number.isFinite(c.utilization)?`(${fmt(c.utilization*100,0)}%)`:''}</p>):<p>Não existem verificações EC2 aplicáveis a este elemento.</p>}<button className="printBtn" onClick={()=>window.print()}>Imprimir / Guardar como PDF</button></div><div className="card warning"><b>Validação do projeto</b><p>Confirmar edição do EC2, Anexo Nacional, combinações, classe estrutural, exposição e hipóteses adotadas antes da utilização em projeto de execução.</p></div>
        </>}

        {tab==='Definições'&&<>
          <h3>Materiais e durabilidade</h3>
          {!isTruss&&<div className="fields singleColumn"><NumInput label="Resistência característica do betão fck" value={settings.fck} onChange={v=>set('fck',v)} unit="MPa" min={12}/><NumInput label="Tensão de cedência do aço fyk" value={settings.fyk} onChange={v=>set('fyk',v)} unit="MPa" min={200}/><NumInput label="Recobrimento" value={settings.cover} onChange={v=>set('cover',v)} unit="mm" min={10}/><NumInput label="cot θ" value={settings.cotTheta} onChange={v=>set('cotTheta',clamp(v,1,2.5))} step={0.1} min={1}/><label className="field"><span>Classe de exposição</span><select value={settings.exposure} onChange={(e:ChangeEvent<HTMLSelectElement>)=>commitSettings({...settings,exposure:e.target.value as ExposureClass})}>{(['X0','XC1','XC2','XC3','XC4','XD1','XD2','XD3','XS1','XS2','XS3'] as ExposureClass[]).map(x=><option key={x}>{x}</option>)}</select></label></div>}
          <h3>Acessibilidade</h3>
          <div className="card compact accessibilityCard">
            <label className="field"><span>Tamanho do texto da interface</span><select value={ui.fontScale} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setUi(v=>({...v,fontScale:Number(e.target.value)}))}><option value={0.9}>Pequeno — 90%</option><option value={1}>Normal — 100%</option><option value={1.15}>Grande — 115%</option><option value={1.3}>Muito grande — 130%</option><option value={1.45}>Extra grande — 145%</option></select></label>
            <label className="field"><span>Texto do desenho técnico</span><select value={ui.canvasTextScale} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setUi(v=>({...v,canvasTextScale:Number(e.target.value)}))}><option value={0.9}>90%</option><option value={1}>100%</option><option value={1.15}>115%</option><option value={1.3}>130%</option></select></label>
            <label className="toggleRow"><input type="checkbox" checked={ui.highContrast} onChange={(e:any)=>setUi(v=>({...v,highContrast:e.target.checked}))}/><span>Contraste reforçado</span></label>
            <label className="toggleRow"><input type="checkbox" checked={ui.largeTargets} onChange={(e:any)=>setUi(v=>({...v,largeTargets:e.target.checked}))}/><span>Botões e áreas de toque maiores</span></label>
          </div>
          <h3>Visualização e atalhos</h3><div className="card compact"><p><b>Grelha:</b> {showGrid?'visível':'oculta'} · <b>Rótulos:</b> {showLabels?'visíveis':'ocultos'} · <b>Ações:</b> {showLoads?'visíveis':'ocultas'}</p><p><b>Atalhos:</b> Ctrl+Z desfazer · Ctrl+Y refazer · Ctrl+S guardar · Esc sair do modo Foco.</p></div>
          <h3>WebApp</h3><div className="card compact webAppCard"><b>{webAppInstalled?'WebApp instalada':'Instalação no dispositivo'}</b><p>{webAppInstalled?'A RJP Structures está a correr como aplicação instalada. Os projetos continuam guardados localmente neste dispositivo.':'Podes instalar esta versão no computador, tablet ou telemóvel diretamente a partir do navegador. Depois da primeira utilização online, os ficheiros essenciais ficam disponíveis offline.'}</p>{installPrompt&&!webAppInstalled&&<button className="inlineAction" onClick={installWebApp}>Instalar RJP Structures</button>} {!installPrompt&&!webAppInstalled&&<p className="smallHint">Se o botão não aparecer, usa o menu do navegador e escolhe “Instalar aplicação” ou “Adicionar ao ecrã principal”, quando disponível.</p>}</div>
          <h3>Projeto e segurança</h3><div className="card compact autosaveCard"><b>Gravação automática</b><p>{lastAutoSave?`Última cópia: ${new Date(lastAutoSave).toLocaleString('pt-PT')}`:'A primeira cópia será criada após uma alteração.'}</p><button className="secondary inlineAction" onClick={recoverAutosave}>Recuperar última cópia automática</button></div><div className="projectActions"><button onClick={saveProject}>Guardar localmente</button><button onClick={exportProject}>Exportar projeto JSON</button><label className="fileBtn">Importar projeto JSON<input type="file" accept="application/json" onChange={importProject}/></label><button className="secondary" onClick={resetProject}>Repor exemplo</button></div>
        </>}
      </aside>
    </main>

    {loadEditor&&<div className="modalBackdrop" onMouseDown={()=>setLoadEditor(null)}><div className="loadModal" onMouseDown={(e:any)=>e.stopPropagation()}><div className="modalHeader"><div><b>{loadEditor.loadId?'Editar':'Nova'} carga na barra B{loadEditor.elementId}</b><span>Eixos locais da barra · valores negativos atuam no sentido −x/−y ou momento horário conforme convenção do modelo.</span></div><button className="modalClose" onClick={()=>setLoadEditor(null)}>×</button></div><label className="field"><span>Tipo de carga</span><select value={loadEditor.kind} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setLoadEditor(v=>v?{...v,kind:e.target.value as MemberLoadEditorKind}:v)}><option value="pointY">Força concentrada transversal (Py)</option><option value="pointX">Força concentrada axial (Px)</option><option value="moment">Momento concentrado</option><option value="uniform">Distribuída retangular / uniforme</option><option value="triGrow">Distribuída triangular: 0 → q</option><option value="triDrop">Distribuída triangular: q → 0</option><option value="trapezoid">Distribuída trapezoidal: q1 → q2</option></select></label>{(loadEditor.kind==='pointY'||loadEditor.kind==='pointX'||loadEditor.kind==='moment')?<div className="fields"><NumInput label="Posição x desde o nó inicial" value={loadEditor.x} onChange={v=>setLoadEditor(x=>x?{...x,x:v}:x)} unit="m" step={0.1} min={0}/><NumInput label={loadEditor.kind==='moment'?'Momento M':loadEditor.kind==='pointX'?'Força Px':'Força Py'} value={loadEditor.value} onChange={v=>setLoadEditor(x=>x?{...x,value:v}:x)} unit={loadEditor.kind==='moment'?'kNm':'kN'} step={1}/></div>:<><div className="fields"><NumInput label="Início a" value={loadEditor.a} onChange={v=>setLoadEditor(x=>x?{...x,a:v}:x)} unit="m" step={0.1} min={0}/><NumInput label="Fim b" value={loadEditor.b} onChange={v=>setLoadEditor(x=>x?{...x,b:v}:x)} unit="m" step={0.1} min={0}/></div><div className="fields"><NumInput label={loadEditor.kind==='trapezoid'?'q1':loadEditor.kind==='triGrow'?'q final':'q'} value={loadEditor.value} onChange={v=>setLoadEditor(x=>x?{...x,value:v}:x)} unit="kN/m" step={0.5}/>{loadEditor.kind==='trapezoid'&&<NumInput label="q2" value={loadEditor.value2} onChange={v=>setLoadEditor(x=>x?{...x,value2:v}:x)} unit="kN/m" step={0.5}/>}</div></>}<div className="modalNote"><b>Exemplos:</b> carga vertical para baixo numa viga horizontal → Py ou q negativos. A carga distribuída pode ser parcial usando a e b.</div><div className="modalActions"><button className="secondary" onClick={()=>setLoadEditor(null)}>Cancelar</button><button onClick={saveMemberLoad}>{loadEditor.loadId?'Guardar alterações':'Adicionar carga'}</button></div></div></div>}

    <nav className="bottomNav">{bottomTabs.map(x=><button key={x.tab} className={tab===x.tab?'active':''} onClick={()=>setTab(x.tab)}><span>{x.icon}</span><small>{x.label}</small></button>)}</nav>
    <footer>RJP Structures V1.7.4 · WebApp + Android · Português de Portugal · MEF 2D · Betão Armado EC2 · acessibilidade · gravação automática · editor gráfico</footer>
  </div>
}
