import * as Physics from "./physics"
import * as T from "./tensors"
import { NdArray, assertEquals } from "./ndarray"

export const S = {
  maxAngularVelocity: 3,
  maxVelocity: 30,
  lr: 0.01,
  adamBeta: [0.9, 0.999] as [number, number],
}

const FEATURE_SIZE = 6

function clip(x: number, low: number, high: number): number {
  return Math.min(Math.max(x, low), high)
}

// Compute the network input features, from the world state
export function getNormalisedFeature(
  position: Physics.Vec2,
  velocity: Physics.Vec2,
  angle: number,
  angularVelocity: number,
  targetVelocity: Physics.Vec2,
): number[] {
  const bearing = Math.atan2(-position[0], position[1])
  const sinB = Math.sin(bearing)
  const cosB = Math.cos(bearing)
  const polarAngle = Physics.angleBetween(bearing, angle)
  const velocityR = velocity[0] * -sinB + velocity[1] * cosB
  const velocityTheta = velocity[0] * -cosB + velocity[1] * -sinB
  const targetVelocityR = targetVelocity[0] * -sinB + targetVelocity[1] * cosB
  const targetVelocityTheta =
    targetVelocity[0] * -cosB + targetVelocity[1] * -sinB

  return [
    clip(polarAngle / Math.PI, -1, 1),
    clip(angularVelocity / S.maxAngularVelocity, -1, 1),
    clip(velocityR / S.maxVelocity, -1, 1),
    clip(velocityTheta / S.maxVelocity, -1, 1),
    clip(targetVelocityR / S.maxVelocity, -1, 1),
    clip(targetVelocityTheta / S.maxVelocity, -1, 1),
  ]
}

export function encodeFeature(
  nFrequencies: number,
  feature: number[],
): number[] {
  const result: number[] = []
  for (let i = 0; i < feature.length; ++i) {
    const value = feature[i]
    for (let j = 0; j < nFrequencies / 2; ++j) {
      const alpha = value * Math.PI * 0.5 * Math.pow(2, j)
      result.push(Math.sin(alpha), Math.cos(alpha))
    }
  }
  return result
}

export class Model extends T.Model {
  nFrequencies: number
  layers: T.Parameter[]

  constructor(nFrequencies: number, hiddenSize: number, depth: number) {
    super(
      (shape, scale) =>
        new T.AdamParameter(
          new NdArray(shape).rand_(-scale, scale),
          S.lr,
          S.adamBeta,
          1e-8,
        ),
    )
    this.nFrequencies = nFrequencies
    this.layers = []
    for (let i = 0; i < depth; ++i) {
      const inputSize = i === 0 ? FEATURE_SIZE * nFrequencies : hiddenSize
      const outputSize = i === depth - 1 ? 3 : hiddenSize
      this.layers.push(
        this.addParameter(
          [inputSize, outputSize],
          (inputSize * outputSize) ** 0.25,
        ),
      )
    }
  }

  init(weights: number[][]): void {
    assertEquals(weights.length, this.layers.length, "init weights (depth)")
    for (let i = 0; i < this.layers.length; ++i) {
      assertEquals(
        this.layers[i].data.data.length,
        weights[i].length,
        () => `init weight layer ${i}`,
      )
      this.layers[i].data.data = [...weights[i]]
    }
  }

  predict(feature: number[]): number[] {
    const encodedData = encodeFeature(this.nFrequencies, feature)
    let x = new T.Tensor(new NdArray([1, encodedData.length], encodedData))
    for (let i = 0; i < this.layers.length; ++i) {
      x = T.dot(x, this.layers[i])
      if (i === this.layers.length - 1) {
        x = T.sigmoid(x)
      } else {
        x = T.relu(x)
      }
    }
    return x.data.data
  }
}

export class LearningAgent {
  index: number
  model: Model
  targetVelocity: Physics.Vec2

  constructor(index: number, spec: Record<string, unknown>) {
    this.index = index
    this.model = new Model(
      spec.n_frequencies as number,
      spec.hidden_size as number,
      spec.depth as number,
    )
    this.model.init(spec.weights as number[][])
    this.targetVelocity = [0, 0]
  }

  update(sim: Physics.Sim): void {
    if (sim.ships.alive[this.index]) {
      const signal = this.model.predict(
        getNormalisedFeature(
          sim.ships.position[this.index],
          sim.ships.velocity[this.index],
          sim.ships.angle[this.index],
          sim.ships.angularVelocity[this.index],
          this.targetVelocity,
        ),
      )
      const control = sim.ships.control[this.index]
      control.left = Math.random() < signal[0]
      control.right = Math.random() < signal[1]
      control.retro = Math.random() < signal[2]
      control.dropBomb = false // TODO
    }
  }
}
