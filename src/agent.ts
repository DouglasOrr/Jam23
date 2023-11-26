import * as Physics from "./physics"
import * as T from "./tensors"
import { NdArray, assertEquals } from "./ndarray"

export const S = {
  // Features
  maxAngularVelocity: 3,
  maxVelocity: 30,
  // Model
  nFrequencies: 4,
  hiddenSize: 32,
  depth: 3,
  // Training
  lr: 0.01,
  adamBeta: [0.9, 0.999] as [number, number],
}

const FEATURE_SIZE = 6
const OUTPUT_SIZE = 3

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

function encodeFeature(nFrequencies: number, feature: NdArray): NdArray {
  const result = new NdArray([
    feature.shape[0],
    nFrequencies * feature.shape[1],
  ])
  for (let i = 0; i < feature.data.length; ++i) {
    const value = feature.data[i]
    for (let j = 0; j < nFrequencies / 2; ++j) {
      const alpha = value * Math.PI * 0.5 * Math.pow(2, j)
      result.data[nFrequencies * i + 2 * j] = Math.sin(alpha)
      result.data[nFrequencies * i + 2 * j + 1] = Math.cos(alpha)
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
      const outputSize = i === depth - 1 ? OUTPUT_SIZE : hiddenSize
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

  predict(feature: NdArray): NdArray {
    let x = new T.Tensor(encodeFeature(this.nFrequencies, feature))
    for (let i = 0; i < this.layers.length; ++i) {
      x = T.dot(x, this.layers[i])
      if (i === this.layers.length - 1) {
        x = T.sigmoid(x)
      } else {
        x = T.relu(x)
      }
    }
    return x.data
  }
}

export class LearningAgent {
  indices: number[]
  teacherIndex: number
  model: Model
  targetVelocity: Physics.Vec2

  constructor(indices: number[], teacherIndex: number) {
    this.indices = indices
    this.teacherIndex = teacherIndex
    this.model = new Model(S.nFrequencies, S.hiddenSize, S.depth)
    this.targetVelocity = [0, 0]
  }

  init(spec: Record<string, unknown>): void {
    this.model = new Model(
      spec.n_frequencies as number,
      spec.hidden_size as number,
      spec.depth as number,
    )
    this.model.init(spec.weights as number[][])
  }

  update(sim: Physics.Sim): void {
    const features = new NdArray([this.indices.length, FEATURE_SIZE])
    this.indices.forEach((index, i) => {
      features.data.splice(
        i * FEATURE_SIZE,
        FEATURE_SIZE,
        ...getNormalisedFeature(
          sim.ships.position[index],
          sim.ships.velocity[index],
          sim.ships.angle[index],
          sim.ships.angularVelocity[index],
          this.targetVelocity,
        ),
      )
    })
    const control = this.model.predict(features).data
    this.indices.forEach((index, i) => {
      if (sim.ships.alive[index]) {
        const shipControl = sim.ships.control[index]
        shipControl.left = Math.random() < control[OUTPUT_SIZE * i + 0]
        shipControl.right = Math.random() < control[OUTPUT_SIZE * i + 1]
        shipControl.retro = Math.random() < control[OUTPUT_SIZE * i + 2]
        shipControl.dropBomb = false // TODO
      }
    })
  }
}
