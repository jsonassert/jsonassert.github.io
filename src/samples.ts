// Sample datasets + expressions, drawn from the engine's test suites
// (official-cases, control-flow, filter/mapper/assert). `expected` documents
// the outcome of every evaluable line, in order; the unit tests enforce it.
import type { LineStatus } from './runner';

export interface Sample {
  id: string;
  title: string;
  json: unknown;
  expr: string;
  expected: Exclude<LineStatus, 'error'>[];
}

const invoice = {
  Account: {
    'Account Name': 'Firefly',
    Order: [
      {
        OrderID: 'order103',
        Product: [
          {
            'Product Name': 'Bowler Hat', ProductID: 858383, SKU: '0406654608',
            Description: { Colour: 'Purple', Width: 300, Height: 200, Depth: 210, Weight: 0.75 },
            Price: 34.45, Quantity: 2
          },
          {
            'Product Name': 'Trilby hat', ProductID: 858236, SKU: '0406634348',
            Description: { Colour: 'Orange', Width: 300, Height: 200, Depth: 210, Weight: 0.6 },
            Price: 21.67, Quantity: 1
          }
        ]
      },
      {
        OrderID: 'order104',
        Product: [
          {
            'Product Name': 'Bowler Hat', ProductID: 858383, SKU: '040657863',
            Description: { Colour: 'Purple', Width: 300, Height: 200, Depth: 210, Weight: 0.75 },
            Price: 34.45, Quantity: 4
          },
          {
            'Product Name': 'Cloak', ProductID: 345664, SKU: '0406654603',
            Description: { Colour: 'Black', Width: 30, Height: 20, Depth: 210, Weight: 2.0 },
            Price: 107.99, Quantity: 1
          }
        ]
      }
    ]
  }
};

const cart = {
  customer: { name: 'Ada', tier: 'gold' },
  currency: 'BRL',
  itens: [
    { nome: 'Keyboard', valor: 10, qty: 2 },
    { nome: 'Monitor', valor: 50, qty: 1 },
    { nome: 'Mouse', valor: 20, qty: 3 }
  ]
};

export const SAMPLES: Sample[] = [
  {
    id: 'invoice',
    title: 'Invoice: totals & aggregates',
    json: invoice,
    expr: [
      '// One assert per line: assert <expr> (==|!=|>|>=|<|<=) <expr>',
      'assert $sum(Account.Order.Product.(Price * Quantity)) == 336.36',
      'assert $sum(Account.Order.Product.Price) == 198.56',
      'assert $max(Account.Order.Product.(Price * Quantity)) == 137.8',
      'assert $min(Account.Order.Product.(Price * Quantity)) == 21.67',
      'assert $avg(Account.Order.Product.(Price * Quantity)) == 84.09',
      'assert $count(Account.Order) == 2',
      '',
      '// Lines without `assert` are evaluated and their value is shown',
      'Account.Order.Product.(Price * Quantity)'
    ].join('\n'),
    expected: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'value']
  },
  {
    id: 'predicates',
    title: 'Invoice: filters & predicates',
    json: invoice,
    expr: [
      'assert $count(Account.Order.Product[Price > 20]) == 4',
      'assert $count(Account.Order.Product[Price < 30]) == 1',
      "assert $count(Account.Order.Product[Description.Colour = 'Purple']) == 2",
      'assert $count(Account.Order.Product[Price > 30 and Quantity > 2]) == 1',
      'assert $count(Account.Order.Product[Price < 30 or Price > 100]) == 2',
      "assert $count(Account.Order.Product[not(Description.Colour = 'Purple')]) == 2",
      'Account.Order.Product[Price > 100].SKU'
    ].join('\n'),
    expected: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'value']
  },
  {
    id: 'paths',
    title: 'Invoice: paths & indexes',
    json: invoice,
    expr: [
      "assert Account.Order[0].OrderID == 'order103'",
      'assert Account.Order[0].Product[1].Price == 21.67',
      '// brackets bind per parent group, like official JSONata',
      'assert Account.Order[1].Product[-1].Price == 107.99',
      'assert Account.Order.Product[0].Description.Width == 300',
      'assert Account.Order.Product.(Price * Quantity) == [68.9, 21.67, 137.8, 107.99]',
      'assert [1, 2, 3][1] == 2'
    ].join('\n'),
    expected: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass']
  },
  {
    id: 'higher-order',
    title: 'Functions: $map / $filter / $reduce',
    json: cart,
    expr: [
      'assert $count(itens) == 3',
      'assert $map(itens, function($v) { $v.valor }) == [10, 50, 20]',
      'assert $count($filter(itens, function($v) { $v.valor > 20 })) == 1',
      'assert $reduce(itens, function($acc, $v) { $acc + $v.valor * $v.qty }, 0) == 130',
      'assert $sum(itens.(valor * qty)) >= 100',
      '$filter(itens, function($v) { $v.qty > 1 }).nome'
    ].join('\n'),
    expected: ['pass', 'pass', 'pass', 'pass', 'pass', 'value']
  },
  {
    id: 'control-flow',
    title: 'Control flow: if / switch / for',
    json: cart,
    expr: [
      "assert if (customer.tier = 'gold') 0.1 else 0 == 0.1",
      "assert if ($count(itens) >= 9) 'A' else if ($count(itens) >= 3) 'B' else 'C' == 'B'",
      "assert switch (currency) { case 'BRL': 'reais'; case 'USD': 'dollars'; default: 'other' } == 'reais'",
      'assert for (item in itens) item.valor * 2 == [20, 100, 40]',
      'assert for (item, i in itens) i == [0, 1, 2]',
      'assert $sum(for (item in itens) item.valor) == 80'
    ].join('\n'),
    expected: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass']
  },
  {
    id: 'while',
    title: 'Engine-only: while over $',
    json: 1,
    expr: [
      '// while folds over the current value ($); no JSONata equivalent',
      'assert while ($ < 100) $ * 2 == 128',
      'assert while ($ > 1000) $ * 2 == 1',
      'while ($ < 10) $ + 3'
    ].join('\n'),
    expected: ['pass', 'pass', 'value']
  },
  {
    id: 'failing',
    title: 'A failing assertion',
    json: invoice,
    expr: [
      '// Failing lines show both evaluated sides',
      'assert $count(Account.Order) == 3',
      "assert Account.Order[0].OrderID != 'order103'",
      'assert $sum(Account.Order.Product.Quantity) > 8',
      '// ...next to passing ones',
      'assert $sum(Account.Order.Product.Quantity) == 8'
    ].join('\n'),
    expected: ['fail', 'fail', 'fail', 'pass']
  }
];

export const DEFAULT_SAMPLE = SAMPLES[0]!;

export function sampleJson(sample: Sample): string {
  return JSON.stringify(sample.json, null, 2);
}
