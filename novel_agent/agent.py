import os
from typing import List
from jinja2 import Template

from .character import Character
from . import prompts

try:
    import openai
except ImportError:  # pragma: no cover
    openai = None  # type: ignore


class NovelAgent:
    """A minimal novel writing agent using OpenAI models."""

    def __init__(self, api_key: str | None = None, model: str = "gpt-3.5-turbo"):
        if openai is None:
            raise RuntimeError("openai package is required to use NovelAgent")
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key not provided")
        openai.api_key = self.api_key
        self.model = model
        self.characters: List[Character] = []
        self.context: List[str] = []
        self.outline: str | None = None

    # Character management
    def add_character(self, character: Character) -> None:
        self.characters.append(character)

    # Outline generation
    def generate_outline(self, description: str) -> str:
        tpl = Template(prompts.OUTLINE_TEMPLATE)
        prompt = tpl.render(description=description)
        response = self._chat(prompt)
        self.outline = response
        return response

    # Chapter generation
    def generate_chapter(self, instruction: str) -> str:
        tpl = Template(prompts.CHAPTER_TEMPLATE)
        prompt = tpl.render(outline=self.outline or "", characters=self.characters, context="\n".join(self.context), prompt=instruction)
        response = self._chat(prompt)
        self.context.append(response)
        return response

    # Low level chat call
    def _chat(self, prompt: str) -> str:
        res = openai.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
        )
        return res.choices[0].message.content.strip()
