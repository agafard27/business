import test from 'node:test';
import assert from 'node:assert/strict';
import {formatQuantity} from '../public/quantity-format.js';
test('bir adet ile gerçek bir milyon adet farklı ve Türkçe okunur görünür',()=>{
  assert.equal(formatQuantity('1.000000'),'1');
  assert.equal(formatQuantity('1000000.000000'),'1.000.000');
  assert.equal(formatQuantity('2.000000'),'2');
});
test('gram, litre ve negatif stok farkı hassasiyet kaybetmeden gösterilir',()=>{
  assert.equal(formatQuantity('250.000000'),'250');
  assert.equal(formatQuantity('1.250000'),'1,25');
  assert.equal(formatQuantity('-0.000001'),'−0,000001');
  assert.equal(formatQuantity('9007199254740993.125000'),'9.007.199.254.740.993,125');
});
