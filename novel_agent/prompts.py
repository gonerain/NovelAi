"""Prompt templates used by the NovelAgent."""

OUTLINE_TEMPLATE = """
You are a creative writing assistant. Generate a concise outline for the following story description.
Story description:
{{ description }}

Outline:
"""

CHAPTER_TEMPLATE = """
You are a novel writing assistant. Continue the story based on the outline and character profiles.

Outline:
{{ outline }}

Characters:
{% for c in characters %}
{{ c.profile() }}
{% endfor %}

Context:
{{ context }}

Instruction:
{{ prompt }}
"""
