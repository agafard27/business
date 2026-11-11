export async function watchChanges(node,{request,refresh,onUnauthorized}){
  let cursor;
  async function tick(){
    if(!node.isConnected)return;
    try{
      const result=await request(`/api/changes${cursor===undefined?'':`?after=${cursor}`}`);if(!node.isConnected)return;cursor=result.cursor;
      if(result.changed){node.innerHTML='<button type="button" class="secondary">Yeni kayıtlar var · Ekranı yenile</button>';node.querySelector('button').addEventListener('click',refresh);}
      else if(!node.querySelector('button'))node.textContent='Bağlantı açık · Güncellemeler izleniyor';
    }catch(error){if(!node.isConnected)return;if(error.status===401)return onUnauthorized();node.textContent='Güncelleme bağlantısı kesildi. Son okunan bilgiler gösteriliyor.';}
    if(node.isConnected)setTimeout(tick,3000);
  }
  await tick();
}
