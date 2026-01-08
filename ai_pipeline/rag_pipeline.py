import sys
import json
import fitz  # PyMuPDF
from langchain_text_splitters import RecursiveCharacterTextSplitter

def extract_text(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        sys.stderr.write(f"Error reading PDF: {e}\n")
        raise e

def main():
    if len(sys.argv) < 3:
        print("Usage: python rag_pipeline.py <input_pdf> <output_json>")
        sys.exit(1)
        
    input_pdf = sys.argv[1]
    output_json = sys.argv[2]
    
    try:
        # 1. Extract Text
        print(f"Extracting text from {input_pdf}...")
        text = extract_text(input_pdf)
        
        if not text:
            print("Warning: No text extracted from PDF.")
        
        # 2. Split Text
        print("Splitting text...")
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        texts = splitter.split_text(text)
        
        # 3. Generate Output (Dummy Embeddings for now)
        print(f"Generated {len(texts)} chunks. Creating JSON...")
        results = []
        for i, t in enumerate(texts):
            results.append({
                "id": f"chunk_{i}",
                "text": t,
                "embedding": [0.1] * 768  # Dummy 768-dim vector
            })
            
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
            
        print("Done.")
            
    except Exception as e:
        sys.stderr.write(f"Pipeline Failed: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
