// Presentation only: a MySQL DECIMAL string already expresses real units.
// Never divide it by the internal BigInt scale again.
export function formatQuantity(value){
  if(value===null||value===undefined)return '—';
  const match=/^(-?)(\d{1,32})(?:\.(\d{1,6}))?$/.exec(String(value));
  if(!match)throw new Error('Miktar gösterimi geçersiz.');
  const whole=BigInt(match[2]),fraction=(match[3]||'').replace(/0+$/,'');
  const sign=match[1]&&(whole!==0n||fraction)?'−':'';
  return sign+whole.toLocaleString('tr-TR')+(fraction?','+fraction:'');
}
