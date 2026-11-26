import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLayers } from '../public/js/formula.js';

const { builder } = JSON.parse(readFileSync(new URL('../public/data/data.json', import.meta.url), 'utf8'));

const drink = (over = {}) => ({ base: 'latte', size: 's', milk: 'cow', syrups: [], extras: [], ...over });
const total = (layers) => layers.reduce((sum, layer) => sum + layer.ml, 0);
const ids = (layers) => layers.map((layer) => layer.id);

test('сума шарів дорівнює обʼєму чашки для кожної основи й розміру', () => {
  for (const base of builder.bases) {
    for (const size of builder.sizes) {
      const milk = base.milk === false ? 'none' : 'oat';
      const formula = buildLayers(builder, drink({ base: base.id, size: size.id, milk, syrups: ['vanilla', 'caramel'], extras: ['shot'] }));
      assert.equal(total(formula.layers), formula.volume, `${base.id} ${size.id}`);
    }
  }
});

test('лате: шари йдуть знизу вгору — еспресо, молоко, піна', () => {
  const { layers, volume } = buildLayers(builder, drink());
  assert.deepEqual(ids(layers), ['coffee', 'milk', 'foam']);
  assert.equal(volume, 250);
  assert.ok(layers[1].ml > layers[0].ml, 'молока в лате більше, ніж еспресо');
});

test('сиропи лягають на дно по 15 мл, колір береться з даних', () => {
  const { layers } = buildLayers(builder, drink({ syrups: ['lavender', 'vanilla'] }));
  assert.deepEqual(ids(layers).slice(0, 2), ['syrup-1', 'syrup-2']);
  assert.equal(layers[0].ml, 15);
  assert.equal(layers[0].color, builder.syrups.find((s) => s.id === 'lavender').color);
});

test('без молока зникають і молоко, і піна', () => {
  const { layers } = buildLayers(builder, drink({ base: 'americano', milk: 'none' }));
  assert.deepEqual(ids(layers), ['coffee', 'water']);
});

test('еспресо має власний обʼєм, а додатковий шот додає 30 мл', () => {
  const single = buildLayers(builder, drink({ base: 'espresso', milk: 'none' }));
  const double = buildLayers(builder, drink({ base: 'espresso', milk: 'none', extras: ['shot'] }));
  assert.equal(single.volume, 40);
  assert.equal(double.volume, 70);
  assert.ok(single.fill >= 0.14, 'навіть мала порція помітна в келиху');
});

test('більший розмір вище заповнює келих, топінги передаються окремо', () => {
  const small = buildLayers(builder, drink({ size: 's' }));
  const large = buildLayers(builder, drink({ size: 'l', extras: ['cream', 'shot', 'cinnamon'] }));
  assert.ok(large.fill > small.fill);
  assert.ok(large.fill <= 1);
  assert.deepEqual(large.toppings, ['cream', 'cinnamon']);
});

test('невідома основа не ламає сторінку', () => {
  assert.deepEqual(buildLayers(builder, drink({ base: 'tea' })), { layers: [], volume: 0, fill: 0, toppings: [] });
});
