from dataclasses import dataclass

@dataclass
class Character:
    """Represent a story character."""

    name: str
    persona: str
    background: str
    catchphrase: str = ""

    def profile(self) -> str:
        """Return formatted profile for prompt injection."""
        text = f"Name: {self.name}\nPersona: {self.persona}\nBackground: {self.background}"
        if self.catchphrase:
            text += f"\nCatchphrase: {self.catchphrase}"
        return text
