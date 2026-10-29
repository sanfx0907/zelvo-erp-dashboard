import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCalculatorExpression } from './calculator.js';

test('calculator follows order of operations', () => {
  assert.equal(evaluateCalculatorExpression('12+3*4'), 24);
  assert.equal(evaluateCalculatorExpression('(12+3)*4'), 60);
});

test('calculator supports decimals, signs, and percentages', () => {
  assert.equal(evaluateCalculatorExpression('-2.5 + 5'), 2.5);
  assert.equal(evaluateCalculatorExpression('200*10%'), 20);
});

test('calculator accepts display operators and rejects unsafe or invalid input', () => {
  assert.equal(evaluateCalculatorExpression('8×3−4'), 20);
  assert.throws(() => evaluateCalculatorExpression('5/0'), /divide by zero/i);
  assert.throws(() => evaluateCalculatorExpression('2+unknown'), /check the calculation/i);
  assert.throws(() => evaluateCalculatorExpression('2+3)'));
});
