import argparse

from .agent import NovelAgent
from .character import Character


def main() -> None:
    parser = argparse.ArgumentParser(description="Novel AI Agent CLI")
    parser.add_argument("description", help="Story description for outline generation")
    parser.add_argument("instruction", help="Instruction for the first chapter")
    parser.add_argument("--api-key", dest="api_key", help="OpenAI API key")
    args = parser.parse_args()

    agent = NovelAgent(api_key=args.api_key)
    agent.add_character(Character(name="Hero", persona="Brave and loyal", background="An orphan raised by monks."))
    agent.add_character(Character(name="Villain", persona="Cunning and cruel", background="Seeks power at all costs"))

    outline = agent.generate_outline(args.description)
    print("\n=== Outline ===")
    print(outline)

    chapter = agent.generate_chapter(args.instruction)
    print("\n=== Chapter ===")
    print(chapter)


if __name__ == "__main__":
    main()
