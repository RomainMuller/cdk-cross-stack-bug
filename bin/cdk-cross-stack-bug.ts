#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkCrossStackBugStack } from '../lib/cdk-cross-stack-bug-stack';

const app = new cdk.App();
new CdkCrossStackBugStack(app, 'CdkCrossStackBugStack');
