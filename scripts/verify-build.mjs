import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { initialOrders, initialSettings } from '../src/lib/api/mockData.js';

const files = (await readdir(new URL('../dist/assets/', import.meta.url))).filter(file => file.endsWith('.js'));
const chunks = await Promise.all(files.map(file => readFile(new URL(`../dist/assets/${file}`, import.meta.url), 'utf8')));
const bundle = chunks.join('\n');
const normalized = value => String(value || '').replace(/\D/g, '').replace(/^0/, '62');
const publicPhone = normalized(initialSettings.kontak?.whatsapp);
const phones = new Set(initialOrders.flatMap(order => [order.customer_phone, order.pelanggan?.telepon, order.customer?.telepon]).filter(value => value && normalized(value) !== publicPhone));
const leaks = [...phones].filter(phone => phone.length >= 10 && (bundle.includes(phone) || bundle.includes(normalized(phone))));
assert.equal(leaks.length, 0, 'Imported customer phone detected in production bundle.');
assert.equal(bundle.includes('admin123'), false, 'Local demo password should not ship in production.');
console.log(`Production privacy checks passed: ${files.length} JS chunks, ${phones.size} imported phone values excluded, no demo password.`);
