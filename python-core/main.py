from graph.graph import build_graph

def main():
    question = input("🔍 Question: ")

    app = build_graph()

    result = app.invoke({"question": question})

    print("\n--- GENERATED ANSWER ---\n")
    print(result.get("generation", "No answer."))

if __name__ == "__main__":
    main()
