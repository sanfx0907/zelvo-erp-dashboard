export function evaluateCalculatorExpression(expression) {
  const source = String(expression).replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').replaceAll(' ', '');
  if (!source || source.length > 120) throw new Error('Enter a calculation first.');

  let position = 0;
  const parseExpression = () => {
    let value = parseTerm();
    while (source[position] === '+' || source[position] === '-') {
      const operator = source[position++];
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };
  const parseTerm = () => {
    let value = parseFactor();
    while (source[position] === '*' || source[position] === '/') {
      const operator = source[position++];
      const right = parseFactor();
      if (operator === '/' && right === 0) throw new Error('You cannot divide by zero.');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  const parseFactor = () => {
    let sign = 1;
    while (source[position] === '+' || source[position] === '-') {
      if (source[position++] === '-') sign *= -1;
    }
    let value;
    if (source[position] === '(') {
      position++;
      value = parseExpression();
      if (source[position++] !== ')') throw new Error('Check the brackets in your calculation.');
    } else {
      const match = source.slice(position).match(/^(?:\d+\.?\d*|\.\d+)/);
      if (!match) throw new Error('Check the calculation and try again.');
      position += match[0].length;
      value = Number(match[0]);
    }
    value *= sign;
    while (source[position] === '%') {
      position++;
      value /= 100;
    }
    return value;
  };

  const result = parseExpression();
  if (position !== source.length || !Number.isFinite(result)) throw new Error('Check the calculation and try again.');
  return Number(result.toPrecision(12));
}
