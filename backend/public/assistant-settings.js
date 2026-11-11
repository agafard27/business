import {html,input,formShell,commandForm} from './business-ui.js';
export async function renderAssistantSettings(node,context){
  const {request,message,isCurrent,user}=context;if(!user.permissions.includes('settings.manage'))return;
  node.innerHTML='<h3>Yapay zekâ bağlantısı</h3><p role="status">Bağlantı ayarı getiriliyor…</p>';
  let data;try{data=await request('/api/assistant/configuration');}catch(error){if(isCurrent())node.innerHTML='<h3>Yapay zekâ bağlantısı</h3><p>'+html(message(error))+'</p>';return;}if(!isCurrent())return;
  node.innerHTML=`<h3>Yapay zekâ bağlantısı</h3><p>Program kullanım rehberi · OpenAI · ${html(data.model)}</p><p>API anahtarını yalnız buraya gir. Anahtar bu Windows hesabıyla şifrelenir ve geri gösterilmez. API kullanımı OpenAI hesabının kullanım ücretine tabidir.</p><p>${data.hasKey?'Kayıtlı anahtar var. Değiştirmeyeceksen alanı boş bırak.':'Henüz API anahtarı girilmemiş.'}</p>${formShell(input('apiKey',data.hasKey?'Yeni API anahtarı (isteğe bağlı)':'API anahtarı','','type="password" autocomplete="new-password" maxlength="512" spellcheck="false"')+'<label><input type="checkbox" name="enabled" '+(data.enabled?'checked':'')+'> Yapay zekâ rehberini etkinleştir</label>').replace('>Kaydet</button>','>Bağlantı ayarını kaydet</button>')}`;
  commandForm(node.querySelector('form'),{request,message,path:'/api/assistant/configuration',values:form=>({revision:data.revision,enabled:form.has('enabled'),apiKey:String(form.get('apiKey')).trim()}),success:()=>renderAssistantSettings(node,context)});
}
