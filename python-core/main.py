from graph.graph import build_graph


def main():
    question = input("🔍 Question: ")

    app = build_graph()


    result = app.invoke({"question": question})


    print("\n--- GENERATED ANSWER ---\n")
    print(result.get("generation", "No answer."))


    sources = result.get("sources", [])

    if sources:
        print("\n📄 Sources used:")
        for src in sources:
            print(f"- {src}")
    else:
        print("\n📄 Sources used: None (general knowledge or no relevant documents)")


if __name__ == "__main__":
    main()
