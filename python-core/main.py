from graph.graph import build_graph


def main():
    question = input("🔍 Question: ")

    app = build_graph()
    result = app.invoke({"question": question})

    print("\n--- GENERATED ANSWER ---\n")
    print(result.get("generation", "No answer."))

    sources = result.get("sources", [])

    if sources:
        print("\n--- SOURCES USED ---")
        for ref in sources:
            file_name = ref.get("file_name", "unknown")
            chunk = ref.get("chunk_index", "?")
            total = ref.get("total_chunks", "?")

            # Location info depends on file type - pdf,txt or docx
            if "page_number" in ref:
                location = f"page {ref['page_number']}"
            elif "line_start" in ref:
                location = f"lines {ref['line_start']}–{ref['line_end']}"
            elif "paragraph_index" in ref:
                location = f"paragraph {ref['paragraph_index']}"
            else:
                location = "unknown location"

            excerpt = ref.get("excerpt", "")

            print(f"\nfile name: {file_name}")
            print(f"     Location : {location}")
            print(f"     Chunk    : {chunk} / {total}")
            print(f"     Excerpt  : \"{excerpt[:100]}...\"")
    else:
        print("\nSources used: None (general knowledge)")


if __name__ == "__main__":
    main()
