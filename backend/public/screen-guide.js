import {guideTopics} from './guide-scenarios.js';
import {availableScreens,normalizeNavigation} from './navigation-catalog.js';
import {html} from './business-ui.js';
export function availableGuides(user,query=''){
 const screens=new Map(availableScreens(user).map(row=>[row.id,row]));
 const terms=normalizeNavigation(query).split(' ').filter(Boolean);
 return guideTopics.filter(row=>screens.has(row.screenId)).map(row=>({...row,screenName:screens.get(row.screenId).name})).filter(row=>{const text=normalizeNavigation([row.screenName,row.title,...row.steps,row.result,row.note||''].join(' '));return terms.every(term=>text.includes(term));});
}
export const scenarioHtml=row=>`<details class="guide-scenario"><summary>${html(row.title)}</summary><ol>${row.steps.map(step=>'<li>'+html(step)+'</li>').join('')}</ol><p><strong>Sonuç:</strong> ${html(row.result)}</p>${row.openScreen?'<button type="button" class="secondary" data-guide="'+html(row.screenId)+'">İlgili ekranı aç</button>':''}${row.note?'<p class="guide-note">'+html(row.note)+'</p>':''}</details>`;
export function mountScreenGuide(node,user,screenId){
 const topics=availableGuides(user).filter(row=>row.screenId===screenId);
 node.innerHTML=topics.length?`<details class="screen-guide"><summary>Bu ekranı nasıl kullanırım? · Örnekler</summary><p class="guide-note">Örnek tutar ve miktarlar eğitim içindir; gerçek kayıt oluşturmaz.</p>${topics.map(scenarioHtml).join('')}</details>`:'';
}
