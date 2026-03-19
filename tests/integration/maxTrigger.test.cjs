const assert = require('node:assert/strict');

const { MaxTrigger } = require('../../dist/nodes/MaxTrigger/MaxTrigger.node.js');
const helpers = require('../../dist/nodes/MaxTrigger/triggerHelpers.js');

const run = async () => {
	assert.deepEqual(
		helpers.buildMaxSubscriptionBody('https://example.test/webhook', 'secret-123', ['message_created']),
		{
			url: 'https://example.test/webhook',
			secret: 'secret-123',
			update_types: ['message_created'],
		},
		'subscription bodies should include URL, secret, and update types',
	);
	assert.deepEqual(
		helpers.extractMaxSubscriptions({
			subscriptions: [{ url: 'https://example.test/webhook', update_types: ['message_created'] }],
		}),
		[{ url: 'https://example.test/webhook', update_types: ['message_created'] }],
		'subscription extraction should read the subscriptions array from MAX responses',
	);
	assert.deepEqual(
		helpers.findMaxSubscriptionByUrl(
			{ subscriptions: [{ url: 'https://example.test/webhook' }, { url: 'https://other.test' }] },
			'https://example.test/webhook',
		),
		{ url: 'https://example.test/webhook' },
		'subscription lookup should match by webhook URL',
	);
	assert.equal(
		helpers.hasValidMaxWebhookSecret('secret-123', { 'x-max-bot-api-secret': 'secret-123' }),
		true,
		'webhook secret validation should accept the configured secret',
	);
	assert.equal(
		helpers.hasValidMaxWebhookSecret('secret-123', { 'x-max-bot-api-secret': 'wrong-secret' }),
		false,
		'webhook secret validation should reject mismatched secrets',
	);
	assert.deepEqual(
		helpers.normalizeMaxTriggerEvent({ update_type: 'message_created', message: { body: { text: 'hello' } } }),
		{ update_type: 'message_created', updateType: 'message_created', message: { body: { text: 'hello' } } },
		'trigger event normalization should preserve the payload and add an updateType alias',
	);

	const trigger = new MaxTrigger();
	assert.equal(
		trigger.description.usableAsTool,
		false,
		'Max Trigger must not be exposed as an AI tool because n8n should activate and publish it through the regular trigger lifecycle',
	);

	await assert.rejects(
		() =>
			trigger.webhookMethods.default.create.call({
				getCredentials: async () => ({}),
				getNodeWebhookUrl: () => undefined,
				getNodeParameter: (_name, fallbackValue) => fallbackValue,
				getWorkflowStaticData: () => ({}),
				getMode: () => 'manual',
				getActivationMode: () => 'manual',
				helpers: {
					httpRequestWithAuthentication: async () => ({}),
				},
			}),
		(error) => {
			assert.equal(
				error.message,
				'n8n did not provide a webhook URL for the MAX trigger.',
				'trigger creation should surface the missing-webhook-url error instead of crashing on getNode()',
			);
			return true;
		},
	);

	await assert.rejects(
		() =>
			trigger.webhook.call({
				getNodeParameter: (_name, fallbackValue) => fallbackValue,
				getHeaderData: () => ({}),
				getBodyData: () => {
					throw new Error('webhook body failure');
				},
				getResponseObject: () => ({
					status: () => {},
				}),
				getMode: () => 'manual',
				helpers: {
					httpRequestWithAuthentication: async () => ({}),
				},
			}),
		(error) => {
			assert.equal(
				error.message,
				'webhook body failure',
				'webhook execution should wrap the original failure even when getNode() is unavailable',
			);
			return true;
		},
	);

	console.log('integration trigger checks passed');
};

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});


