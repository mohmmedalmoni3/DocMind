export function retrievalMetrics(ids:string[],relevant:string[],k:number){
 if(!Number.isInteger(k)||k<1)throw new Error('k must be positive');
 const gold=new Set(relevant);const returned=[...new Set(ids)].slice(0,k);
 if(!gold.size)return {precision:returned.length?0:1,recall:null,mrr:0};
 const hits=returned.filter(id=>gold.has(id)).length;
 const first=returned.findIndex(id=>gold.has(id));
 return {precision:hits/k,recall:hits/gold.size,mrr:first<0?0:1/(first+1)};
}
export function percentile(values:number[],p:number):number|null {
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b);
 return sorted[Math.max(0,Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1))];
}
