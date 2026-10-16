import os
from abc import ABC, abstractmethod

import httpx

from app.core.config import settings


class LlmAdapter(ABC):
    enabled = False

    @abstractmethod
    async def complete(self, system: str, prompt: str) -> str | None: ...


class DisabledLlmAdapter(LlmAdapter):
    async def complete(self, system, prompt):
        return None


class OpenAICompatibleLlmAdapter(LlmAdapter):
    """Any OpenAI-compatible /chat/completions endpoint (self-hosted or provider), configured via env."""
    enabled = True

    def __init__(self):
        self.base_url = os.environ["LLM_BASE_URL"].rstrip("/")
        self.api_key = os.environ["LLM_API_KEY"]
        self.model = os.environ["LLM_MODEL"]

    async def complete(self, system, prompt):
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(f"{self.base_url}/chat/completions",
                             headers={"Authorization": f"Bearer {self.api_key}"},
                             json={"model": self.model, "temperature": 0.2,
                                   "messages": [{"role": "system", "content": system},
                                                {"role": "user", "content": prompt}]})
        if r.status_code >= 300:
            return None
        return r.json()["choices"][0]["message"]["content"]


def get_llm_adapter() -> LlmAdapter:
    """Callers must also check the `chatbot_llm` feature flag before use."""
    return OpenAICompatibleLlmAdapter() if settings.llm_provider == "openai_compatible" else DisabledLlmAdapter()
