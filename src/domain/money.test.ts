import {
  addMoney,
  compareMoney,
  formatMoney,
  money,
  multiplyMoney,
  parseMoney,
  roundHalfAwayFromZero,
  subtractMoney,
  sumMoney,
  toDecimal,
  zeroMoney,
} from './money';

describe('money construction', () => {
  it('rejects non-integer minor units', () => {
    expect(() => money(13.99, 'EUR')).toThrow(/integer in minor units/);
  });

  it('accepts integers and zero', () => {
    expect(money(1399, 'EUR')).toEqual({ amount: 1399, currency: 'EUR' });
    expect(zeroMoney('USD')).toEqual({ amount: 0, currency: 'USD' });
  });
});

describe('parseMoney', () => {
  it('parses a plain decimal', () => {
    expect(parseMoney('13.99', 'EUR').amount).toBe(1399);
  });

  it('accepts a European decimal comma', () => {
    expect(parseMoney('13,99', 'EUR').amount).toBe(1399);
  });

  it('parses whole numbers', () => {
    expect(parseMoney('14', 'EUR').amount).toBe(1400);
  });

  it('pads a single decimal digit', () => {
    expect(parseMoney('13.9', 'EUR').amount).toBe(1390);
  });

  it('handles thousands separators in both conventions', () => {
    expect(parseMoney('1,234.56', 'EUR').amount).toBe(123456);
    expect(parseMoney('1.234,56', 'EUR').amount).toBe(123456);
  });

  it('rounds beyond the currency precision', () => {
    expect(parseMoney('13.994', 'EUR').amount).toBe(1399);
    expect(parseMoney('13.995', 'EUR').amount).toBe(1400);
  });

  it('respects zero-decimal currencies', () => {
    expect(parseMoney('1200', 'JPY').amount).toBe(1200);
    expect(parseMoney('1200.6', 'JPY').amount).toBe(1201);
  });

  it('handles negatives', () => {
    expect(parseMoney('-5.50', 'EUR').amount).toBe(-550);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseMoney('  9.99 ', 'EUR').amount).toBe(999);
  });

  it.each(['', '   ', 'abc', '1.2.3.x', '€9.99'])('rejects %p', (input) => {
    expect(() => parseMoney(input, 'EUR')).toThrow();
  });

  it('avoids the float error that makes 19.99 into 1998.9999…', () => {
    // The naive implementation is Math.round(parseFloat(x) * 100).
    expect(parseMoney('19.99', 'EUR').amount).toBe(1999);
    expect(parseMoney('0.29', 'EUR').amount).toBe(29);
    expect(parseMoney('1.005', 'EUR').amount).toBe(101);
  });
});

describe('roundHalfAwayFromZero', () => {
  it('rounds .5 away from zero in both directions', () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1); // Math.round gives -0 here
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
    expect(roundHalfAwayFromZero(-2.6)).toBe(-3);
  });
});

describe('arithmetic', () => {
  it('adds and subtracts exactly', () => {
    const a = money(1999, 'EUR');
    const b = money(1099, 'EUR');
    expect(addMoney(a, b).amount).toBe(3098);
    expect(subtractMoney(a, b).amount).toBe(900);
  });

  it('is exact where floats are not', () => {
    // 0.1 + 0.2 !== 0.3 in float; in minor units it is simply 10 + 20 === 30.
    const total = addMoney(money(10, 'EUR'), money(20, 'EUR'));
    expect(total.amount).toBe(30);
    expect(toDecimal(total)).toBe(0.3);
  });

  it('refuses to mix currencies', () => {
    expect(() => addMoney(money(100, 'EUR'), money(100, 'USD'))).toThrow(
      /convert via fx first/,
    );
  });

  it('multiplies with rounding', () => {
    expect(multiplyMoney(money(1999, 'EUR'), 3).amount).toBe(5997);
    expect(multiplyMoney(money(999, 'EUR'), 1 / 3).amount).toBe(333);
    expect(multiplyMoney(money(1000, 'EUR'), 0.125).amount).toBe(125);
  });

  it('compares', () => {
    expect(compareMoney(money(100, 'EUR'), money(200, 'EUR'))).toBeLessThan(0);
    expect(compareMoney(money(200, 'EUR'), money(200, 'EUR'))).toBe(0);
  });
});

describe('sumMoney', () => {
  it('sums a list', () => {
    const values = [money(1399, 'EUR'), money(999, 'EUR'), money(500, 'EUR')];
    expect(sumMoney(values, 'EUR').amount).toBe(2898);
  });

  it('returns zero for an empty list', () => {
    expect(sumMoney([], 'EUR')).toEqual({ amount: 0, currency: 'EUR' });
  });

  it('throws rather than silently dropping a foreign amount', () => {
    expect(() => sumMoney([money(100, 'EUR'), money(100, 'USD')], 'EUR')).toThrow(
      /Expected EUR but found USD/,
    );
  });
});

describe('formatMoney', () => {
  it('puts glyph symbols in front', () => {
    expect(formatMoney(money(1399, 'EUR'))).toBe('€13.99');
    expect(formatMoney(money(999, 'USD'))).toBe('$9.99');
  });

  it('puts word-like symbols after the number', () => {
    expect(formatMoney(money(2000, 'CHF'))).toBe('20.00 CHF');
    expect(formatMoney(money(1550, 'PLN'))).toBe('15.50 zł');
  });

  it('omits decimals for zero-decimal currencies', () => {
    expect(formatMoney(money(1200, 'JPY'))).toBe('¥1,200');
  });

  it('can compact whole amounts', () => {
    expect(formatMoney(money(1400, 'EUR'), { compactWholeAmounts: true })).toBe('€14');
    expect(formatMoney(money(1399, 'EUR'), { compactWholeAmounts: true })).toBe('€13.99');
  });

  it('can omit the symbol', () => {
    expect(formatMoney(money(1399, 'EUR'), { omitSymbol: true })).toBe('13.99');
  });

  it('groups thousands', () => {
    expect(formatMoney(money(123456, 'EUR'))).toBe('€1,234.56');
  });

  it('formats negatives', () => {
    expect(formatMoney(money(-550, 'EUR'))).toBe('€-5.50');
  });
});

describe('toDecimal', () => {
  it('scales by the currency precision', () => {
    expect(toDecimal(money(1399, 'EUR'))).toBe(13.99);
    expect(toDecimal(money(1200, 'JPY'))).toBe(1200);
  });
});
