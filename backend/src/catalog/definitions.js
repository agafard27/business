import {standardUnits,standardFactor} from './units.js';
import { identifier } from './validation.js';
import { object,text,key,money,decimal,decimalString,problem,conflict,operate,snapshot } from '../business/core.js';
export function createDefinitionService(config){
  const write=(type,permission,input,actorId,payload,action)=>operate(config,{type,permission,actorId,requestKey:key(input.requestKey),payload},action);
  return {
    async meta(){return snapshot(config,async connection=>{
      const [products]=await connection.query('SELECT p.id,p.code,p.name,p.product_type,p.stock_mode,p.stock_timing,p.base_unit_id,p.preparation_station_id,p.revision,p.track_lots,p.reorder_quantity,u.code AS unit_code FROM products p LEFT JOIN units u ON u.id=p.base_unit_id WHERE p.is_active=TRUE ORDER BY p.name LIMIT 2000');
      const [units]=await connection.query('SELECT id,code,name,dimension,decimal_places FROM units ORDER BY name');
      const [stations]=await connection.query('SELECT id,name FROM preparation_stations WHERE is_active=TRUE ORDER BY name');
      const [warehouses]=await connection.query('SELECT id,name FROM warehouses WHERE is_active=TRUE ORDER BY name');
      const [suppliers]=await connection.query('SELECT id,name FROM parties WHERE is_active=TRUE AND is_supplier=TRUE ORDER BY name LIMIT 1000');
      const [recipes]=await connection.query('SELECT r.id,r.name,v.id AS version_id,v.version,v.product_id,v.output_quantity_base FROM recipes r JOIN recipe_versions v ON v.recipe_id=r.id WHERE r.is_active=TRUE ORDER BY r.id,v.version DESC');
      const [ingredients]=await connection.query('SELECT recipe_version_id,product_id,quantity_base FROM recipe_ingredients ORDER BY recipe_version_id,product_id');
      const [options]=await connection.query(`SELECT o.id,o.product_id,o.code,o.name,o.is_active,v.sale_unit_id,v.unit_price_minor,v.price_basis_quantity,v.content_quantity_base,v.requires_weight,r.recipe_version_id,r.recipe_multiplier,v.id AS version_id FROM sale_options o JOIN sale_option_versions v ON v.id=(SELECT cv.id FROM sale_option_versions cv WHERE cv.sale_option_id=o.id ORDER BY cv.version DESC LIMIT 1) LEFT JOIN sale_option_recipes r ON r.option_version_id=v.id ORDER BY o.id`);
      const [components]=await connection.query('SELECT option_version_id,component_product_id,quantity_base FROM sale_option_components ORDER BY option_version_id,component_product_id');
      return {products:products.map(row=>({id:String(row.id),code:row.code,name:row.name,type:row.product_type,stockMode:row.stock_mode,stockTiming:row.stock_timing,unitId:row.base_unit_id===null?null:String(row.base_unit_id),unitCode:row.unit_code,stationId:row.preparation_station_id===null?null:String(row.preparation_station_id),revision:String(row.revision),trackLots:Boolean(row.track_lots),reorderQuantity:row.reorder_quantity})),
        units:units.map(row=>({id:String(row.id),code:row.code,name:row.name,dimension:row.dimension,decimalPlaces:row.decimal_places})),stations:stations.map(row=>({id:String(row.id),name:row.name})),
        recipes:recipes.map(row=>({id:String(row.id),name:row.name,versionId:String(row.version_id),version:Number(row.version),productId:String(row.product_id),outputQuantity:row.output_quantity_base,ingredients:ingredients.filter(item=>String(item.recipe_version_id)===String(row.version_id)).map(item=>({productId:String(item.product_id),quantity:item.quantity_base}))})),
        options:options.map(row=>({id:String(row.id),productId:String(row.product_id),code:row.code,name:row.name,isActive:Boolean(row.is_active),unitId:String(row.sale_unit_id),priceMinor:String(row.unit_price_minor),basisQuantity:row.price_basis_quantity,contentQuantity:row.content_quantity_base,requiresWeight:Boolean(row.requires_weight),recipeVersionId:row.recipe_version_id===null?null:String(row.recipe_version_id),recipeMultiplier:row.recipe_multiplier||'1.000000',components:components.filter(item=>String(item.option_version_id)===String(row.version_id)).map(item=>({productId:String(item.component_product_id),quantity:item.quantity_base}))})),
        warehouses:warehouses.map(row=>({id:String(row.id),name:row.name})),suppliers:suppliers.map(row=>({id:String(row.id),name:row.name}))};
    });},
    async standardUnits(input,actorId){
      object(input,['requestKey']);
      return write('catalog.units.standard','catalog.manage',input,actorId,{},async connection=>{
        const ids=[];
        for(const unit of standardUnits){
          const [matches]=await connection.execute(`SELECT id,dimension FROM units WHERE LOWER(code) IN (${unit.aliases.map(()=>'?').join(',')}) OR name=? FOR UPDATE`,[...unit.aliases,unit.name]);
          if(matches.some(row=>row.dimension!==unit.dimension))throw problem(409,'UNIT_CONFLICT','Var olan standart birimin boyutu farklı. Birim tanımlarını kontrol edin.');
          if(matches.length){ids.push(String(matches[0].id));continue;}
          await connection.execute('INSERT INTO units(code,name,dimension,decimal_places) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id=units.id',[unit.code,unit.name,unit.dimension,unit.decimalPlaces]);
          const [[saved]]=await connection.execute('SELECT id,dimension FROM units WHERE code=?',[unit.code]);if(saved.dimension!==unit.dimension)throw conflict();ids.push(String(saved.id));
        }
        return {ids};
      });
    },
    async unit(input,actorId){
      object(input,['requestKey','code','name','dimension','decimalPlaces']);const payload={code:text(input.code,20,'Birim kodu'),name:text(input.name,80,'Birim adı'),dimension:input.dimension,decimalPlaces:input.decimalPlaces};
      if(!['count','mass','volume','portion','package'].includes(payload.dimension)||!Number.isInteger(payload.decimalPlaces)||payload.decimalPlaces<0||payload.decimalPlaces>6)throw problem(400,'INVALID_INPUT','Birim boyutu veya hassasiyeti geçersiz.');
      return write('catalog.unit.create','catalog.manage',input,actorId,payload,async connection=>{const [result]=await connection.execute('INSERT INTO units(code,name,dimension,decimal_places) VALUES (?,?,?,?)',[payload.code,payload.name,payload.dimension,payload.decimalPlaces]);return {id:String(result.insertId)};});
    },
    async category(input,actorId){object(input,['requestKey','name']);const name=text(input.name,120,'Kategori adı');return write('catalog.category.create','catalog.manage',input,actorId,{name},async connection=>{const [row]=await connection.execute('INSERT INTO product_categories(name) VALUES (?)',[name]);return {id:String(row.insertId)};});},
    async station(input,actorId){object(input,['requestKey','name']);const name=text(input.name,100,'Hazırlık alanı');return write('catalog.station.create','catalog.manage',input,actorId,{name},async connection=>{const [result]=await connection.execute('INSERT INTO preparation_stations(code,name) VALUES (?,?)',[`s-${key(input.requestKey)}`,name]);return {id:String(result.insertId)};});},
    async product(input,actorId){
      object(input,['requestKey','code','name','type','unitId','stockMode','stockTiming','stationId','trackLots','reorderQuantity']);
      const payload={code:text(input.code,80,'Ürün kodu'),name:text(input.name,180,'Ürün adı'),type:input.type,unitId:identifier(input.unitId),stockMode:input.stockMode,stockTiming:input.stockTiming,
        stationId:input.stationId?identifier(input.stationId):null,trackLots:input.trackLots,reorderQuantity:input.reorderQuantity?decimalString(decimal(input.reorderQuantity,{zero:true})):null};
      if(!['ready','prepared','ingredient','consumable'].includes(payload.type)||!['none','direct','recipe'].includes(payload.stockMode)||!['sale','submission','preparation','manual'].includes(payload.stockTiming)||typeof payload.trackLots!=='boolean')throw problem(400,'INVALID_INPUT','Ürün türü veya stok kuralı geçersiz.');
      return write('catalog.product.create','catalog.manage',input,actorId,payload,async connection=>{
        const [result]=await connection.execute('INSERT INTO products(code,name,product_type,base_unit_id,stock_mode,stock_timing,preparation_station_id,track_lots,reorder_quantity) VALUES (?,?,?,?,?,?,?,?,?)',[payload.code,payload.name,payload.type,payload.unitId,payload.stockMode,payload.stockTiming,payload.stationId,payload.trackLots,payload.reorderQuantity]);return {id:String(result.insertId)};
      });
    },
    async stockRule(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','stockMode','stockTiming','stationId','trackLots','unitId','reorderQuantity']);const payload={id,revision:identifier(input.revision),stockMode:input.stockMode,stockTiming:input.stockTiming,stationId:input.stationId?identifier(input.stationId):null,trackLots:input.trackLots,unitId:identifier(input.unitId),reorderQuantity:input.reorderQuantity?decimalString(decimal(input.reorderQuantity,{zero:true})):null};
      if(!['none','direct','recipe'].includes(payload.stockMode)||!['sale','submission','preparation','manual'].includes(payload.stockTiming)||typeof payload.trackLots!=='boolean')throw problem(400,'INVALID_INPUT','Stok kuralı geçersiz.');
      return write('catalog.stock.rule','catalog.manage',input,actorId,payload,async connection=>{
        const [[row]]=await connection.execute('SELECT revision,base_unit_id FROM products WHERE id=? FOR UPDATE',[id]);if(!row)throw problem(404,'NOT_FOUND','Ürün bulunamadı.');if(String(row.revision)!==payload.revision)throw conflict();
        if(String(row.base_unit_id)!==payload.unitId){const [[used]]=await connection.execute('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id=?',[id]);if(Number(used.count))throw problem(409,'UNIT_IN_USE','Stok hareketi olan ürünün temel birimi değiştirilemez.');}
        await connection.execute('UPDATE products SET base_unit_id=?,stock_mode=?,stock_timing=?,preparation_station_id=?,track_lots=?,reorder_quantity=?,revision=revision+1 WHERE id=?',[payload.unitId,payload.stockMode,payload.stockTiming,payload.stationId,payload.trackLots,payload.reorderQuantity,id]);return {id};
      });
    },
    async option(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','code','name','unitId','priceMinor','basisQuantity','contentQuantity','requiresWeight','recipeVersionId','recipeMultiplier','components','optionId','isActive']);
      const payload={id,revision:identifier(input.revision),code:text(input.code,80,'Servis kodu'),name:text(input.name,120,'Servis adı'),unitId:identifier(input.unitId),priceMinor:money(input.priceMinor,{zero:true}),basisQuantity:decimalString(decimal(input.basisQuantity)),
        contentQuantity:input.contentQuantity?decimalString(decimal(input.contentQuantity)):null,requiresWeight:input.requiresWeight,recipeVersionId:input.recipeVersionId?identifier(input.recipeVersionId):null,recipeMultiplier:decimalString(decimal(input.recipeMultiplier||'1')),optionId:input.optionId?identifier(input.optionId):null,isActive:input.isActive===undefined?true:input.isActive,
        components:(input.components||[]).map(item=>{object(item,['productId','quantity']);return {productId:identifier(item.productId),quantity:decimalString(decimal(item.quantity))};})};
      if(typeof payload.requiresWeight!=='boolean'||typeof payload.isActive!=='boolean'||payload.components.length>30||new Set(payload.components.map(item=>item.productId)).size!==payload.components.length)throw problem(400,'INVALID_INPUT','Servis bileşenleri geçersiz.');
      if(payload.optionId&&(!Object.hasOwn(input,'components')||!Object.hasOwn(input,'recipeVersionId')))throw problem(400,'INVALID_INPUT','Düzenlenen servisin reçete ve bileşenlerini eksiksiz gönderin.');
      return write('catalog.option.save','catalog.manage',input,actorId,payload,async(connection,_operation,actor)=>{
        const [[product]]=await connection.execute('SELECT revision,base_unit_id FROM products WHERE id=? FOR UPDATE',[id]);if(!product)throw problem(404,'NOT_FOUND','Ürün bulunamadı.');if(String(product.revision)!==payload.revision)throw conflict();
        let optionId=payload.optionId,nextVersion=1,validFrom;
        if(optionId){const [[option]]=await connection.execute('SELECT id FROM sale_options WHERE id=? AND product_id=? FOR UPDATE',[optionId,id]);if(!option)throw problem(400,'INVALID_OPTION','Servis ürüne ait değil.');const [[latest]]=await connection.execute('SELECT version,valid_from_utc,valid_from_utc<=UTC_TIMESTAMP(6) AS valid FROM sale_option_versions WHERE sale_option_id=? ORDER BY version DESC LIMIT 1',[optionId]);if(!latest?.valid)throw problem(409,'FUTURE_PRICE_EXISTS','Servisin ileri tarihli fiyatını önce kontrol edin.');nextVersion=Number(latest.version)+1;validFrom=latest.valid_from_utc;await connection.execute('UPDATE sale_options SET code=?,name=?,is_active=? WHERE id=?',[payload.code,payload.name,payload.isActive,optionId]);}
        else{const [created]=await connection.execute('INSERT INTO sale_options(product_id,code,name,is_active) VALUES (?,?,?,?)',[id,payload.code,payload.name,payload.isActive]);optionId=String(created.insertId);}
        let contentQuantity=payload.contentQuantity;
        if(contentQuantity===null){
          const [units]=await connection.execute('SELECT id,code,dimension FROM units WHERE id IN (?,?)',[payload.unitId,product.base_unit_id]);
          const source=units.find(unit=>String(unit.id)===payload.unitId),base=units.find(unit=>String(unit.id)===String(product.base_unit_id));
          const factor=source&&base?standardFactor(source,base):null;if(factor!==null)contentQuantity=decimalString(factor);
        }
        const [version]=await connection.execute(`INSERT INTO sale_option_versions(sale_option_id,product_id,version,sale_unit_id,unit_price_minor,price_basis_quantity,content_quantity_base,requires_weight,valid_from_utc,created_by) VALUES (?,?,?,?,?,?,?,?,GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,COALESCE(?,UTC_TIMESTAMP(6)))),?)`,[optionId,id,nextVersion,payload.unitId,payload.priceMinor,payload.basisQuantity,contentQuantity,payload.requiresWeight,validFrom||null,actor]);
        if(payload.recipeVersionId)await connection.execute('INSERT INTO sale_option_recipes(option_version_id,recipe_version_id,product_id,recipe_multiplier) VALUES (?,?,?,?)',[version.insertId,payload.recipeVersionId,id,payload.recipeMultiplier]);
        for(const component of payload.components)await connection.execute('INSERT INTO sale_option_components(option_version_id,component_product_id,quantity_base) VALUES (?,?,?)',[version.insertId,component.productId,component.quantity]);
        await connection.execute('UPDATE products SET revision=revision+1 WHERE id=?',[id]);return {id:optionId};
      });
    },
    async barcode(id,input,actorId){id=identifier(id);object(input,['requestKey','barcode','optionId']);const payload={id,barcode:text(input.barcode,100,'Barkod'),optionId:input.optionId?identifier(input.optionId):null};if(!/^[\x21-\x7e]+$/.test(payload.barcode))throw problem(400,'INVALID_INPUT','Barkod geçersiz.');return write('catalog.barcode.create','catalog.manage',input,actorId,payload,async connection=>{await connection.execute('INSERT INTO product_barcodes(barcode,product_id,sale_option_id) VALUES (?,?,?)',[payload.barcode,id,payload.optionId]);return {saved:true};});},
    async conversion(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','unitId','baseQuantity']);const payload={id,revision:identifier(input.revision),unitId:identifier(input.unitId),baseQuantity:decimalString(decimal(input.baseQuantity))};
      return write('catalog.conversion.save','catalog.manage',input,actorId,payload,async connection=>{
        const [[product]]=await connection.execute('SELECT revision,base_unit_id FROM products WHERE id=? FOR UPDATE',[id]);if(!product||String(product.revision)!==payload.revision)throw conflict();
        const [[units]]=await connection.execute('SELECT source.code AS source_code,base.code AS base_code,source.dimension AS source_dimension,base.dimension AS base_dimension FROM units source JOIN units base ON base.id=? WHERE source.id=?',[product.base_unit_id,payload.unitId]);
        if(!units||units.source_dimension!==units.base_dimension||['package','portion'].includes(units.source_dimension)||String(product.base_unit_id)===payload.unitId)throw problem(400,'INVALID_CONVERSION','Yalnız aynı boyuttaki sabit birimler dönüştürülebilir. Değişken ambalaj içeriğini mal kabulünde girin.');
        const factor=standardFactor({code:units.source_code,dimension:units.source_dimension},{code:units.base_code,dimension:units.base_dimension});
        if(factor!==null&&decimal(payload.baseQuantity)!==factor)throw problem(400,'INVALID_CONVERSION','Kilogram–gram ve litre–mililitre dönüşümü 1000 katıdır. Miktarı kontrol edin.');
        await connection.execute('INSERT INTO product_unit_conversions(product_id,from_unit_id,base_quantity) VALUES (?,?,?) ON DUPLICATE KEY UPDATE base_quantity=?,is_active=TRUE',[id,payload.unitId,payload.baseQuantity,payload.baseQuantity]);
        await connection.execute('UPDATE products SET revision=revision+1 WHERE id=?',[id]);return {id};
      });
    },
    async recipe(input,actorId){
      object(input,['requestKey','productId','name','outputQuantity','ingredients','recipeId','expectedVersion']);
      if(!Array.isArray(input.ingredients)||!input.ingredients.length||input.ingredients.length>100)throw problem(400,'INVALID_INPUT','Reçete malzemelerini girin.');
      const payload={productId:identifier(input.productId),name:text(input.name,160,'Reçete adı'),outputQuantity:decimalString(decimal(input.outputQuantity)),recipeId:input.recipeId?identifier(input.recipeId):null,expectedVersion:input.recipeId?identifier(input.expectedVersion):null,ingredients:input.ingredients.map(item=>{object(item,['productId','quantity']);return {productId:identifier(item.productId),quantity:decimalString(decimal(item.quantity))};})};
      if(payload.ingredients.some(item=>item.productId===payload.productId)||new Set(payload.ingredients.map(item=>item.productId)).size!==payload.ingredients.length)throw problem(400,'INVALID_INPUT','Reçete malzemelerini kontrol edin.');
      return write('stock.recipe.create','stock.manage',input,actorId,payload,async(connection,_operation,actor)=>{
        let recipeId=payload.recipeId,nextVersion=1;
        if(recipeId){const [[recipe]]=await connection.execute('SELECT product_id FROM recipes WHERE id=? FOR UPDATE',[recipeId]);if(!recipe||String(recipe.product_id)!==payload.productId)throw problem(400,'INVALID_RECIPE','Reçete ürüne ait değil.');const [[latest]]=await connection.execute('SELECT MAX(version) AS version FROM recipe_versions WHERE recipe_id=?',[recipeId]);if(String(latest.version)!==payload.expectedVersion)throw conflict();nextVersion=Number(latest.version)+1;await connection.execute('UPDATE recipes SET name=? WHERE id=?',[payload.name,recipeId]);}
        else{const [created]=await connection.execute('INSERT INTO recipes(product_id,name) VALUES (?,?)',[payload.productId,payload.name]);recipeId=String(created.insertId);}
        const [version]=await connection.execute('INSERT INTO recipe_versions(recipe_id,product_id,version,output_quantity_base,created_by) VALUES (?,?,?,?,?)',[recipeId,payload.productId,nextVersion,payload.outputQuantity,actor]);
        for(const item of payload.ingredients)await connection.execute('INSERT INTO recipe_ingredients(recipe_version_id,product_id,quantity_base) VALUES (?,?,?)',[version.insertId,item.productId,item.quantity]);
        return {id:recipeId,versionId:String(version.insertId)};
      });
    }
  };
}
