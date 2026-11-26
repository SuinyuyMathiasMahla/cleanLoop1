import * as lambda from 'aws-cdk-lib/aws-lambda';

/**
 * Settings every CleanLoop function shares (ADR 0001, section 3). arm64 (Graviton)
 * costs about 20% less per GB-second than x86 for the same code, and the AWS SDK is
 * bundled at the version our lockfile pins instead of taken from the runtime.
 */
export const functionDefaults = {
  runtime: lambda.Runtime.NODEJS_22_X,
  architecture: lambda.Architecture.ARM_64,
  bundling: {
    minify: true,
    sourceMap: false,
    externalModules: [] as string[],
  },
};
