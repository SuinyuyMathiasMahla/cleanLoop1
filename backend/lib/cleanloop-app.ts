import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import { Construct } from 'constructs';
import { AuthStack } from './stacks/auth-stack';
import { StorageStack } from './stacks/storage-stack';
import { ComputeStack } from './stacks/compute-stack';
import { ApiStack } from './stacks/api-stack';
import { NotificationsStack } from './stacks/notifications-stack';
import { BudgetStack } from './stacks/budget-stack';
import { applyLogRetention, logRetentionFor } from './log-retention';

dotenv.config();

export interface CleanLoopAppProps extends cdk.StackProps {
  stage: string;
}

export class CleanLoopApp extends Construct {
  constructor(scope: Construct, id: string, props: CleanLoopAppProps) {
    super(scope, id);

    const { stage } = props;

    const storageStack = new StorageStack(scope, `CleanLoop-Storage-${stage}`, {
      ...props,
    });

    const authStack = new AuthStack(scope, `CleanLoop-Auth-${stage}`, {
      usersTable: storageStack.usersTable,
      ...props,
    });

    new NotificationsStack(scope, `CleanLoop-Notifications-${stage}`, {
      ...props,
    });

    const computeStack = new ComputeStack(scope, `CleanLoop-Compute-${stage}`, {
      reportsTable: storageStack.reportsTable,
      usersTable: storageStack.usersTable,
      tasksTable: storageStack.tasksTable,
      notificationsTable: storageStack.notificationsTable,
      mediaBucket: storageStack.mediaBucket,
      userPool: authStack.userPool,
      sesFromEmail: process.env.SES_FROM_EMAIL ?? `noreply@cleanloop-${stage}.example.com`,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
      ...props,
    });

    const apiStack = new ApiStack(scope, `CleanLoop-Api-${stage}`, {
      userPool: authStack.userPool,
      userPoolClient: authStack.userPoolClient,
      reportsHandler: computeStack.reportsHandler,
      tasksHandler: computeStack.tasksHandler,
      crewHandler: computeStack.crewHandler,
      notificationsHandler: computeStack.notificationsHandler,
      ...props,
    });

    const retention = logRetentionFor(stage);
    for (const stack of [authStack, computeStack, apiStack]) applyLogRetention(stack, retention);

    // Optional: set BUDGET_ALERT_EMAIL to create the monthly cost alarm.
    const budgetAlertEmail = process.env.BUDGET_ALERT_EMAIL;
    if (budgetAlertEmail) {
      new BudgetStack(scope, `CleanLoop-Budget-${stage}`, {
        monthlyLimitUsd: Number(process.env.MONTHLY_BUDGET_USD ?? 7),
        alertEmail: budgetAlertEmail,
        ...props,
      });
    }
  }
}
