import test from 'node:test';
import assert from 'node:assert/strict';
import { decimal,decimalString,money,roundedRatio } from '../src/business/core.js';
test('kesin miktar ve kuruş hesabı kayan nokta kaybı veya bilimsel gösterim kabul etmez',()=>{
  for(const value of [1,'1e3','-1','0.0000001','01','1,5'])assert.throws(()=>decimal(value),{code:'INVALID_INPUT'});
  assert.equal(decimalString(decimal('123.000001')),'123.000001');
  assert.equal(roundedRatio(decimal('300')*33333n,decimal('1000')),10000n);
  let paid=0n;
  for(const grams of [100n,200n,300n]){const cumulative=roundedRatio(grams*10000n,300n);const share=cumulative-paid;assert.ok(share>=0n);paid+=share;}
  assert.equal(paid,10000n);
  for(const value of [0,'0','1.1','1e3','-1','9007199254740993'])assert.throws(()=>money(value),{code:'INVALID_INPUT'});
});
