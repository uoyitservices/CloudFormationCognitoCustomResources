const AWS = require('aws-sdk');
const RESPONSE_FUNCTION = process.env.RESPONSE_FUNCTION;

exports.handler = async (event) => {
    let physicalResourceId = event.PhysicalResourceId;
    try {
        let cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

        switch (event.RequestType) {
            case 'Create':
                console.info(`CognitoUserPoolIdentityProvider ${event.RequestType} - IN PROGRESS`);
                await cognitoIdentityServiceProvider.createIdentityProvider({
                    UserPoolId: event.ResourceProperties.UserPoolId,
                    ProviderName: event.ResourceProperties.ProviderName,
                    ProviderType: event.ResourceProperties.ProviderType,
                    ProviderDetails: event.ResourceProperties.ProviderDetails,
                    AttributeMapping: event.ResourceProperties.AttributeMapping,
                }).promise();

                physicalResourceId = [event.StackId, event.LogicalResourceId, event.RequestId].join('/');

                break;

            case 'Update':
                console.info(`CognitoUserPoolIdentityProvider ${event.RequestType} - IN PROGRESS`);
                await cognitoIdentityServiceProvider.updateIdentityProvider({
                    UserPoolId: event.ResourceProperties.UserPoolId,
                    ProviderName: event.ResourceProperties.ProviderName,
                    ProviderDetails: event.ResourceProperties.ProviderDetails,
                    AttributeMapping: event.ResourceProperties.AttributeMapping
                }).promise();

                break;

            case 'Delete':
                console.info(`CognitoUserPoolIdentityProvider ${event.RequestType} - IN PROGRESS`);
                await deleteIdentityProvider(cognitoIdentityServiceProvider,
                                             event.ResourceProperties.UserPoolId,
                                             event.ResourceProperties.ProviderName);

                break;
        }

        await sendCloudFormationResponse(event, 'SUCCESS', physicalResourceId);
        console.info(`CognitoUserPoolIdentityProvider ${event.RequestType} - SUCCESS`);

    } catch (error) {
        console.error(`CognitoUserPoolIdentityProvider ${event.RequestType} - FAILED:`, error);
        await sendCloudFormationResponse(event, 'FAILED', physicalResourceId);
    }
}

async function deleteIdentityProvider(cognitoIdentityServiceProvider, userPoolId, providerName) {
    var response = await cognitoIdentityServiceProvider.describeIdentityProvider({
        UserPoolId: userPoolId,
        ProviderName: providerName
    }).promise();

    if (response.IdentityProvider.UserPoolId) {
        await cognitoIdentityServiceProvider.deleteIdentityProvider({
            UserPoolId: response.IdentityProvider.UserPoolId,
            ProviderName: providerName
        }).promise();
    }
}

async function sendCloudFormationResponse(event, responseStatus, physicalResourceId, responseData) {
    var params = {
        FunctionName: RESPONSE_FUNCTION,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            PhysicalResourceId: physicalResourceId,
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