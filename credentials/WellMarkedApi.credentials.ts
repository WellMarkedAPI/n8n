import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class WellMarkedApi implements ICredentialType {
	name = 'wellMarkedApi';

	displayName = 'WellMarked API';

	documentationUrl = 'https://wellmarked.io/docs#authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your WellMarked API key (starts with <code>wm_</code>). Get one at https://wellmarked.io.',
		},
	];

	// Injects `Authorization: Bearer wm_...` on every request the node makes.
	// httpRequestWithAuthentication picks this up automatically.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// Validate credentials by calling GET /usage — it's cheap, requires auth,
	// and does not count against the user's monthly quota.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.wellmarked.io',
			url: '/usage',
			method: 'GET',
		},
	};
}
