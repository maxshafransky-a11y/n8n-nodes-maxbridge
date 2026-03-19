const assert = require('node:assert/strict');

const transport = require('../../dist/nodes/Max/transport/maxApiRequest.js');
const upload = require('../../dist/nodes/Max/uploads/maxUpload.js');
const errors = require('../../dist/nodes/Max/errors/maxApiError.js');

const run = async () => {
	assert.equal(transport.getMaxBaseUrl({}), transport.DEFAULT_MAX_BASE_URL, 'default base URL should match MAX production API');
	assert.equal(
		transport.getMaxBaseUrl({
			useCustomBaseUrl: true,
			baseUrl: 'https://example.max.local///',
		}),
		'https://example.max.local',
		'custom base URLs should be trimmed',
	);
	assert.equal(transport.normalizeMaxApiPath('messages'), '/messages', 'paths should gain a leading slash');
	assert.equal(
		transport.normalizeMaxApiPath('https://platform-api.max.ru/messages?limit=10'),
		'/messages?limit=10',
		'absolute URLs should be normalized back to API paths',
	);
	assert.deepEqual(
		transport.omitUndefinedProperties({ keep: 'yes', drop: undefined }),
		{ keep: 'yes' },
		'undefined query or header values should be removed',
	);

	const builtRequest = transport.buildMaxApiRequestOptions(
		{ useCustomBaseUrl: true, baseUrl: 'https://max.example.local/' },
		'GET',
		'messages',
		{ query: { limit: 50, marker: undefined } },
	);
	assert.equal(builtRequest.baseURL, 'https://max.example.local', 'request options should use the normalized base URL');
	assert.equal(builtRequest.url, '/messages', 'request options should normalize the path');
	assert.deepEqual(builtRequest.qs, { limit: 50 }, 'request options should keep only defined query values');

	const paginationCalls = [];
	const paginationHelperThisValues = [];
	const paginationContext = {
		helpers: {
			httpRequestWithAuthentication: async function (_credentialName, requestOptions) {
				paginationHelperThisValues.push(this);
				paginationCalls.push(requestOptions);
				if (paginationCalls.length === 1) {
					return {
						items: [{ id: 'page-1' }],
						marker: 'next-page',
					};
				}

				return {
					items: [{ id: 'page-2' }],
				};
			},
		},
	};
	const paginatedItems = await transport.maxPaginatedRequest(
		paginationContext,
		{},
		'GET',
		'/items',
		{ responseItemsKey: 'items', limit: 10 },
	);
	assert.deepEqual(
		paginatedItems,
		[{ id: 'page-1' }, { id: 'page-2' }],
		'paginated requests should collect items across marker-based pages',
	);
	assert.equal(paginationCalls.length, 2, 'paginated requests should continue while a marker exists');
	assert.equal(
		paginationHelperThisValues[0],
		paginationContext,
		'transport requests should bind the n8n execution context when calling httpRequestWithAuthentication',
	);
	assert.deepEqual(
		paginationCalls[1].qs,
		{ limit: 10, marker: 'next-page' },
		'follow-up paginated calls should send the next marker',
	);

	assert.deepEqual(
		upload.buildMaxUploadRequestQuery('video'),
		{ type: 'video' },
		'upload request queries should contain the upload type',
	);
	assert.deepEqual(
		upload.buildMaxUploadRetryDelays(4, 100),
		[100, 200, 400, 800],
		'upload retry delays should use exponential backoff',
	);
	const formData = upload.buildMaxUploadFormData({
		data: Buffer.from('hello world'),
		fileName: 'hello.txt',
		mimeType: 'text/plain',
	});
	assert.ok(formData.get('data'), 'multipart upload helper should add the binary payload under the data field');
	assert.deepEqual(
		upload.buildMaxMessageAttachment('video', { url: 'https://upload', token: 'video-token' }, {}),
		{ type: 'video', payload: { token: 'video-token' } },
		'video attachments should prefer the token from the upload link response when available',
	);
	assert.deepEqual(
		upload.buildMaxMessageAttachment('image', { url: 'https://upload' }, { token: 'image-token' }),
		{ type: 'image', payload: { token: 'image-token' } },
		'image attachments should use the upload result payload',
	);

	const attachmentError = {
		code: 'attachment.not.ready',
		message: 'Key: errors.process.attachment.file.not.processed',
		statusCode: 409,
	};
	assert.equal(errors.extractMaxErrorCode(attachmentError), 'attachment.not.ready', 'error parser should extract MAX error codes');
	assert.equal(errors.extractMaxErrorMessage(attachmentError), 'Key: errors.process.attachment.file.not.processed', 'error parser should extract MAX error messages');
	assert.equal(errors.extractMaxStatusCode(attachmentError), 409, 'error parser should extract HTTP status codes');
	assert.equal(errors.isMaxAttachmentNotReadyError(attachmentError), true, 'attachment.not.ready should be recognized as retriable upload processing state');
	assert.deepEqual(
		errors.toMaxApiErrorResponse(attachmentError),
		{
			code: 'attachment.not.ready',
			message: 'Key: errors.process.attachment.file.not.processed',
			statusCode: 409,
		},
		'error responses should be serialized into NodeApiError-compatible payloads',
	);

	console.log('unit transport checks passed');
};

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});