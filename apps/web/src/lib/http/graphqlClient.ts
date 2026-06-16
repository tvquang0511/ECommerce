export class GraphqlRequestError extends Error {
  public readonly status: number;
  public readonly errors: Array<{ message: string; code?: string }>;

  constructor(status: number, message: string, errors: Array<{ message: string; code?: string }> = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

type GraphqlErrorPayload = {
  message?: unknown;
  extensions?: {
    code?: unknown;
  };
};

type GraphqlResponse<TData> = {
  data?: TData;
  errors?: GraphqlErrorPayload[];
};

export async function graphqlRequest<TData, TVariables extends Record<string, unknown> | undefined>(
  url: string,
  input: {
    query: string;
    variables?: TVariables;
    accessToken?: string | null;
  },
): Promise<TData> {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (input.accessToken) {
    headers.set('Authorization', `Bearer ${input.accessToken}`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: input.query,
      variables: input.variables,
    }),
  });

  let payload: GraphqlResponse<TData>;
  try {
    payload = (await response.json()) as GraphqlResponse<TData>;
  } catch {
    throw new GraphqlRequestError(response.status, 'GraphQL response is not valid JSON');
  }

  if (!response.ok || payload?.errors?.length) {
    const errors = Array.isArray(payload?.errors)
      ? payload.errors.map((error: GraphqlErrorPayload) => ({
          message: String(error?.message ?? 'GraphQL request failed'),
          code: typeof error?.extensions?.code === 'string' ? error.extensions.code : undefined,
        }))
      : [];

    throw new GraphqlRequestError(response.status, errors[0]?.message ?? 'GraphQL request failed', errors);
  }

  return payload.data as TData;
}
