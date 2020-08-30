interface Deployable {
  type: string
  name: string
  options: object
}

interface Deployment {
  deployables: Record<string, Deployable>
}

type SerializedDeploymentSpec = string

interface LiveDeployment {
  name: string
  type: string
  current: SerializedDeploymentSpec
}

type MaybePromise<T> = T | Promise<T>

interface DeployableType {
  // Future: order deployments by dependencies
  // getDependencies?: (name: string, options: object) => string[]
  deploy: (name: string, options: object) => MaybePromise<SerializedDeploymentSpec>
  // Future: update an existing deployment
  // update?: (name: string, options: object, current: SerializedDeploymentSpec) => MaybePromise<SerializedDeploymentSpec>
  undeploy?: (name: string, current: SerializedDeploymentSpec) => MaybePromise<void>
  getInterface?: (name: string, current: SerializedDeploymentSpec) => MaybePromise<any>
}

type DeployableTypeRecord = Record<string, DeployableType>

// Deployable collector

type MarkFn = (typeName: string, name: string, options: MarkOptions) => string

function collect(types: DeployableTypeRecord, (mark: MarkFn) => void): Deployment

// Deploy/update/undeploy

async function deploy(types: DeployableTypeRecord, new_: Deployment /*, current?: DeploymentSpec*/): Promise<DeploymentSpec>

async function undeploy(types: DeployableTypeRecord, current: DeploymentSpec)
