import test from 'node:test';
import assert from 'node:assert/strict';

function reprintKey(text, simhash) {
  const body = String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/^RT\s+@[A-Za-z0-9_]+:\s*/i, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  if (body.length >= 24) return `t:${body}`;
  if (simhash != null && Number(simhash) !== 0) return `h:${simhash}`;
  return `t:${body || 'empty'}`;
}

test('reprintKey agrupa RT y original', () => {
  const original = 'Guschmer enfrenta a los Álvarez en Barcelona SC';
  const rt = `RT @alguien: ${original}`;
  assert.equal(reprintKey(original, 1), reprintKey(rt, 99));
});

test('reprintKey corto usa simhash', () => {
  assert.equal(reprintKey('hola', 42), 'h:42');
  assert.equal(reprintKey('hola', 0), 't:hola');
});
