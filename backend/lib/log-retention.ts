import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/** How long Lambda logs are kept: two weeks outside production, a month in it. */
export function logRetentionFor(stage: string): logs.RetentionDays {
  return stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.TWO_WEEKS;
}

/**
 * Sets log retention on every Lambda function under `scope`. CloudWatch keeps logs
 * forever by default, so storage grows with every request.
 *
 * Uses LogRetention rather than a new LogGroup because the functions' log groups may
 * already exist from earlier deploys, and creating one with the same name would fail.
 */
export function applyLogRetention(scope: Construct, retention: logs.RetentionDays): void {
  for (const node of scope.node.findAll()) {
    if (!(node instanceof lambda.Function)) continue;
    new logs.LogRetention(node, 'LogRetention', {
      logGroupName: `/aws/lambda/${node.functionName}`,
      retention,
    });
  }
}
