import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeApiError,
	NodeOperationError,
	sleep,
} from 'n8n-workflow';

const CREDENTIALS_NAME = 'wellMarkedApi';

interface JobResponse {
	job_id: string;
	kind?: 'bulk' | 'crawl';
	status: 'queued' | 'processing' | 'done';
	total: number;
	completed: number;
	results: unknown[];
	truncated?: boolean;
	truncated_reason?: string | null;
	created_at?: string;
	finished_at?: string;
}

export class WellMarked implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WellMarked',
		name: 'wellMarked',
		icon: 'file:wellmarked.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Convert any URL to clean Markdown using the WellMarked API',
		defaults: {
			name: 'WellMarked',
		},
		// n8n 1.x expects string literals here; the NodeConnectionType enum
		// is type-only in newer @types and can't be used as a runtime value.
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: CREDENTIALS_NAME,
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		},
		properties: [
			// ── Resource selector ─────────────────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Extract', value: 'extract' },
					{ name: 'Bulk Job', value: 'bulk' },
					{ name: 'Crawl Job', value: 'crawl' },
					{ name: 'Account', value: 'account' },
				],
				default: 'extract',
			},

			// ── Extract operations ────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['extract'] } },
				options: [
					{
						name: 'Extract URL',
						value: 'extractUrl',
						description: 'Extract clean Markdown from a single URL',
						action: 'Extract clean Markdown from a URL',
					},
				],
				default: 'extractUrl',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/article',
				description: 'The URL to extract content from',
				displayOptions: { show: { resource: ['extract'], operation: ['extractUrl'] } },
			},
			{
				displayName: 'Render JavaScript',
				name: 'renderJs',
				type: 'boolean',
				default: false,
				description:
					'Whether to render the page with Playwright before extracting (paid plans only)',
				displayOptions: { show: { resource: ['extract'], operation: ['extractUrl'] } },
			},

			// ── Bulk Job operations ───────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['bulk'] } },
				options: [
					{
						name: 'Submit',
						value: 'submit',
						description: 'Submit a batch of URLs and return immediately with a job ID',
						action: 'Submit a bulk extraction job',
					},
					{
						name: 'Get Status',
						value: 'getStatus',
						description: 'Fetch the current status and any results for a job ID',
						action: 'Get bulk job status',
					},
					{
						name: 'Submit and Wait',
						value: 'submitAndWait',
						description:
							'Submit a batch, poll until done, then fan results out one item per URL',
						action: 'Submit a bulk job and wait for it to finish',
					},
				],
				default: 'submitAndWait',
			},
			{
				displayName: 'URLs',
				name: 'urls',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/a, https://example.com/b',
				description:
					'Comma-separated list of URLs (or an expression returning a string[] / comma-separated string). Pro caps at 50 URLs/job, Growth at 200; Enterprise is unlimited.',
				displayOptions: {
					show: { resource: ['bulk'], operation: ['submit', 'submitAndWait'] },
				},
			},
			{
				displayName: 'Render JavaScript',
				name: 'renderJs',
				type: 'boolean',
				default: false,
				description:
					'Whether to render every URL in the batch with Playwright (paid plans only)',
				displayOptions: {
					show: { resource: ['bulk'], operation: ['submit', 'submitAndWait'] },
				},
			},
			{
				displayName: 'Job ID',
				name: 'jobId',
				type: 'string',
				required: true,
				default: '',
				description: 'The job ID returned from a previous Submit call',
				displayOptions: { show: { resource: ['bulk'], operation: ['getStatus'] } },
			},

			// ── Crawl Job operations ──────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['crawl'] } },
				options: [
					{
						name: 'Submit',
						value: 'submit',
						description: 'Submit a crawl job and return immediately with a job ID',
						action: 'Submit a crawl job',
					},
					{
						name: 'Get Status',
						value: 'getStatus',
						description: 'Fetch the current status and any results for a job ID',
						action: 'Get crawl job status',
					},
					{
						name: 'Submit and Wait',
						value: 'submitAndWait',
						description:
							'Submit a crawl, poll until done, then fan results out one item per page',
						action: 'Submit a crawl job and wait for it to finish',
					},
				],
				default: 'submitAndWait',
			},
			{
				displayName: 'Root URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://docs.example.com',
				description: 'The URL the crawl starts from',
				displayOptions: {
					show: { resource: ['crawl'], operation: ['submit', 'submitAndWait'] },
				},
			},
			{
				displayName: 'Depth',
				name: 'depth',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 1,
				description:
					'Maximum BFS depth to follow from the root URL. Pro and Growth are capped at 5; Enterprise is unlimited.',
				displayOptions: {
					show: { resource: ['crawl'], operation: ['submit', 'submitAndWait'] },
				},
			},
			{
				displayName: 'Render JavaScript',
				name: 'renderJs',
				type: 'boolean',
				default: false,
				description:
					'Whether to fetch each page through Playwright instead of httpx so JS-rendered content shows up in the Markdown. Significantly slower per page; a single shared browser is launched for the whole crawl.',
				displayOptions: {
					show: { resource: ['crawl'], operation: ['submit', 'submitAndWait'] },
				},
			},
			{
				displayName: 'Job ID',
				name: 'jobId',
				type: 'string',
				required: true,
				default: '',
				description: 'The job ID returned from a previous Submit call',
				displayOptions: { show: { resource: ['crawl'], operation: ['getStatus'] } },
			},

			// ── Wait options (shared by bulk + crawl "Submit and Wait") ───────
			{
				displayName: 'Poll Interval (Seconds)',
				name: 'pollIntervalSec',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 2,
				description: 'How often to poll the job for completion',
				displayOptions: {
					show: { resource: ['bulk', 'crawl'], operation: ['submitAndWait'] },
				},
			},
			{
				displayName: 'Timeout (Seconds)',
				name: 'timeoutSec',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 300,
				description:
					'Maximum total time to wait. The node throws if the job is not done by then — use Submit + Get Status if your job runs longer than the n8n execution budget.',
				displayOptions: {
					show: { resource: ['bulk', 'crawl'], operation: ['submitAndWait'] },
				},
			},

			// ── Account operations ────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['account'] } },
				options: [
					{
						name: 'Get Usage',
						value: 'getUsage',
						description: 'Return the current billing-period usage (plan, used, limit, remaining)',
						action: 'Get current usage and quota',
					},
				],
				default: 'getUsage',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			try {
				if (resource === 'extract' && operation === 'extractUrl') {
					const url = this.getNodeParameter('url', i) as string;
					const renderJs = this.getNodeParameter('renderJs', i, false) as boolean;
					const body = await request.call(
						this,
						i,
						'POST',
						'/extract',
						{ url, render_js: renderJs },
					);
					out.push({ json: body as IDataObject, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'bulk') {
					if (operation === 'submit' || operation === 'submitAndWait') {
						const urls = parseUrlList(this.getNodeParameter('urls', i));
						if (urls.length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'No URLs supplied. Provide at least one URL.',
								{ itemIndex: i },
							);
						}
						const renderJs = this.getNodeParameter('renderJs', i, false) as boolean;
						const submitted = (await request.call(this, i, 'POST', '/bulk', {
							urls,
							render_js: renderJs,
						})) as JobResponse;

						if (operation === 'submit') {
							out.push({ json: submitted as unknown as IDataObject, pairedItem: { item: i } });
							continue;
						}

						const done = await waitForJob.call(this, i, submitted, 'bulk');
						pushJobResults(out, i, done);
						continue;
					}

					if (operation === 'getStatus') {
						const jobId = this.getNodeParameter('jobId', i) as string;
						const body = await getJobStatus.call(this, i, jobId);
						out.push({ json: body as unknown as IDataObject, pairedItem: { item: i } });
						continue;
					}
				}

				if (resource === 'crawl') {
					if (operation === 'submit' || operation === 'submitAndWait') {
						const url = this.getNodeParameter('url', i) as string;
						const depth = this.getNodeParameter('depth', i, 1) as number;
						const renderJs = this.getNodeParameter('renderJs', i, false) as boolean;
						const submitted = (await request.call(this, i, 'POST', '/crawl', {
							url,
							depth,
							render_js: renderJs,
						})) as JobResponse;

						if (operation === 'submit') {
							out.push({ json: submitted as unknown as IDataObject, pairedItem: { item: i } });
							continue;
						}

						const done = await waitForJob.call(this, i, submitted, 'crawl');
						pushJobResults(out, i, done);
						continue;
					}

					if (operation === 'getStatus') {
						const jobId = this.getNodeParameter('jobId', i) as string;
						const body = await getJobStatus.call(this, i, jobId);
						out.push({ json: body as unknown as IDataObject, pairedItem: { item: i } });
						continue;
					}
				}

				if (resource === 'account' && operation === 'getUsage') {
					const body = await request.call(this, i, 'GET', '/usage');
					out.push({ json: body as IDataObject, pairedItem: { item: i } });
					continue;
				}

				throw new NodeOperationError(
					this.getNode(),
					`Unknown resource/operation combo: ${resource}/${operation}`,
					{ itemIndex: i },
				);
			} catch (err) {
				if (this.continueOnFail()) {
					out.push({
						json: { error: (err as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw err;
			}
		}

		return [out];
	}
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function request(
	this: IExecuteFunctions,
	itemIndex: number,
	method: IHttpRequestMethods,
	path: string,
	body?: object,
): Promise<unknown> {
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIALS_NAME, {
			method,
			url: path,
			json: true,
			...(body !== undefined ? { body } : {}),
		});
	} catch (err) {
		// httpRequestWithAuthentication throws a plain Error for non-2xx —
		// wrap in NodeApiError so n8n surfaces it with the right styling
		// and the user sees the API's `error.code` / `error.message`.
		throw new NodeApiError(this.getNode(), err as never, { itemIndex });
	}
}

// Polymorphic job lookup: /bulk/{id} answers for any job, but returns the
// bulk shape; if `kind === "crawl"` we re-fetch /crawl/{id} for the proper
// shape (with per-item depth and truncated fields). Same dispatch as the
// Python + JS SDKs.
async function getJobStatus(
	this: IExecuteFunctions,
	itemIndex: number,
	jobId: string,
): Promise<JobResponse> {
	const body = (await request.call(this, itemIndex, 'GET', `/bulk/${encodeURIComponent(jobId)}`)) as JobResponse;
	if (body.kind === 'crawl') {
		return (await request.call(
			this,
			itemIndex,
			'GET',
			`/crawl/${encodeURIComponent(jobId)}`,
		)) as JobResponse;
	}
	return body;
}

async function waitForJob(
	this: IExecuteFunctions,
	itemIndex: number,
	submitted: JobResponse,
	kind: 'bulk' | 'crawl',
): Promise<JobResponse> {
	const pollSec = this.getNodeParameter('pollIntervalSec', itemIndex, 2) as number;
	const timeoutSec = this.getNodeParameter('timeoutSec', itemIndex, 300) as number;
	const deadline = Date.now() + timeoutSec * 1000;

	let job = submitted;
	while (job.status !== 'done') {
		if (Date.now() >= deadline) {
			throw new NodeOperationError(
				this.getNode(),
				`Job ${job.job_id} did not finish within ${timeoutSec}s (last status: ${job.status}, ${job.completed}/${job.total})`,
				{ itemIndex },
			);
		}
		await sleep(pollSec * 1000);
		// Once we know the kind, poll the typed endpoint directly — skips
		// the /bulk-then-/crawl re-dispatch on every iteration.
		job = (await request.call(
			this,
			itemIndex,
			'GET',
			`/${kind}/${encodeURIComponent(submitted.job_id)}`,
		)) as JobResponse;
	}
	return job;
}

// Fan a finished job out as one n8n item per result row. Downstream nodes
// (e.g. "Send to Vector DB") then process each extracted page individually.
function pushJobResults(
	out: INodeExecutionData[],
	itemIndex: number,
	job: JobResponse,
): void {
	if (!Array.isArray(job.results) || job.results.length === 0) {
		// No results — emit the job envelope so the downstream flow still
		// sees that the call completed.
		out.push({
			json: job as unknown as IDataObject,
			pairedItem: { item: itemIndex },
		});
		return;
	}
	for (const result of job.results) {
		const r = result as IDataObject;
		out.push({
			json: {
				job_id: job.job_id,
				kind: job.kind,
				...r,
			},
			pairedItem: { item: itemIndex },
		});
	}
}

// Accept either a string[] (from an expression) or a comma/newline-separated
// string (from the inline UI field). Trim and drop empties.
function parseUrlList(input: unknown): string[] {
	if (Array.isArray(input)) {
		return input
			.map((v) => String(v).trim())
			.filter((v) => v.length > 0);
	}
	if (typeof input === 'string') {
		return input
			.split(/[\n,]+/)
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
	}
	return [];
}
