import os
import subprocess
import sys

# Ensure markdown is installed
try:
    import markdown
except ImportError:
    print("Installing markdown...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'markdown'], check=True)
    import markdown

md_file = r'C:\Users\User\Fumorive\eeg-processing\PANDUAN_SETUP.md'
html_file = r'C:\Users\User\Fumorive\eeg-processing\PANDUAN_SETUP.html'
pdf_file = r'C:\Users\User\Fumorive\eeg-processing\PANDUAN_SETUP.pdf'

try:
    with open(md_file, 'r', encoding='utf-8') as f:
        text = f.read()

    html_content = markdown.markdown(text, extensions=['tables'])

    full_html = f'''
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 30px; color: #333; }}
        h1 {{ color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 30px; text-align: center; }}
        h2 {{ color: #334155; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }}
        h3 {{ color: #475569; }}
        code {{ background-color: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-family: Consolas, monospace; font-size: 0.9em; }}
        pre {{ background-color: #0f172a; color: #f8fafc; padding: 20px; border-radius: 8px; overflow-x: auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }}
        pre code {{ background-color: transparent; color: inherit; padding: 0; }}
        table {{ border-collapse: collapse; width: 100%; margin: 25px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1); }}
        th, td {{ border: 1px solid #e2e8f0; padding: 15px; text-align: left; }}
        th {{ background-color: #f8fafc; font-weight: 600; color: #475569; }}
        blockquote {{ border-left: 4px solid #4f46e5; margin: 20px 0; padding: 15px 20px; background-color: #eff6ff; border-radius: 0 8px 8px 0; }}
        a {{ color: #3b82f6; text-decoration: none; font-weight: 500; }}
        ul, ol {{ padding-left: 20px; }}
        li {{ margin-bottom: 8px; }}
        hr {{ border: 0; height: 1px; background: #e2e8f0; margin: 30px 0; }}
    </style>
    </head>
    <body>
    {html_content}
    </body>
    </html>
    '''

    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(full_html)

    print('HTML created. Converting to PDF...')
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    
    # Format the file URL specifically for Windows
    file_url = f"file:///{html_file.replace(str(os.sep), '/')}"
    
    cmd = [
        edge_path,
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        f"--print-to-pdf={pdf_file}",
        file_url
    ]
    
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0 and os.path.exists(pdf_file):
        print('PDF generated successfully:', pdf_file)
        # Optional: cleanup HTML
        # os.remove(html_file)
    else:
        print('Error generating PDF')
        print('STDOUT:', res.stdout)
        print('STDERR:', res.stderr)

except Exception as e:
    print(f"Exception occurred: {e}")
