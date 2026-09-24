export class CaptureTool {
  constructor(sceneManager,toast){this.scene=sceneManager;this.toast=toast;}
  open(){
    const sm=this.scene,helper=sm.transformControls.getHelper(),visibility=helper.visible;
    helper.visible=false;
    sm.renderer.render(sm.scene,sm.camera);
    const canvas=sm.renderer.domElement,w=canvas.width,h=canvas.height;
    const output=document.createElement('canvas');output.width=w;output.height=h;
    const ctx=output.getContext('2d');ctx.drawImage(canvas,0,0);
    const rect=canvas.getBoundingClientRect(),sx=w/rect.width,sy=h/rect.height;
    for(const label of sm.container.querySelectorAll('.measure-label')){
      const r=label.getBoundingClientRect();if(r.right<rect.left||r.left>rect.right||r.top>rect.bottom||r.bottom<rect.top)continue;
      const x=(r.left-rect.left)*sx,y=(r.top-rect.top)*sy,lines=label.textContent.split('\n');
      ctx.fillStyle='#18333f';ctx.fillRect(x,y,r.width*sx,r.height*sy);ctx.fillStyle='#e1f5fc';ctx.font=`${11*sy}px monospace`;lines.forEach((line,i)=>ctx.fillText(line,x+6*sx,y+(15+i*15)*sy));
    }
    output.toBlob(blob=>{
      if(!blob){this.toast?.('No se ha podido crear la captura.');return;}
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ESTRUCTURAS-PRO-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      this.toast?.(`PNG exportado · ${w} × ${h} px`);
    },'image/png');
    helper.visible=visibility;sm.renderer.render(sm.scene,sm.camera);
  }
}
