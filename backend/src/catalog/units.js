export const standardUnits=[
{code:'g',name:'Gram',dimension:'mass',decimalPlaces:3,aliases:['g','gr','gram']},
{code:'kg',name:'Kilogram',dimension:'mass',decimalPlaces:6,aliases:['kg','kilogram']},
{code:'ml',name:'Mililitre',dimension:'volume',decimalPlaces:3,aliases:['ml','mililitre']},
{code:'l',name:'Litre',dimension:'volume',decimalPlaces:6,aliases:['l','lt','litre','liter']},
{code:'kova',name:'Kova',dimension:'package',decimalPlaces:0,aliases:['kova']}
];
// Only physical mass/volume ratios are automatic. Packages and portions need real content.
export function standardFactor(from,to){
 const a=standardUnits.find(unit=>unit.aliases.includes(String(from.code).toLocaleLowerCase('tr-TR'))&&unit.dimension===from.dimension);
 const b=standardUnits.find(unit=>unit.aliases.includes(String(to.code).toLocaleLowerCase('tr-TR'))&&unit.dimension===to.dimension);
 if(!a||!b||a.dimension!==b.dimension||a.dimension==='package')return null;
 const scale={g:1000000n,kg:1000000000n,ml:1000000n,l:1000000000n};
 return scale[a.code]*1000000n/scale[b.code];
}
