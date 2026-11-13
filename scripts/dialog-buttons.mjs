export function orderedExportButtons(options){
 const rank=button=>['connect','network','direct'].includes(button.action)?0:['cancel','close'].includes(button.action)?2:1;
 return {...options,buttons:[...(options.buttons??[])].sort((a,b)=>rank(a)-rank(b))};
}
