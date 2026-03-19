const assert = require('node:assert/strict');

const { Max } = require('../../dist/nodes/Max/Max.node.js');


const { executeMessageResource } = require('../../dist/nodes/Max/actions/message.js');
const { executeUploadResource } = require('../../dist/nodes/Max/actions/upload.js');
const { executeRawApiResource } = require('../../dist/nodes/Max/actions/rawApi.js');

const createContext = (parameters, helpers) => ({
	getInputData: () => [{ json: {} }],
	getNodeParameter: (name, _itemIndex, defaultValue) =>
		Object.prototype.hasOwnProperty.call(parameters, name) ? parameters[name] : defaultValue,
	continueOnFail: () => false,
	getNode: () => ({ name: 'Max' }),
	helpers,
});

const run = async () => {
	const maxNode = new Max();
	assert.deepEqual(
		maxNode.description.usableAsTool,
		{
			replacements: {
				displayName: 'Max Tool',
				description: 'Use the MAX Bot API from an AI Agent tool connection',
                subtitle: '={{ "AI tool" }}',
			},
		},
		'Max should expose a clearly labeled AI tool variant so users can distinguish it from the regular action node',
	);

	const messageRequests = [];
	const messageContext = createContext(
		{
			operation: 'send',
			recipientType: 'chat',
			chatId: 'chat-1',
			text: 'hello from max',
			format: 'markdown',
			additionalFields: {},
		},
		{
			httpRequestWithAuthentication: async (credentialType, requestOptions) => {
				messageRequests.push({ credentialType, requestOptions });
				return {
					message: {
						recipient: { chat_id: 'chat-1', chat_type: 'chat' },
						body: { mid: 'mid-1', seq: 10, text: 'hello from max' },
						sender: { user_id: 'bot-1' },
					},
				};
			},
		},
	);

	const messageResults = await executeMessageResource(messageContext, {});
	assert.deepEqual(
		messageResults,
		[
			{
				json: {
					message: {
						recipient: { chat_id: 'chat-1', chat_type: 'chat' },
						body: { mid: 'mid-1', seq: 10, text: 'hello from max' },
						sender: { user_id: 'bot-1' },
					},
					messageId: 'mid-1',
					sequence: 10,
					text: 'hello from max',
					chatId: 'chat-1',
					chatType: 'chat',
					senderId: 'bot-1',
				},
				pairedItem: { item: 0 },
			},
		],
		'message execution should expose top-level aliases for the returned MAX message data',
	);
	assert.equal(messageRequests[0].credentialType, 'maxApi', 'message execution should use MAX credentials');
	assert.equal(messageRequests[0].requestOptions.url, '/messages', 'message execution should call the MAX messages endpoint');
	assert.deepEqual(messageRequests[0].requestOptions.qs, { chat_id: 'chat-1' }, 'message execution should target the selected chat');
	assert.deepEqual(messageRequests[0].requestOptions.body, { text: 'hello from max', format: 'markdown' }, 'message execution should send the normalized MAX message body');

	const rawRequests = [];
	const rawContext = createContext(
		{
			httpMethod: 'POST',
			path: 'messages',
			query: '{"chat_id":"chat-1"}',
			body: '{"text":"hello"}',
			returnFullResponse: true,
		},
		{
			httpRequestWithAuthentication: async (credentialType, requestOptions) => {
				rawRequests.push({ credentialType, requestOptions });
				return { statusCode: 200, body: { success: true } };
			},
		},
	);

	const rawResults = await executeRawApiResource(rawContext, {});
	assert.deepEqual(
		rawResults,
		[
			{
				json: { statusCode: 200, body: { success: true } },
				pairedItem: { item: 0 },
			},
		],
		'raw API execution should return the MAX response payload for the current item',
	);
	assert.equal(rawRequests[0].credentialType, 'maxApi', 'raw API execution should use MAX credentials');
	assert.equal(rawRequests[0].requestOptions.url, '/messages', 'raw API execution should normalize the request path');
	assert.deepEqual(rawRequests[0].requestOptions.qs, { chat_id: 'chat-1' }, 'raw API execution should send parsed query parameters');
	assert.deepEqual(rawRequests[0].requestOptions.body, { text: 'hello' }, 'raw API execution should send parsed JSON bodies');
	assert.equal(rawRequests[0].requestOptions.returnFullResponse, true, 'raw API execution should forward the full-response flag');

	const uploadAuthRequests = [];
	const uploadBinaryRequests = [];
	const uploadContext = createContext(
		{
			operation: 'uploadAndReturnAttachment',
			attachmentType: 'video',
			binaryProperty: 'data',
		},
		{
			assertBinaryData: () => ({ fileName: 'clip.mp4', mimeType: 'video/mp4' }),
			getBinaryDataBuffer: async () => Buffer.from('video-binary'),
			httpRequestWithAuthentication: async (credentialType, requestOptions) => {
				uploadAuthRequests.push({ credentialType, requestOptions });
				return { url: 'https://upload.max.example/upload', token: 'video-link-token' };
			},
			httpRequest: async (requestOptions) => {
				uploadBinaryRequests.push(requestOptions);
				return { retval: 'ok' };
			},
		},
	);

	const uploadResults = await executeUploadResource(uploadContext, { accessToken: 'token-1' });
	assert.deepEqual(
		uploadResults,
		[
			{
				json: {
					attachment: { type: 'video', payload: { token: 'video-link-token' } },
					uploadLink: { url: 'https://upload.max.example/upload', token: 'video-link-token' },
					uploadResult: { retval: 'ok' },
				},
				pairedItem: { item: 0 },
			},
		],
		'upload execution should return attachment data composed from the upload link and upload result',
	);
	assert.equal(uploadAuthRequests[0].credentialType, 'maxApi', 'upload execution should use MAX credentials for the upload-link request');
	assert.deepEqual(uploadAuthRequests[0].requestOptions.qs, { type: 'video' }, 'upload execution should request the correct upload type');
	assert.equal(uploadBinaryRequests[0].url, 'https://upload.max.example/upload', 'upload execution should send the binary payload to the MAX upload URL');
	assert.equal(uploadBinaryRequests[0].headers.Authorization, 'token-1', 'upload execution should authorize binary uploads with the MAX token');
	await assert.rejects(
		() =>
			executeMessageResource(
				{
					getInputData: () => [{ json: {} }],
					getNodeParameter: (name, _itemIndex, defaultValue) => {
						const parameters = {
							operation: 'send',
							recipientType: 'chat',
							chatId: 'chat-1',
							text: 'hello from max',
							format: 'markdown',
							additionalFields: {},
						};
						return Object.prototype.hasOwnProperty.call(parameters, name)
							? parameters[name]
							: defaultValue;
					},
					continueOnFail: () => false,
					helpers: {
						httpRequestWithAuthentication: async function () {
							throw new Error('helper failure');
						},
					},
				},
				{},
			),
		(error) => {
			assert.equal(
				error.message,
				'helper failure',
				'action execution should preserve the original error even when getNode() is unavailable in the execute context',
			);
			return true;
		},
	);
	console.log('action execution checks passed');
};

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});


