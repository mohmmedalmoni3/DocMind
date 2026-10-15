/** Query expansion only. Never transliterate arbitrary names, codes or numbers. */
export function arabiziView(query:string):string|undefined {
 const aliases:Record<string,string>={shu:'شو',shoo:'شو',shno:'شنو',keef:'كيف',kif:'كيف',wein:'وين',wen:'وين',kam:'كم','2addeesh':'قديش',addeesh:'قديش',sa3at:'ساعات',sa3a:'ساعة',elcourse:'الدورة',eldawra:'الدورة',dawra:'دورة',wshu:'وشو',wkam:'وكم'};
 // Require at least two known conversational words: "KAM" may be a code/name.
 const tokens=query.match(/[A-Za-z0-9]+/g)||[];
 if(tokens.filter(t=>Object.hasOwn(aliases,t.toLowerCase())).length<2)return;
 let changed=false;
 const expanded=query.replace(/"[^"\n]*"|«[^»\n]*»|`[^`\n]*`|[A-Za-z0-9]+/g,word=>{
  const key=word.toLowerCase();if(!Object.hasOwn(aliases,key))return word;
  changed=true;return aliases[key];
 });
 return changed?expanded:undefined;
}

