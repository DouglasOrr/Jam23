import * as T from "../src/tensors"
import { NdArray, assertArrayEquals } from "../src/ndarray"

// Ops

function vector(data: number[]): T.Tensor {
  return new T.Tensor(new NdArray([data.length], data))
}

function assertClose(expected: NdArray, actual: NdArray): void {
  assertArrayEquals(expected.shape, actual.shape)
  expected.data.forEach((v, i) => {
    expect(actual.data[i]).toBeCloseTo(v)
  })
}

function withUnitGrad<T>(fn: () => T.Tensor): T.Tensor {
  return T.withGrad(() => {
    const result = fn()
    result.grad.fill_(1)
    return result
  })
}

test("sigmoid", () => {
  const input = vector([-1, 0, 1])
  const out = withUnitGrad(() => T.sigmoid(input))
  assertClose(vector([0.2689, 0.5, 0.7311]).data, out.data)
  assertClose(vector([0.1966, 0.25, 0.1966]).data, input.grad)
})

test("l1Loss", () => {
  const a = vector([100, 200, 300])
  const b = vector([200, 200, -50])
  const out = withUnitGrad(() => T.l1Loss(a, b))
  assertClose(vector([100, 0, 350]).data, out.data)
  assertClose(vector([-1, 0, 1]).data, a.grad)
  assertClose(vector([1, 0, -1]).data, b.grad)
})

test("l2Loss", () => {
  const a = vector([1, 2, 3])
  const b = vector([1, -1, 4])
  const out = withUnitGrad(() => T.l2Loss(a, b))
  assertClose(vector([0, 9, 1]).data, out.data)
  assertClose(vector([0, 3, -1]).data, a.grad)
  assertClose(vector([0, -3, 1]).data, b.grad)
})

test("softmaxCrossEntropy", () => {
  const logits = new T.Tensor(
    new NdArray([2, 4], [1000, 1000, 1000, 1000, -2100, -2100, -2000, -2100]),
  )
  const targets = new NdArray([2, 1], [3, 2])
  const loss = withUnitGrad(() => T.softmaxCrossEntropy(logits, targets))
  expect(loss.shape).toStrictEqual([2, 1])
  expect(loss.data.data[0]).toBeCloseTo(Math.log(4))
  expect(loss.data.data[1]).toBeCloseTo(0)
  assertClose(
    vector([1 / 4, 1 / 4, 1 / 4, -3 / 4, 0, 0, 0, 0]).data.view_([2, 4]),
    logits.grad,
  )
})

// All together

// A model for learning to add two numbers [0..9]
class TestModel extends T.Model {
  embed: T.Parameter
  W0: T.Parameter
  W1: T.Parameter

  constructor() {
    super(
      (shape, scale) =>
        new T.AdamParameter(
          new NdArray(shape).rand_(-scale, scale),
          0.04,
          [0.9, 0.999],
          1e-8,
        ),
    )
    this.embed = this.addParameter([10, 8], 0.1)
    this.W0 = this.addParameter([16, 32], 0.1)
    this.W1 = this.addParameter([32, 20], 0.1)
  }

  logits(inputs: NdArray): T.Tensor {
    let hidden = T.view(
      T.gather(
        this.embed,
        new T.Tensor(inputs.clone().view_([inputs.data.length])),
      ),
      [inputs.shape[0], this.W0.shape[0]],
    )
    hidden = T.relu(T.dot(hidden, this.W0))
    return T.dot(hidden, this.W1)
  }

  loss(inputs: NdArray, targets: NdArray): { loss: number; accuracy: number } {
    const logits = this.logits(inputs)
    const loss = T.softmaxCrossEntropy(logits, targets)
    loss.grad.fill_(1)
    return {
      loss: loss.data.mean().data[0],
      accuracy: T.accuracy(logits.data, targets).mean().data[0],
    }
  }
}

test("TestModel training using Tensors", () => {
  // All the pairs of numbers (0..9)
  const inputs = new NdArray([100, 2]).map_((_, i) =>
    i % 2 === 0 ? Math.floor(i / 2) % 10 : Math.floor(i / 20),
  )
  const targets = new NdArray([100, 1]).map_(
    (_, i) => inputs.data[2 * i] + inputs.data[2 * i + 1],
  )
  // Should train quickly & reliably
  const model = new TestModel()
  const log = []
  for (let i = 0; i < 30; ++i) {
    log.push(model.step(() => model.loss(inputs, targets)))
  }
  // Basic convergence checks
  expect(log[0].accuracy).toBeLessThan(0.25) // should be around 0.1
  expect(log[log.length - 1].accuracy).toBeGreaterThan(0.9)
  expect(log[0].loss).toBeGreaterThan(1.5) // should be around ln(20)=3
  expect(log[log.length - 1].loss).toBeLessThan(0.1)
})
