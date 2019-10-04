const AWS = require('aws-sdk');
const RESPONSE_FUNCTION = process.env.RESPONSE_FUNCTION;

exports.handler = async (event) => {
    try {
        var cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
        
        switch (event.RequestType) {
            case 'Create':
                await createUserPoolDomain(
                    cognitoIdentityServiceProvider,
                    event.ResourceProperties.UserPoolId,
                    event.ResourceProperties.Domain,
                    event.ResourceProperties.CustomDomainConfig
                );
                break;
                
            case 'Update':
                await deleteUserPoolDomain(cognitoIdentityServiceProvider, event.OldResourceProperties.Domain);
                await createUserPoolDomain(
                    cognitoIdentityServiceProvider,
                    event.ResourceProperties.UserPoolId,
                    event.ResourceProperties.Domain,
                    event.ResourceProperties.CustomDomainConfig
                );
                break;
                
            case 'Delete':
                await deleteUserPoolDomain(cognitoIdentityServiceProvider, event.ResourceProperties.Domain);
                break;
        }
        
        await sendCloudFormationResponse(event, 'SUCCESS');
        console.info(`CognitoUserPoolDomain Success for request type ${event.RequestType}`);
    } catch (error) {
        console.error(`CognitoUserPoolDomain Error for request type ${event.RequestType}:`, error);
        await sendCloudFormationResponse(event, 'FAILED');
    }
}

async function createUserPoolDomain(cognitoIdentityServiceProvider, userPoolId, domain, customDomainConfig) {
    let params = {
        UserPoolId: userPoolId,
        Domain: domain
    };
    if (customDomainConfig && customDomainConfig.CertificateArn) {
        params.CustomDomainConfig = customDomainConfig;
    }

    let data = await cognitoIdentityServiceProvider.createUserPoolDomain(params).promise();
    console.warn(`Domain ${domain} created. You must now create a CNAME pointing at ${data.CloudFrontDomain}. The UserPool Domain can not be used until this is done!`)
}

async function deleteUserPoolDomain(cognitoIdentityServiceProvider, domain) {
    var response = await cognitoIdentityServiceProvider.describeUserPoolDomain({
        Domain: domain
    }).promise();
    
    if (response.DomainDescription.Domain) {
        await cognitoIdentityServiceProvider.deleteUserPoolDomain({
            UserPoolId: response.DomainDescription.UserPoolId,
            Domain: domain
        }).promise();
    }
}

async function sendCloudFormationResponse(event, responseStatus, responseData) {
    var params = {
        FunctionName: RESPONSE_FUNCTION,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            ResponseURL: event.ResponseURL,
            ResponseStatus: responseStatus,
            ResponseData: responseData
        })
    };
    
    var lambda = new AWS.Lambda();
    var response = await lambda.invoke(params).promise();
    
    if (response.FunctionError) {
        var responseError = JSON.parse(response.Payload);
        throw new Error(responseError.errorMessage);
    }
}