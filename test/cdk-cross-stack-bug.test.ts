import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import { cfnTagToCloudFormation } from '@aws-cdk/core';

class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'VPC');
  }
}

class ConsumingStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps & { vpc: ec2.IVpc }) {
    super(scope, id, props);

    const [subnet1, subnet2] = props.vpc.publicSubnets;
    const foo = 'foo';

    const cond1 = new cdk.CfnCondition(this, 'Condition1', {
      expression: cdk.Fn.conditionEquals(subnet1.availabilityZone, foo),
    });
    const cond2 = new cdk.CfnCondition(this, 'Condition2', {
      expression: cdk.Fn.conditionEquals(subnet2.availabilityZone, foo),
    });

    const value = cdk.Fn.conditionIf(
      cond1.logicalId,
      subnet1.subnetId,
      cdk.Fn.conditionIf(
        cond2.logicalId,
        subnet2.subnetId,
        cdk.Aws.NO_VALUE
      )
    ).toString();

    const resource = new cdk.CfnResource(this, 'Resource', {
      type: 'Custom::DummyType',
      properties: { Overridden: 'Nope' },
    });
    resource.addPropertyOverride('Overridden', value);
  }
}

test('Transparent cross-stack references works', () => {
  // GIVEN
  const app = new cdk.App({ context: { '@aws-cdk/core:newStyleStackSynthesis': 'true'} });
  const vpcStack = new VpcStack(app, 'VPC');

  // WHEN
  const consumingStack = new ConsumingStack(app, 'Consuming', { vpc: vpcStack.vpc });

  // THEN
  expectCDK(app.synth().getStackByName(consumingStack.stackName)).to(matchTemplate({
    "Conditions": {
      "Condition1": {
        "Fn::Equals": [
          {
            "Fn::Select": [
              0,
              {
                "Fn::GetAZs": ""
              }
            ]
          },
          "foo"
        ]
      },
      "Condition2": {
        "Fn::Equals": [
          {
            "Fn::Select": [
              1,
              {
                "Fn::GetAZs": ""
              }
            ]
          },
          "foo"
        ]
      }
    },
    "Resources": {
      "Resource": {
        "Type": "Custom::DummyType",
        "Properties": {
          "Overridden": {
            "Fn::If": [
              "Condition1",
              {
                "Fn::ImportValue": "VPC:ExportsOutputRefVPCPublicSubnet1SubnetB4246D30D84F935B"
              },
              {
                "Fn::If": [
                  "Condition2",
                  {
                    "Fn::ImportValue": "VPC:ExportsOutputRefVPCPublicSubnet2Subnet74179F3969CC10AD"
                  },
                  {
                    "Ref": "AWS::NoValue"
                  }
                ]
              }
            ]
          }
        }
      }
    }
  }, MatchStyle.EXACT));
});
