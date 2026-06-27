export class WorkerConfigurationError extends Error {
  public override readonly name = "WorkerConfigurationError";
}

export class JobValidationError extends Error {
  public override readonly name = "JobValidationError";

  public constructor(message: string) {
    super(message);
  }
}

export class ProcessorNotImplementedError extends Error {
  public override readonly name = "ProcessorNotImplementedError";

  public constructor(queueName: string, jobName: string) {
    super(`Processor skeleton for ${queueName}/${jobName} is not implemented; job was not executed.`);
  }
}
