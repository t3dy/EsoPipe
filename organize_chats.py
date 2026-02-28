import os
import shutil
import re
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("organization.log"),
        logging.StreamHandler()
    ]
)

def get_clean_name(folder_name):
    # Keep only consonants and vowels (A-Z, a-z)
    clean = re.sub(r'[^a-zA-Z]', '', folder_name)
    return clean

def organize_files(base_path):
    # Walk through ALL directories recursively
    for root, dirs, files in os.walk(base_path):
        # Skip the base path itself as we don't want to process files already moved
        if root == base_path:
            continue
            
        folder_name = os.path.basename(root)
        clean_name = get_clean_name(folder_name)
        
        if not clean_name:
            logging.warning(f"Skipping folder '{root}' - no valid characters for renaming.")
            continue
            
        for ext in ['.html', '.pdf']:
            old_file = os.path.join(root, f"index{ext}")
            
            if os.path.exists(old_file):
                base_new_file = os.path.join(base_path, f"{clean_name}{ext}")
                new_file = base_new_file
                counter = 1
                
                # Collision resolution loop
                while os.path.exists(new_file):
                    # Check if it's the SAME file (unlikely given it's a move)
                    # But if the name is same, append a counter
                    new_file = os.path.join(base_path, f"{clean_name}_{counter}{ext}")
                    counter += 1
                
                try:
                    logging.info(f"Moving: '{old_file}' -> '{new_file}'")
                    shutil.move(old_file, new_file)
                except Exception as e:
                    logging.error(f"Error moving '{old_file}': {e}")

if __name__ == "__main__":
    target_dir = r"E:\pdf\esoteric studies chats"
    logging.info(f"Starting organization in {target_dir}")
    organize_files(target_dir)
    logging.info("Organization complete.")
