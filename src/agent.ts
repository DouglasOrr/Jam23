import * as Physics from "./physics"
import * as T from "./lib/tensors"
import { NdArray, assertEquals } from "./lib/ndarray"

export const S = {
  // Features
  maxAngularVelocity: 3,
  maxVelocity: 30,
  window: 0.5, // s
  bufferSize: 1000,
  // Model
  nFrequencies: 8,
  hiddenSize: 64,
  depth: 3,
  // Training
  batchSize: 16,
  lr: 1e-2,
  adamBeta: [0.9, 0.999] as [number, number],
}

const FEATURE_SIZE = 6
const OUTPUT_SIZE = 3

function clip(x: number, low: number, high: number): number {
  return Math.min(Math.max(x, low), high)
}

// Data

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

// Before we can construct a training example, we need to observe
// control & outcome over a window. State is managed by this class.
class PreBuffer {
  position: Physics.Vec2 = [0, 0]
  velocity: Physics.Vec2 = [0, 0]
  angle: number = 0
  angularVelocity: number = 0
  sumControl: [number, number, number] = [0, 0, 0] // left, right, retro
  count = 0

  set(
    position: Physics.Vec2,
    velocity: Physics.Vec2,
    angle: number,
    angularVelocity: number,
  ): void {
    this.position[0] = position[0]
    this.position[1] = position[1]
    this.velocity[0] = velocity[0]
    this.velocity[1] = velocity[1]
    this.angle = angle
    this.angularVelocity = angularVelocity
    this.sumControl[0] = this.sumControl[1] = this.sumControl[2] = 0
    this.count = 0
  }

  add(control: Physics.ShipControl): void {
    this.sumControl[0] += +control.left
    this.sumControl[1] += +control.right
    this.sumControl[2] += +control.retro
    this.count += 1
  }
}

// Stash & sample features and control signals
class TrainingBuffer {
  index: number
  windowSize: number
  preBuffer = new PreBuffer()
  features: NdArray = new NdArray([S.bufferSize, FEATURE_SIZE])
  control: NdArray = new NdArray([S.bufferSize, OUTPUT_SIZE])
  count: number = 0

  constructor(index: number) {
    this.index = index
    this.windowSize = Math.ceil(S.window / Physics.S.dt)
  }

  #add(feature: number[], control: number[]): void {
    let index: number
    if (this.count < S.bufferSize) {
      index = this.count++
    } else {
      index = Math.floor(Math.random() * S.bufferSize)
    }
    this.features.data.splice(FEATURE_SIZE * index, FEATURE_SIZE, ...feature)
    this.control.data.splice(OUTPUT_SIZE * index, OUTPUT_SIZE, ...control)
  }

  sampleBatch(): [NdArray, NdArray] {
    const features = []
    const control = []
    for (let i = 0; i < S.batchSize; ++i) {
      const index = Math.floor(Math.random() * this.count)
      features.push(
        ...this.features.data.slice(
          index * FEATURE_SIZE,
          (index + 1) * FEATURE_SIZE,
        ),
      )
      control.push(
        ...this.control.data.slice(
          index * OUTPUT_SIZE,
          (index + 1) * OUTPUT_SIZE,
        ),
      )
    }
    return [
      new NdArray([S.batchSize, FEATURE_SIZE], features),
      new NdArray([S.batchSize, OUTPUT_SIZE], control),
    ]
  }

  update(sim: Physics.Sim): void {
    // If the ship is dead, force a reset to the preBuffer
    this.preBuffer.count *= +sim.ships.alive[this.index]
    const preBufferFull = this.preBuffer.count === this.windowSize
    if (preBufferFull) {
      const position = sim.ships.position[this.index]
      const dt = Physics.S.dt * this.windowSize
      const targetVelocity = [
        (position[0] - this.preBuffer.position[0]) / dt,
        (position[1] - this.preBuffer.position[1]) / dt,
      ] as Physics.Vec2
      const control = this.preBuffer.sumControl.map((x) => x / this.windowSize)
      this.#add(
        getNormalisedFeature(
          this.preBuffer.position,
          this.preBuffer.velocity,
          this.preBuffer.angle,
          this.preBuffer.angularVelocity,
          targetVelocity,
        ),
        control,
      )
    }
    if (preBufferFull || this.preBuffer.count === 0) {
      this.preBuffer.set(
        sim.ships.position[this.index],
        sim.ships.velocity[this.index],
        sim.ships.angle[this.index],
        sim.ships.angularVelocity[this.index],
      )
    }
    this.preBuffer.add(sim.ships.control[this.index])
  }
}

// Model

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
          (inputSize * outputSize) ** -0.25,
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

  predict(feature: NdArray): T.Tensor {
    let x = new T.Tensor(encodeFeature(this.nFrequencies, feature))
    for (let i = 0; i < this.layers.length; ++i) {
      x = T.dot(x, this.layers[i])
      if (i === this.layers.length - 1) {
        x = T.sigmoidSTE(x)
      } else {
        x = T.relu(x)
      }
    }
    return x
  }

  loss(feature: NdArray, control: NdArray): NdArray {
    const prediction = this.predict(feature)
    const loss = T.l1Loss(prediction, new T.Tensor(control))
    loss.grad.fill_(1)
    return loss.data.mean()
  }
}

// Agent

export class LearningAgent {
  indices: number[]
  teacherIndex: number
  model: Model
  trainingBuffer: TrainingBuffer
  targetVelocity: Physics.Vec2 = [0, 0]
  losses: number[] = []

  constructor(indices: number[], teacherIndex: number) {
    this.indices = indices
    this.teacherIndex = teacherIndex
    this.model = new Model(S.nFrequencies, S.hiddenSize, S.depth)
    this.trainingBuffer = new TrainingBuffer(this.teacherIndex)
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
    // Training
    this.trainingBuffer.update(sim)
    if (this.trainingBuffer.count > 10) {
      const [features, control] = this.trainingBuffer.sampleBatch()
      this.losses.push(
        this.model.step(() => this.model.loss(features, control)).data[0],
      )
    }

    // Inference
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
    const control = this.model.predict(features).data.data
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
