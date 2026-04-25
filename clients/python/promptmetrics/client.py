import os
from typing import Any, Optional
import httpx


class _PromptsResource:
    def __init__(self, client: "PromptMetrics"):
        self._client = client

    def list(
        self, page: int = 1, limit: int = 50, q: Optional[str] = None
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"page": page, "limit": limit}
        if q:
            params["q"] = q
        return self._client._request("GET", "/v1/prompts", params=params)

    def get(
        self,
        name: str,
        version: Optional[str] = None,
        render: Optional[str] = None,
        variables: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {}
        if version:
            params["version"] = version
        if render:
            params["render"] = render
        if variables:
            for k, v in variables.items():
                params[f"variables[{k}]"] = v
        return self._client._request(
            "GET", f"/v1/prompts/{name}", params=params
        )

    def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._client._request("POST", "/v1/prompts", json=payload)

    def versions(
        self, name: str, page: int = 1, limit: int = 50
    ) -> dict[str, Any]:
        return self._client._request(
            "GET",
            f"/v1/prompts/{name}/versions",
            params={"page": page, "limit": limit},
        )


class _LogsResource:
    def __init__(self, client: "PromptMetrics"):
        self._client = client

    def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._client._request("POST", "/v1/logs", json=payload)


class _TracesResource:
    def __init__(self, client: "PromptMetrics"):
        self._client = client

    def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._client._request("POST", "/v1/traces", json=payload)

    def get(self, trace_id: str) -> dict[str, Any]:
        return self._client._request("GET", f"/v1/traces/{trace_id}")

    def add_span(
        self, trace_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        return self._client._request(
            "POST", f"/v1/traces/{trace_id}/spans", json=payload
        )


class _RunsResource:
    def __init__(self, client: "PromptMetrics"):
        self._client = client

    def list(
        self, page: int = 1, limit: int = 50
    ) -> dict[str, Any]:
        return self._client._request(
            "GET", "/v1/runs", params={"page": page, "limit": limit}
        )

    def get(self, run_id: str) -> dict[str, Any]:
        return self._client._request("GET", f"/v1/runs/{run_id}")

    def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._client._request("POST", "/v1/runs", json=payload)

    def update(
        self, run_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        return self._client._request(
            "PATCH", f"/v1/runs/{run_id}", json=payload
        )


class _LabelsResource:
    def __init__(self, client: "PromptMetrics"):
        self._client = client

    def list(
        self, prompt_name: str, page: int = 1, limit: int = 50
    ) -> dict[str, Any]:
        return self._client._request(
            "GET",
            f"/v1/prompts/{prompt_name}/labels",
            params={"page": page, "limit": limit},
        )

    def create(
        self, prompt_name: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        return self._client._request(
            "POST",
            f"/v1/prompts/{prompt_name}/labels",
            json=payload,
        )


class PromptMetrics:
    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self._base_url = (base_url or os.getenv("PROMPTMETRICS_URL", "http://localhost:3000")).rstrip("/")
        self._api_key = api_key or os.getenv("PROMPTMETRICS_API_KEY", "")
        self._client = httpx.Client(base_url=self._base_url, timeout=30.0)

        self.prompts = _PromptsResource(self)
        self.logs = _LogsResource(self)
        self.traces = _TracesResource(self)
        self.runs = _RunsResource(self)
        self.labels = _LabelsResource(self)

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict[str, Any]] = None,
        json: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        headers: dict[str, str] = {}
        if self._api_key:
            headers["X-API-Key"] = self._api_key
        resp = self._client.request(
            method, path, params=params, json=json, headers=headers
        )
        resp.raise_for_status()
        if resp.status_code == 204:
            return {}
        return resp.json()

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health")

    def health_deep(self) -> dict[str, Any]:
        return self._request("GET", "/health/deep")

    def close(self) -> None:
        self._client.close()
