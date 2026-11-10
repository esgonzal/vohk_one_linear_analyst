const CREATE_ACTIVITY = `
mutation AgentActivityCreate($input: AgentActivityCreateInput!) {
  agentActivityCreate(input: $input) {
    success
    agentActivity { id }
  }
}`;

export class LinearClient {
  constructor({ accessToken, tokenProvider, fetchImpl = fetch }) {
    this.accessToken = accessToken;
    this.tokenProvider = tokenProvider;
    this.fetchImpl = fetchImpl;
  }

  async createActivity(agentSessionId, content, { ephemeral = false, organizationId } = {}) {
    const accessToken = this.tokenProvider ? await this.tokenProvider(organizationId) : this.accessToken;
    const response = await this.fetchImpl("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: CREATE_ACTIVITY,
        variables: { input: { agentSessionId, content, ephemeral } },
      }),
    });

    const result = await response.json();
    if (!response.ok || result.errors || !result.data?.agentActivityCreate?.success) {
      throw new Error(`Linear activity failed: ${JSON.stringify(result.errors ?? result)}`);
    }
    return result.data.agentActivityCreate.agentActivity;
  }
}

