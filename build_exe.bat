@echo off
echo Building React Frontend...
cd studio
call npm run build
cd ..

echo Cleaning previous builds...
rmdir /s /q build
rmdir /s /q dist

echo Running PyInstaller...
python -m PyInstaller --name "EsoPipe Studio" ^
    --add-data "esoteric_archive.db;." ^
    --add-data "studio/dist;studio/dist" ^
    --icon NONE ^
    esopipe2/desktop.py

echo Build complete! Check the dist/EsoPipe Studio folder.
