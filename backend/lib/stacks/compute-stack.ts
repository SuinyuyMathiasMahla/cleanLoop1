import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';
import { Construct } from 'constructs';
import { functionDefaults } from '../lambda-defaults';

export interface ComputeStackProps extends cdk.StackProps {
  stage: string;
  reportsTable: dynamodb.Table;
  usersTable: dynamodb.Table;
  tasksTable: dynamodb.Table;
  notificationsTable: dynamodb.Table;
  mediaBucket: s3.Bucket;
  userPool: cognito.UserPool;
  sesFromEmail: string;
}

export class ComputeStack extends cdk.Stack {
  public readonly reportsHandler: lambda.Function;
  public readonly tasksHandler: lambda.Function;
  public readonly crewHandler: lambda.Function;
  public readonly notificationsHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const {
      stage,
      reportsTable,
      usersTable,
      tasksTable,
      notificationsTable,
      mediaBucket,
      userPool,
      sesFromEmail,
    } = props;

    // Read at runtime through getSecret (lambda/shared/secrets.ts). Created by hand once
    // per stage; when it is missing, geocoding is skipped.
    const geocodingKey = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GeocodingApiKey',
      `cleanloop/${stage}/google-geocoding-api-key`,
    );

    const commonEnv = {
      REPORTS_TABLE: reportsTable.tableName,
      USERS_TABLE: usersTable.tableName,
      CREW_TABLE: usersTable.tableName,
      TASKS_TABLE: tasksTable.tableName,
      NOTIFICATIONS_TABLE: notificationsTable.tableName,
      MEDIA_BUCKET: mediaBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      SES_FROM_EMAIL: sesFromEmail,
      STAGE: stage,
      GEOCODING_SECRET_NAME: geocodingKey.secretName,
      MAX_AUTO_ASSIGN_DISTANCE_KM: process.env.MAX_AUTO_ASSIGN_DISTANCE_KM ?? '25',
    };

    const lambdaDir = path.join(__dirname, '../../lambda');

    // -- Reports Handler -------------------------------------------------------
    this.reportsHandler = new lambdaNodejs.NodejsFunction(this, 'ReportsHandler', {
      functionName: `cleanloop-reports-${stage}`,
      ...functionDefaults,
      entry: path.join(lambdaDir, 'reports/handler.ts'),
      handler: 'handler',
      environment: commonEnv,
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
    });

    geocodingKey.grantRead(this.reportsHandler);
    reportsTable.grantReadWriteData(this.reportsHandler);
    usersTable.grantReadWriteData(this.reportsHandler);
    tasksTable.grantReadWriteData(this.reportsHandler);
    notificationsTable.grantWriteData(this.reportsHandler);
    mediaBucket.grantPut(this.reportsHandler);
    mediaBucket.grantRead(this.reportsHandler);
    mediaBucket.grantDelete(this.reportsHandler);
    this.reportsHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: ['*'],
      }),
    );

    // Every minute, so a report missed by the immediate assignment on creation still meets
    // the 60-second upload-to-assignment target (NFR-003). Scheduled rules cost nothing;
    // the 43,200 Lambda runs a month sit inside the free tier.
    new events.Rule(this, 'PendingReportAutoAssignmentRule', {
      ruleName: `cleanloop-pending-report-assignment-${stage}`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(this.reportsHandler)],
    });

    // -- Tasks Handler ---------------------------------------------------------
    this.tasksHandler = new lambdaNodejs.NodejsFunction(this, 'TasksHandler', {
      functionName: `cleanloop-tasks-${stage}`,
      ...functionDefaults,
      entry: path.join(lambdaDir, 'tasks/handler.ts'),
      handler: 'handler',
      environment: commonEnv,
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
    });

    tasksTable.grantReadWriteData(this.tasksHandler);
    reportsTable.grantReadWriteData(this.tasksHandler);
    usersTable.grantReadData(this.tasksHandler);
    notificationsTable.grantWriteData(this.tasksHandler);
    mediaBucket.grantPut(this.tasksHandler);
    mediaBucket.grantRead(this.tasksHandler);
    mediaBucket.grantDelete(this.tasksHandler);
    this.tasksHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }),
    );

    // -- Crew Handler ----------------------------------------------------------
    this.crewHandler = new lambdaNodejs.NodejsFunction(this, 'CrewHandler', {
      functionName: `cleanloop-crew-${stage}`,
      ...functionDefaults,
      entry: path.join(lambdaDir, 'crew/handler.ts'),
      handler: 'handler',
      environment: commonEnv,
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
    });

    geocodingKey.grantRead(this.crewHandler);
    usersTable.grantReadWriteData(this.crewHandler);
    this.crewHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:ListUsers',
          'cognito-idp:ListUsersInGroup',
          'cognito-idp:GetGroup',
          'cognito-idp:CreateGroup',
        ],
        resources: [userPool.userPoolArn],
      }),
    );

    // -- Notifications Handler -------------------------------------------------
    this.notificationsHandler = new lambdaNodejs.NodejsFunction(this, 'NotificationsHandler', {
      functionName: `cleanloop-notifications-${stage}`,
      ...functionDefaults,
      entry: path.join(lambdaDir, 'notifications/handler.ts'),
      handler: 'handler',
      environment: commonEnv,
      timeout: cdk.Duration.seconds(29),
      memorySize: 256,
    });

    notificationsTable.grantReadWriteData(this.notificationsHandler);
    usersTable.grantReadData(this.notificationsHandler);

    // -- Email Reminder Handler (Scheduled) ------------------------------------
    const emailReminderHandler = new lambdaNodejs.NodejsFunction(this, 'EmailReminderHandler', {
      functionName: `cleanloop-email-reminder-${stage}`,
      ...functionDefaults,
      entry: path.join(lambdaDir, 'email-reminder/handler.ts'),
      handler: 'handler',
      environment: commonEnv,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
    });

    tasksTable.grantReadWriteData(emailReminderHandler);
    usersTable.grantReadData(emailReminderHandler);
    notificationsTable.grantWriteData(emailReminderHandler);
    emailReminderHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }),
    );

    new events.Rule(this, 'EmailReminderRule', {
      ruleName: `cleanloop-email-reminder-${stage}`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(30)),
      targets: [new targets.LambdaFunction(emailReminderHandler)],
    });
  }
}
