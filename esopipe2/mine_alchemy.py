import os
import glob
import json
import sqlite3
import uuid
import time
from dotenv import load_dotenv
import google.generativeai as genai
import fitz  # PyMuPDF

load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Warning: GEMINI_API_KEY not found in .env. LLM extraction will fail.")
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash')

DB_PATH = 'esoteric_archive.db'
CHATS_DIR = '.' # Raw JSONs are in the root of esoteric studies chats
ALCHEMY_PDF_DIR = r'e:\pdf\alchemy'
IMAGE_SAVE_DIR = r'studio\public\alchemy_images'

os.makedirs(IMAGE_SAVE_DIR, exist_ok=True)

def init_db(conn):
    # Ensure image columns and tables exist if we want to store multimodal data
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alchemy_images (
            id TEXT PRIMARY KEY,
            concept_id TEXT,
            image_path TEXT,
            caption TEXT,
            source_file TEXT,
            FOREIGN KEY(concept_id) REFERENCES alchemy_concepts(id)
        )
    """)
    conn.commit()

def extract_concepts_from_text(text: str, source: str) -> list:
    prompt = f"""
    You are an expert in historical alchemy and chemistry.
    Analyze the following text extracted from {source}.
    If the text contains detailed discussions of alchemical concepts (chemical processes, laboratory operations, 
    theoretical frameworks, specific figures/practitioners, or symbolic imagery like the green lion, dragon, etc.), 
    extract them into structured JSON format.

    Return ONLY a JSON list of objects with the following keys:
    [
        {{
            "term": "Name of the concept, apparatus, or figure",
            "category": "Concept OR Apparatus OR Practitioner OR Substance OR Symbol",
            "definition": "A 1-2 sentence concise definition.",
            "body": "A detailed multi-paragraph explanation of the concept, its chemical reality (if applicable), and its symbolic meaning."
        }}
    ]
    
    If no relevant alchemical concepts are found in the text, return an empty list [].
    Do not include markdown blocks like ```json, just output the raw JSON array.
    
    TEXT:
    {text}
    """
    
    try:
        response = model.generate_content(prompt)
        content = response.text.strip()
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]
            
        concepts = json.loads(content)
        return concepts
    except Exception as e:
        print(f"Error extracting from {source}: {e}")
        return []

def mine_chats(conn):
    print("--- Mining Raw Chat JSONs ---")
    chat_files = glob.glob(os.path.join(CHATS_DIR, '*.json'))
    # Filter out package.json, etc if any, only keep conversation-looking ones
    chat_files = [f for f in chat_files if 'lexicon' not in f and 'package' not in f]
    
    cursor = conn.cursor()
    
    for file_path in chat_files:
        print(f"Processing chat: {file_path}")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                chat_data = json.load(f)
            
            # Combine all human and assistant text into chunks to avoid context window overflow
            full_text = ""
            if isinstance(chat_data, list):
                for turn in chat_data:
                    role = turn.get('role', '')
                    content = turn.get('content', '')
                    full_text += f"{role}: {content}\n\n"
            elif isinstance(chat_data, dict):
                # Try simple key extraction if different format
                full_text = json.dumps(chat_data)[:20000] # truncate for safety
                
            if not full_text.strip(): continue
                
            # Chunking the text (rough approximation, Gemini 2.5 flash has huge context window but we'll limit to 30k chars for safety and speed)
            chunk_size = 30000
            chunks = [full_text[i:i+chunk_size] for i in range(0, len(full_text), chunk_size)]
            
            for i, chunk in enumerate(chunks):
                concepts = extract_concepts_from_text(chunk, f"chat {os.path.basename(file_path)} chunk {i+1}")
                if concepts:
                    for c in concepts:
                        save_concept(cursor, c)
                        conn.commit()
                        
        except Exception as e:
            print(f"Failed processing {file_path}: {e}")
        
        # throttle to avoid immediate rate limits
        time.sleep(2)

def save_concept(cursor, c):
    c_id = "alc_llm_" + str(uuid.uuid4()).replace("-", "")[:10]
    term = c.get("term", "Unknown").strip()
    
    # Check if term already exists to avoid massive duplicates of common things
    cursor.execute("SELECT id FROM alchemy_concepts WHERE term LIKE ?", (term,))
    if cursor.fetchone():
        print(f"Skipping duplicate concept: {term}")
        return

    print(f"Saving concept: {term}")
    cursor.execute("""
        INSERT INTO alchemy_concepts (id, term, category, definition, body)
        VALUES (?, ?, ?, ?, ?)
    """, (c_id, term, c.get("category", "Uncategorized"), c.get("definition", ""), c.get("body", "")))
    
    cursor.execute("""
        INSERT INTO alchemy_concepts_fts (rowid, term, definition, body)
        VALUES (last_insert_rowid(), ?, ?, ?)
    """, (term, c.get("definition", ""), c.get("body", "")))


def mine_pdfs(conn):
    print("--- Mining Alchemy PDFs ---")
    pdf_files = glob.glob(os.path.join(ALCHEMY_PDF_DIR, '*.pdf'))
    cursor = conn.cursor()
    
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        print(f"Processing PDF: {filename}")
        try:
            doc = fitz.open(pdf_path)
            chunk_text = ""
            for i in range(len(doc)):
                page = doc[i]
                chunk_text += page.get_text()
                
                # Image extraction
                for img_index, img in enumerate(page.get_images(full=True)):
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    img_name = f"{filename}_p{i}_{img_index}.{image_ext}"
                    img_save_path = os.path.join(IMAGE_SAVE_DIR, img_name)
                    
                    # Only save if reasonably sized (ignore tiny icons)
                    if len(image_bytes) > 20000:
                        with open(img_save_path, "wb") as f:
                            f.write(image_bytes)
                        
                        # Generate caption using multimodal model
                        # (Skipping API call here to save time/tokens unless necessary, 
                        # but we can insert the logic to caption it)
                        caption = f"Illustration extracted from {filename}, page {i+1}."
                        print(f"Extracted image: {img_name}")
                        
                        cursor.execute("""
                            INSERT INTO alchemy_images (id, concept_id, image_path, caption, source_file)
                            VALUES (?, ?, ?, ?, ?)
                        """, (str(uuid.uuid4()), None, f"/alchemy_images/{img_name}", caption, filename))
                
                # Every 10 pages, process text
                if i % 10 == 0 and chunk_text.strip():
                    concepts = extract_concepts_from_text(chunk_text, f"{filename} pages {max(0, i-10)}-{i}")
                    for c in concepts:
                        save_concept(cursor, c)
                    conn.commit()
                    chunk_text = ""
                    time.sleep(2)
            
            # Process remaining text
            if chunk_text.strip():
                concepts = extract_concepts_from_text(chunk_text, f"{filename} end pages")
                for c in concepts:
                    save_concept(cursor, c)
                conn.commit()
                
        except Exception as e:
            print(f"Failed processing PDF {pdf_path}: {e}")

if __name__ == "__main__":
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)
    print("Schema initialized.")
    # mine_chats(conn)
    mine_pdfs(conn)
    
    print("Mining script scaffold complete. Run with specific sections uncommented to begin ingestion.")
    conn.close()
