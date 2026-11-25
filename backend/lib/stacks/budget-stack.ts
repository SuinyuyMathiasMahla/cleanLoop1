import * as cdk from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

export interface BudgetStackProps extends cdk.StackProps {
  stage: string;
  /** Monthly limit in US dollars. */
  monthlyLimitUsd: number;
  /** Who is emailed when spending nears or passes the limit. */
  alertEmail: string;
}

/**
 * A monthly AWS cost budget that emails when actual spend reaches 80% of the limit and
 * when the month's forecast passes it. AWS Budgets measures the whole account, so deploy
 * this from one stage only if several stages share an account.
 */
export class BudgetStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BudgetStackProps) {
    super(scope, id, props);

    const subscribers = [{ subscriptionType: 'EMAIL', address: props.alertEmail }];

    new budgets.CfnBudget(this, 'MonthlyCostBudget', {
      budget: {
        budgetName: `cleanloop-${props.stage}-monthly`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyLimitUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
        {
          notification: {
            notificationType: 'FORECASTED',
            comparisonOperator: 'GREATER_THAN',
            threshold: 100,
            thresholdType: 'PERCENTAGE',
          },
          subscribers,
        },
      ],
    });
  }
}
