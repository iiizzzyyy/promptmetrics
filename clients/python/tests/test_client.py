import pytest
import httpx
from promptmetrics import PromptMetrics


@pytest.fixture
def client():
    return PromptMetrics(base_url="http://localhost:3000", api_key="pm_test_key")


def test_prompts_list(client, respx_mock):
    respx_mock.get("http://localhost:3000/v1/prompts?page=1&limit=50").mock(
        return_value=httpx.Response(200, json={"items": [{"name": "hello"}], "total": 1, "page": 1, "limit": 50, "totalPages": 1})
    )
    result = client.prompts.list()
    assert result["items"][0]["name"] == "hello"


def test_prompts_get(client, respx_mock):
    respx_mock.get("http://localhost:3000/v1/prompts/hello").mock(
        return_value=httpx.Response(200, json={"content": {"name": "hello", "messages": []}, "version": {"name": "hello", "version_tag": "1.0.0", "created_at": 0}})
    )
    result = client.prompts.get("hello")
    assert result["content"]["name"] == "hello"


def test_prompts_create(client, respx_mock):
    payload = {"name": "hello", "version": "1.0.0", "messages": [{"role": "system", "content": "hi"}]}
    respx_mock.post("http://localhost:3000/v1/prompts").mock(
        return_value=httpx.Response(201, json={"name": "hello", "version_tag": "1.0.0", "created_at": 0})
    )
    result = client.prompts.create(payload)
    assert result["name"] == "hello"


def test_logs_create(client, respx_mock):
    payload = {"prompt_name": "hello", "version_tag": "1.0.0"}
    respx_mock.post("http://localhost:3000/v1/logs").mock(
        return_value=httpx.Response(202, json={"id": 1, "status": "accepted"})
    )
    result = client.logs.create(payload)
    assert result["status"] == "accepted"


def test_traces_create(client, respx_mock):
    payload = {"prompt_name": "hello", "version_tag": "1.0.0"}
    respx_mock.post("http://localhost:3000/v1/traces").mock(
        return_value=httpx.Response(201, json={"trace_id": "abc", "status": "created"})
    )
    result = client.traces.create(payload)
    assert result["trace_id"] == "abc"


def test_runs_create(client, respx_mock):
    payload = {"workflow_name": "test"}
    respx_mock.post("http://localhost:3000/v1/runs").mock(
        return_value=httpx.Response(201, json={"run_id": "run-1", "status": "created"})
    )
    result = client.runs.create(payload)
    assert result["run_id"] == "run-1"


def test_health(client, respx_mock):
    respx_mock.get("http://localhost:3000/health").mock(
        return_value=httpx.Response(200, json={"status": "ok"})
    )
    result = client.health()
    assert result["status"] == "ok"
